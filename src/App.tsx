import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

interface Quest {
  id: number;
  title: string;
  type: string;
  reward: number;
  completed: boolean;
  assignee: string;
}

interface Profile {
  name: string;
  role: string;
  level?: number;
  wisdomPoints: number;
  responsibilityPoints: number;
  inventory: string[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const API_TOKEN = import.meta.env.VITE_FAMILY_HUB_API_TOKEN || '';

function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...extra,
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
  };
}

function App() {
  const [role, setRole] = useState<'child' | 'parent'>('child');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [aiMessage, setAiMessage] = useState("你好！我是你的AI成长导师。正在加载你的专属面板...");
  const [blindBox, setBlindBox] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);

  const fetchDashboard = async (currentRole: string) => {
    try {
      const res = await fetch(`${API_URL}/dashboard?role=${currentRole}`, { headers: apiHeaders() });
      const data = await res.json();
      setProfile(data.profile);
      setQuests(data.quests);
      setLogs(data.recentLogs);
      setAiMessage(`欢迎回来，${data.profile.name}！`);
    } catch (err) {
      console.error(err);
      setAiMessage("无法连接到后端服务器，请确保端口 3001 正常运行。");
    }
  };

  const fetchReport = async () => {
    setIsReportLoading(true);
    try {
      const res = await fetch(`${API_URL}/report?role=${role}`, { headers: apiHeaders() });
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
      }
    } catch (err) {
      console.error(err);
      setAiMessage("生成报告失败，请稍后再试。");
    } finally {
      setIsReportLoading(false);
    }
  };

  useEffect(() => {
    const schedule = window.setTimeout(() => {
      void fetchDashboard(role);
    }, 0);
    return () => window.clearTimeout(schedule);
  }, [role]);

  const toggleTask = async (id: number, currentCompleted: boolean) => {
    if (currentCompleted) return; // For MVP, only support marking as complete

    try {
      const res = await fetch(`${API_URL}/quests/${id}/complete`, {
        method: 'POST',
        headers: apiHeaders(),
      });
      const data = await res.json();
      
      if (data.success) {
        setProfile(data.profile);
        setQuests(quests.map(q => q.id === id ? data.quest : q));
        setAiMessage(data.message);
        if (data.blindBoxDrop) {
          setBlindBox(data.blindBoxDrop);
          setTimeout(() => setBlindBox(null), 5000);
        }
        // Refresh logs
        fetchDashboard(role);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addTask = async () => {
    const title = prompt("请输入新的任务名称？");
    if (!title) return;
    const type = prompt("任务类型？输入: wisdom 或 responsibility") || 'wisdom';
    const reward = prompt("任务奖励积分？(数字)") || '10';
    // If parent is adding, maybe they assign to child. For simplicity, assign to opposite role.
    const assignee = role === 'parent' ? 'child' : 'parent';
    
    try {
      const res = await fetch(`${API_URL}/quests`, {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title, type, reward, assignee })
      });
      const data = await res.json();
      if (data.success) {
        setAiMessage(`成功为 ${assignee === 'child' ? '孩子' : '家长'} 派发了新任务！`);
        // We added it for the other role, so it won't show on our dashboard immediately.
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      <header className="hero-header">
        <h1>Family Hub 🌟</h1>
        <div className="role-switcher">
          <button className={role === 'child' ? 'active' : ''} onClick={() => setRole('child')}>🧒 孩子视角</button>
          <button className={role === 'parent' ? 'active' : ''} onClick={() => setRole('parent')}>👨 家长视角</button>
        </div>
      </header>

      {profile && (() => {
        const totalPoints = profile.wisdomPoints + profile.responsibilityPoints;
        const progressPercent = totalPoints % 100;
        return (
          <div className="profile-bar">
            <div className="profile-info" style={{ flex: 1, marginRight: '2rem' }}>
              <h2>{profile.name} {profile.level ? `(Lv.${profile.level})` : ''}</h2>
              <div className="level-bar-container" title={`距离升级还需 ${100 - progressPercent} 经验`}>
                <div className="level-bar-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div className="stats">
                <span className="stat-pill wisdom">🧠 {profile.wisdomPoints} 点</span>
                <span className="stat-pill resp">🛡️ {profile.responsibilityPoints} 点</span>
              </div>
            </div>
            <div className="inventory" style={{ minWidth: '200px' }}>
              <h3>我的背包</h3>
              {profile.inventory.length === 0 ? <span className="empty">空空如也</span> : profile.inventory.map((item, i) => <span key={i} className="inv-item">🎁 {item}</span>)}
            </div>
          </div>
        );
      })()}

      {blindBox && (
        <div className="blind-box-modal">
          <div className="blind-box-content popIn">
            <h2>🎉 触发惊喜盲盒！ 🎉</h2>
            <p>你获得了：<strong>{blindBox}</strong></p>
          </div>
        </div>
      )}

      <div className="ai-mentor">
        <div className="ai-avatar float">🤖</div>
        <div className="ai-bubble">
          <p>{aiMessage}</p>
          <button className="report-btn" onClick={fetchReport} disabled={isReportLoading}>
            {isReportLoading ? "⏳ 正在生成..." : "📊 生成每周AI成长报告"}
          </button>
        </div>
      </div>

      {report && (
        <div className="blind-box-modal" onClick={() => setReport(null)}>
          <div className="report-content popIn" onClick={e => e.stopPropagation()}>
            <ReactMarkdown>{report}</ReactMarkdown>
            <button className="add-btn" onClick={() => setReport(null)} style={{marginTop: '2rem'}}>关闭</button>
          </div>
        </div>
      )}

      <main className="board-main">
        <div className="board-header">
          <h2>我的任务板</h2>
          <button className="add-btn" onClick={addTask}>+ 派发新任务</button>
        </div>
        <div className="task-list">
          {quests.map(task => (
            <div 
              key={task.id} 
              className={`task-card ${task.completed ? 'completed' : ''} type-${task.type}`}
              onClick={() => toggleTask(task.id, task.completed)}
            >
              <div className="task-info">
                <h3>{task.title}</h3>
                <span className="task-points">+{task.reward} {task.type === 'wisdom' ? '智慧' : '责任'}</span>
              </div>
              <div className={`checkbox ${task.completed ? 'checked' : ''}`}>
                {task.completed && '✓'}
              </div>
            </div>
          ))}
          {quests.length === 0 && <p className="empty-state">目前没有任务，享受你的休息时间吧！</p>}
        </div>

        {logs.length > 0 && (
          <div className="logs-section">
            <h3>家庭活动动态</h3>
            <ul>
              {logs.map((log, i) => <li key={i}>{log}</li>)}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
