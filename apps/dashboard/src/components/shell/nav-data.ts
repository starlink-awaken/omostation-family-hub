export type NavItem = {
  title: string;
  href: string;
  badge?: string;
};

export type NavGroup = {
  title: string;
  icon: string;
  items: NavItem[];
};

export const GROUPS: NavGroup[] = [
  {
    title: "健康",
    icon: "❤️",
    items: [
      { title: "医疗健康", href: "/health" },
      { title: "育儿成长", href: "/growth" },
      { title: "里程碑", href: "/milestones", badge: "New" },
    ],
  },
  {
    title: "日常",
    icon: "🏠",
    items: [
      { title: "家庭日常", href: "/daily" },
      { title: "资产设备", href: "/assets" },
      { title: "日历", href: "/calendar" },
      { title: "时间线", href: "/timeline" },
      { title: "账目", href: "/finance" },
    ],
  },
  {
    title: "工具",
    icon: "🔧",
    items: [
      { title: "问答", href: "/ask", badge: "AI" },
      { title: "标签", href: "/tags" },
      { title: "图谱", href: "/graph" },
      { title: "文件浏览", href: "/files" },
      { title: "编辑", href: "/edit" },
    ],
  },
];

export const TOP_LEVEL = [
  { title: "首页", href: "/" },
  { title: "家庭成员", href: "/members" },
  { title: "任务", href: "/tasks" },
  { title: "知识库", href: "/knowledge" },
];
