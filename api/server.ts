import express from 'express';
import cors from 'cors';
import { Database } from 'bun:sqlite';
import { execFile } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const app = express();
const allowedOrigins = new Set(
  (process.env.FAMILY_HUB_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const apiToken = process.env.FAMILY_HUB_API_TOKEN?.trim() || '';
const auditPath = resolve(process.env.FAMILY_HUB_AUDIT_PATH || '.local-audit/api-writes.jsonl');

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin not allowed'));
  },
}));
app.use(express.json({ limit: '32kb' }));

const QUEST_TYPES = new Set(['wisdom', 'responsibility']);

type ProfileRow = {
  role: string;
  name: string;
  level: number;
  wisdomPoints: number;
  responsibilityPoints: number;
  inventory: string;
  completed?: number;
};

type QuestRow = {
  id: number;
  title: string;
  type: string;
  reward: number;
  completed: number;
  assignee: string;
};

type LogRow = { message: string };

function requireApiAuth(req: express.Request, res: express.Response): boolean {
  if (!apiToken) {
    res.status(503).json({ error: 'FAMILY_HUB_API_TOKEN 未配置，API 已停止提供数据。' });
    return false;
  }
  if (req.get('authorization') !== `Bearer ${apiToken}`) {
    res.status(401).json({ error: '需要 Family Hub API token。' });
    return false;
  }
  return true;
}

function appendAuditLog(action: string, details: Record<string, unknown>): void {
  try {
    mkdirSync(dirname(auditPath), { recursive: true });
    appendFileSync(
      auditPath,
      `${JSON.stringify({ timestamp: new Date().toISOString(), action, ...details })}\n`,
      'utf8',
    );
  } catch (error) {
    console.error('family-hub audit log error:', error);
  }
}

function validateQuestInput(body: unknown):
  | { ok: true; title: string; type: string; reward: number; assignee: string }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Request body must be an object.' };
  const input = body as Record<string, unknown>;
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const type = typeof input.type === 'string' ? input.type.trim() : '';
  const assignee = typeof input.assignee === 'string' ? input.assignee.trim() : '';
  const reward = Number(input.reward);

  if (!title || title.length > 200) return { ok: false, error: 'Quest title is required and must be <= 200 characters.' };
  if (!QUEST_TYPES.has(type)) return { ok: false, error: 'Invalid quest type.' };
  if (!Number.isInteger(reward) || reward < 1 || reward > 1000) return { ok: false, error: 'Invalid quest reward.' };
  if (!assignee) return { ok: false, error: 'Invalid quest assignee.' };
  return { ok: true, title, type, reward, assignee };
}

function syncQuestCompletionToGbrain(quest: { id: number; title: string; assignee: string }): void {
  const databaseUrl = process.env.GBRAIN_DATABASE_URL?.trim();
  const rawCliPath = process.env.GBRAIN_CLI_PATH?.trim() || 'src/cli.ts';
  const cliPath = rawCliPath.startsWith('bun run ') ? rawCliPath.slice('bun run '.length).trim() : rawCliPath;
  if (!databaseUrl || !cliPath || /[\r\n]/u.test(cliPath)) {
    console.warn('GBrain sync skipped: configure GBRAIN_DATABASE_URL and a safe GBRAIN_CLI_PATH.');
    return;
  }

  execFile(
    'bun',
    ['run', cliPath, 'put', `quest-${quest.id}`, '--text', `${quest.title} completed by ${quest.assignee}`],
    { env: { ...process.env, GBRAIN_DATABASE_URL: databaseUrl } },
    (error) => {
      if (error) console.error('gbrain persistence error:', error.message);
    },
  );
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'family-hub',
    database: 'sqlite',
    write_auth_configured: Boolean(apiToken),
  });
});

// Initialize SQLite database
const db = new Database('family_hub.db');

// Setup tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    role TEXT PRIMARY KEY,
    name TEXT,
    level INTEGER,
    wisdomPoints INTEGER,
    responsibilityPoints INTEGER,
    inventory TEXT
  );
  
  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    type TEXT,
    reward INTEGER,
    completed BOOLEAN,
    assignee TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT,
    type TEXT,
    timestamp TEXT
  );
`);

// Seed data if empty
const count = db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number };
if (count.count === 0) {
  const insertProfile = db.prepare('INSERT INTO profiles (role, name, level, wisdomPoints, responsibilityPoints, inventory) VALUES (?, ?, ?, ?, ?, ?)');
  insertProfile.run('child', '小明', 3, 120, 80, JSON.stringify(['1小时动画券']));
  insertProfile.run('parent', '爸爸', 1, 0, 0, JSON.stringify([]));

  const insertQuest = db.prepare('INSERT INTO quests (title, type, reward, completed, assignee) VALUES (?, ?, ?, ?, ?)');
  insertQuest.run('阅读课外书30分钟', 'wisdom', 10, 0, 'child');
  insertQuest.run('自己整理书桌', 'responsibility', 15, 0, 'child');
  insertQuest.run('陪小明拼乐高30分钟', 'responsibility', 20, 0, 'parent');
}

// Helper to parse profile
const getProfile = (role: string) => {
  const p = db.prepare('SELECT * FROM profiles WHERE role = ?').get(role) as ProfileRow | null;
  if (!p) return null;
  return { ...p, inventory: JSON.parse(p.inventory) as string[], completed: Boolean(p.completed) };
};

// API: Get profile and quests based on role
app.get('/api/dashboard', (req, res) => {
  if (!requireApiAuth(req, res)) return;
  const role = req.query.role as string || 'child';
  const profile = getProfile(role);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  
  const quests = db.prepare('SELECT * FROM quests WHERE assignee = ?').all(role).map((q) => ({
    ...(q as QuestRow),
    completed: Boolean((q as QuestRow).completed),
  }));
  
  const recentLogs = db.prepare('SELECT message FROM logs ORDER BY id DESC LIMIT 5').all().map((l) => (l as LogRow).message);
  
  res.json({
    profile,
    quests,
    recentLogs
  });
});

// API: Complete a quest and trigger blind box
app.post('/api/quests/:id/complete', (req, res) => {
  if (!requireApiAuth(req, res)) return;
  const questId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(questId) || questId < 1) {
    return res.status(400).json({ error: 'Invalid quest id.' });
  }
  const quest = db.prepare('SELECT * FROM quests WHERE id = ?').get(questId) as QuestRow | null;
  
  if (!quest || quest.completed) {
    return res.status(400).json({ error: 'Quest not found or already completed.' });
  }

  // Mark as completed
  db.prepare('UPDATE quests SET completed = 1 WHERE id = ?').run(questId);
  
  // MCP sync stays asynchronous, but user content is passed as an argument rather than shell text.
  syncQuestCompletionToGbrain(quest);

  const role = quest.assignee;
  const profile = getProfile(role);
  if (!profile) return res.status(400).json({ error: 'Profile not found' });

  // Add points
  if (quest.type === 'wisdom') profile.wisdomPoints += quest.reward;
  if (quest.type === 'responsibility') profile.responsibilityPoints += quest.reward;

  // Blind Box Logic (20% chance)
  let blindBoxItem = null;
  if (Math.random() < 0.2) {
    const items = ['神秘玩具盲盒', '周末选片权', '全家游乐园一次'];
    blindBoxItem = items[Math.floor(Math.random() * items.length)];
    profile.inventory.push(blindBoxItem);
  }

  // Update profile
  db.prepare('UPDATE profiles SET wisdomPoints = ?, responsibilityPoints = ?, inventory = ? WHERE role = ?')
    .run(profile.wisdomPoints, profile.responsibilityPoints, JSON.stringify(profile.inventory), role);

  // Log it
  const logMessage = `[${new Date().toLocaleTimeString()}] ${profile.name} 完成了: ${quest.title}`;
  db.prepare('INSERT INTO logs (message, type, timestamp) VALUES (?, ?, ?)').run(logMessage, quest.type, new Date().toISOString());
  appendAuditLog('quest.complete', { questId, assignee: role, reward: quest.reward });

  res.json({
    success: true,
    profile,
    quest: { ...quest, completed: true },
    blindBoxDrop: blindBoxItem,
    message: blindBoxItem ? `太棒了！触发了随机盲盒奖励：${blindBoxItem}！` : '任务完成，干得好！'
  });
});

// API: Add a new quest
app.post('/api/quests', (req, res) => {
  if (!requireApiAuth(req, res)) return;
  const validation = validateQuestInput(req.body);
  if (!validation.ok) return res.status(400).json({ error: validation.error });
  const { title, type, reward: r, assignee } = validation;
  if (!getProfile(assignee)) return res.status(400).json({ error: 'Invalid quest assignee.' });
  
  const info = db.prepare('INSERT INTO quests (title, type, reward, completed, assignee) VALUES (?, ?, ?, ?, ?)')
    .run(title, type, r, 0, assignee);
  appendAuditLog('quest.create', { questId: Number(info.lastInsertRowid), assignee, reward: r, type });
    
  res.json({ 
    success: true, 
    quest: { id: info.lastInsertRowid, title, type, reward: r, completed: false, assignee } 
  });
});

// API: Generate Weekly AI Mentor Report
app.get('/api/report', (req, res) => {
  if (!requireApiAuth(req, res)) return;
  const role = req.query.role as string || 'child';
  const profile = getProfile(role);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  
  setTimeout(() => {
    const report = role === 'child'
      ? `### 🌟 本周AI导师成长报告：${profile.name}\n\n**总评**：本周表现非常棒！你累积了 **${profile.wisdomPoints}** 点智慧值和 **${profile.responsibilityPoints}** 点责任感。\n\n**闪光点**：\n- 任务完成度很高，特别是责任感相关的任务（如整理书桌），展示了你强大的自我管理能力。\n\n**导师建议**：\n- 下周可以尝试挑战更多的“智慧”任务，比如阅读一本新的科普读物。\n- 背包里还有 **${profile.inventory.length}** 个盲盒奖励（${profile.inventory.join(', ')}），记得在周末和爸爸妈妈一起兑换使用哦！`
      : `### 🎯 本周家庭共建报告：${profile.name}\n\n**总评**：作为家庭的顶梁柱，本周你在陪伴与互动上投入了精力。\n\n**观察反馈**：\n- 你陪伴小明完成了多项互动，这极大地增加了亲子羁绊（Responsibility Points: ${profile.responsibilityPoints}）。\n- 小明本周自理能力有所提升，这与你设定的激励机制密不可分。\n\n**下一步建议**：\n- 可以尝试在下周给小明布置一个稍微带有挑战性的“协作型”任务，进一步引导他主动探索。`;

    res.json({ success: true, report });
  }, 1500);
});

const PORT = Number(process.env.FAMILY_HUB_PORT || 3001);
app.listen(PORT, () => {
  console.log(`Backend API Server running on http://localhost:${PORT}`);
});

export { app };
