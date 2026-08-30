const REQUIRED_VARS: { key: string; hint: string }[] = [
  { key: "FAMILY_DASHBOARD_PASSWORD", hint: "登录口令" },
  { key: "FAMILY_DOCUMENTS_ROOT", hint: "只读家庭文档根目录" },
  { key: "FAMILY_DASHBOARD_STATE_ROOT", hint: "Workspace 运行状态根目录" },
];

export function checkEnv() {
  if (typeof window !== "undefined") return;
  // 跳过 Next.js 构建阶段（build 时还没有运行时 env）
  if (process.env.NEXT_PHASE) return;
  const missing = REQUIRED_VARS.filter((v) => !process.env[v.key]);
  if (missing.length > 0) {
    console.warn("⚠️ 环境变量缺失（仅开发环境显示）：");
    missing.forEach((m) => console.warn(`   - ${m.key} (${m.hint})`));
    if (process.env.NODE_ENV === "production") {
      throw new Error(`缺少必要环境变量: ${missing.map((v) => v.key).join(", ")}`);
    }
  }
}
