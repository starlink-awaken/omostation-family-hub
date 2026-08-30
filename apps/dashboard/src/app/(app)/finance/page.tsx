import { loadAppData } from "@/lib/data-loader";
import { CostTrendChart } from "@/components/shared/CostTrendChart";
import { BudgetPieChart } from "@/components/shared/BudgetPieChart";
import { Card } from "@/components/shared/Card";
import type { MemberFinance, ExpenseRecord, BudgetCategory } from "@/lib/parsers/finance-parser";

export const dynamic = "force-dynamic";

type FinanceData = {
  members: MemberFinance[];
  expenses: ExpenseRecord[];
  categories: BudgetCategory[];
};

function EmptyState() {
  return (
    <Card padding="lg" className="text-center">
      <p className="text-sm mb-0" style={{ color: "var(--family-text-2)" }}>暂无财务数据。</p>
    </Card>
  );
}

const CARD_LINKS = [
  { title: "家庭账目规则", href: "/doc?path=_knowledge/00.规则与模板/家庭账目规则.md", desc: "预算分类、月度归档、季度审计规则", icon: "📋" },
  { title: "家庭财务总览", href: "/doc?path=_knowledge/04.家庭日常/04.家庭财务/README.md", desc: "月度快照、大项支出、现金流", icon: "💰" },
  { title: "物业费记录", href: "/doc?path=_knowledge/04.家庭日常/04.家庭财务/物业费_2026-2027.md", desc: "2026-2027 物业费缴纳记录", icon: "🏠" },
  { title: "理财规划", href: "/doc?path=_knowledge/04.家庭日常/05.理财/README.md", desc: "投资持仓、理财日历、策略研究", icon: "📈" },
];

export default async function FinancePage() {
  let data: FinanceData;
  try {
    data = await loadAppData<FinanceData>("finance.json");
  } catch {
    return <EmptyState />;
  }

  const { members, expenses, categories } = data;

  const costLabels = ["含裸车约 ¥270,000", "不含裸车约 ¥31,000"];

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-lg font-bold mb-1" style={{ color: "var(--family-text)" }}>
          💳 账目看板
        </h1>
        <p className="text-xs" style={{ color: "var(--family-text-3)" }}>
          家庭财务管理 · 预算跟踪 · 支出记录
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {CARD_LINKS.map((link) => (
          <div key={link.href}>
            <a
              href={link.href}
              className="block rounded-xl border p-4 h-full no-underline family-transition"
              style={{ cursor: "pointer", borderColor: "var(--family-border)", background: "var(--family-surface)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: "1.25rem" }}>{link.icon}</span>
                <span className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                  {link.title}
                </span>
              </div>
              <p className="text-xs mb-0" style={{ color: "var(--family-text-2)" }}>
                {link.desc}
              </p>
            </a>
          </div>
        ))}
      </div>

      {/* Summary stats */}
      {members.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
            📊 收支快照（2026-06）
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((m) => (
              <div key={m.name}>
                <Card padding="md" className="h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="flex items-center justify-center rounded-full font-bold shrink-0"
                      style={{
                        width: 40,
                        height: 40,
                        background: "var(--family-primary-soft)",
                        color: "var(--family-primary)",
                        fontSize: "0.875rem",
                      }}
                    >
                      {m.name === "Synthetic Member 01" ? "⭐" : "✨"}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--family-text)" }}>
                        {m.name}
                      </div>
                      <div className="text-xs" style={{ color: "var(--family-text-3)" }}>
                        {m.income !== "—" ? `月收入 ${m.income}` : "月收入待填写"}
                      </div>
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-3 text-center"
                    style={{ background: "var(--family-primary-soft)" }}
                  >
                    <div className="text-xs mb-1" style={{ color: "var(--family-text-3)" }}>
                      资产
                    </div>
                    <div className="font-bold" style={{ color: "var(--family-primary)", fontSize: "1.125rem" }}>
                      {m.asset !== "—" ? m.asset : "待填写"}
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cost summary banner */}
      <section className="mb-5">
        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: "var(--family-primary)",
            background: "var(--family-primary-soft)",
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ fontSize: "1.5rem" }}>🚗</span>
            <div className="grow">
              <div className="text-xs font-semibold mb-1" style={{ color: "var(--family-primary-strong)" }}>
                理想 i6 新车落地
              </div>
              <div className="flex gap-3 flex-wrap">
                {costLabels.map((label) => (
                  <span key={label} className="text-xs" style={{ color: "var(--family-primary)" }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Expense timeline */}
      {expenses.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
            🧾 大件支出记录
          </h2>
          <div className="flex flex-col gap-2">
            {expenses.map((ex, i) => (
              <Card key={i} padding="md">
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 flex items-center justify-center rounded-full"
                    style={{
                      width: 36,
                      height: 36,
                      background: "var(--family-surface-2)",
                      fontSize: "0.75rem",
                      color: "var(--family-text-3)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="grow min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <span className="font-semibold text-sm" style={{ color: "var(--family-text)" }}>
                          {ex.item}
                        </span>
                        <span className="text-xs ms-2" style={{ color: "var(--family-text-3)" }}>
                          {ex.date}
                        </span>
                      </div>
                      <span
                        className="font-bold shrink-0"
                        style={{ color: "var(--family-danger)", fontSize: "0.9375rem" }}
                      >
                        {ex.amount}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {ex.payer !== "—" && (
                        <span className="text-xs" style={{ color: "var(--family-text-2)" }}>
                          出资：{ex.payer}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: "var(--family-text-3)" }}>
                        {ex.note}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Cost trend chart */}
      <section className="mb-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
          📈 月度费用趋势
        </h2>
        <Card>
          <CostTrendChart />
        </Card>
      </section>

      {/* Budget rules with pie chart */}
      {categories.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
            🎯 预算分配规则
          </h2>
          <Card padding="md">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="shrink-0 flex justify-center" style={{ minWidth: 200 }}>
                <BudgetPieChart data={categories} />
              </div>
              <div className="grow flex flex-col gap-3 justify-center">
                {categories.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold" style={{ color: "var(--family-text)" }}>
                        {cat.name}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "var(--family-primary)" }}>
                        {cat.target}%
                      </span>
                    </div>
                    <div
                      className="rounded w-full"
                      style={{ height: 6, background: "var(--family-surface-2)", overflow: "hidden" }}
                    >
                      <div
                        className="rounded h-full"
                        style={{
                          width: `${cat.target}%`,
                          background: "var(--family-primary)",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--family-text-3)" }}>
                      {cat.note}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Emergency reserve card */}
      {categories.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--family-text)" }}>
            🛡️ 应急储备
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Card padding="md" className="h-full">
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: "1.25rem" }}>💰</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                    规模
                  </span>
                </div>
                <p className="text-xs mb-0" style={{ color: "var(--family-text-2)" }}>
                  6 个月家庭支出 · 独立账户存放
                </p>
              </Card>
            </div>
            <div>
              <Card padding="md" className="h-full">
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: "1.25rem" }}>⚡</span>
                  <span className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>
                    动用条件
                  </span>
                </div>
                <p className="text-xs mb-0" style={{ color: "var(--family-text-2)" }}>
                  失业 / 重大医疗 / 突发 · 动用后 3 个月内补回
                </p>
              </Card>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
