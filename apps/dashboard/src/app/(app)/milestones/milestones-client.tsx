"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MilestoneData, MilestoneStatus, MilestoneItem, VaccineData, VaccineItem, CheckupItem } from "@/types/milestone";
import { vaccinateAction, markAchievedAction } from "@/lib/actions/milestones";

type TabKey = "milestones" | "vaccines" | "checkups";

const MILESTONE_SECTION: { status: MilestoneStatus; label: string; key: "milestones" | "observing" | "upcoming" | "future" }[] = [
  { status: "achieved", label: "已达成", key: "milestones" },
  { status: "observing", label: "观察中", key: "observing" },
  { status: "upcoming", label: "即将到来", key: "upcoming" },
  { status: "future", label: "远期", key: "future" },
];

const STATUS_COLORS: Record<string, string> = {
  "确认": "text-green-600 bg-green-50",
  "到期": "text-red-600 bg-red-50",
  "即将到期": "text-orange-600 bg-orange-50",
  "待接种": "text-gray-600 bg-gray-50",
  "待确认": "text-yellow-600 bg-yellow-50",
  "超期": "text-red-700 bg-red-100",
};

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Modal ──────────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Vaccinate Modal ───────────────────────────────────────────────

function VaccinateModal({
  item,
  onClose,
}: {
  item: VaccineItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [dateVal, setDateVal] = useState(todayStr());
  const [noteVal, setNoteVal] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("name", item.name);
    fd.set("dose", item.dose);
    fd.set("date", dateVal);
    if (noteVal) fd.set("note", noteVal);

    startTransition(async () => {
      const result = await vaccinateAction(fd);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error || "操作失败");
      }
    });
  }, [item, dateVal, noteVal, onClose, router, startTransition]);

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-500">疫苗</p>
          <p className="font-medium">{item.name} {item.dose}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">应种日期</p>
          <p className="font-medium">{item.plannedDate}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">接种日期</label>
          <input
            type="date"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">备注（可选）</label>
          <input
            type="text"
            value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="如：接种后无不良反应"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 transition-colors">
            ✓ 确认接种
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 transition-colors">
            取消
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Milestone Modal ───────────────────────────────────────────────

function MilestoneAchieveModal({
  title,
  monthLabel,
  onClose,
}: {
  title: string;
  monthLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [dateVal, setDateVal] = useState(todayStr());

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("title", title);
    fd.set("date", dateVal);

    startTransition(async () => {
      const result = await markAchievedAction(fd);
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error || "操作失败");
      }
    });
  }, [title, dateVal, onClose, router, startTransition]);

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-500">里程碑</p>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-gray-400">{monthLabel}</p>
        </div>
        <div>
          <label className="text-sm text-gray-500 block mb-1">达成日期</label>
          <input
            type="date"
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button type="submit" className="flex-1 bg-purple-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-700 transition-colors">
            🏆 确认达成
          </button>
          <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 transition-colors">
            取消
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Main Client Component ─────────────────────────────────────────

export function MilestonesClient({
  milestones,
  vaccines,
}: {
  milestones: MilestoneData | null;
  vaccines: VaccineData | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("vaccines");

  // Modal state
  const [vaccinateTarget, setVaccinateTarget] = useState<VaccineItem | null>(null);
  const [milestoneTarget, setMilestoneTarget] = useState<{ title: string; monthLabel: string } | null>(null);

  const today = todayStr();

  // ── Count helpers ─────────────────────────────────────────────

  const overdueVac = vaccines?.vaccines.filter((v) => v.status === "到期" || v.status === "超期") ?? [];
  const dueSoonVac = vaccines?.vaccines.filter((v) => v.status === "即将到期") ?? [];
  const doneVac = vaccines?.vaccines.filter((v) => v.status === "确认") ?? [];
  const pendingVac = vaccines?.vaccines.filter((v) => ["待接种", "待确认"].includes(v.status)) ?? [];
  const activeOverdue = overdueVac.length;
  const overdueCheckups = vaccines?.checkups.filter((c) => c.status === "到期") ?? [];

  // Find overdue by checking if suggestedDate is past
  const pastCheckups = vaccines?.checkups.filter((c) => {
    if (c.status === "到期") return true;
    const d = c.suggestedDate.match(/\d{4}-\d{2}-\d{2}/);
    if (d && d[0] < today) return true;
    return false;
  }) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏆 成长追踪</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabBtn active={activeTab === "vaccines"} onClick={() => setActiveTab("vaccines")}>
          💉 疫苗
          {activeOverdue > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {activeOverdue}
            </span>
          )}
        </TabBtn>
        <TabBtn active={activeTab === "milestones"} onClick={() => setActiveTab("milestones")}>
          🏆 里程碑
        </TabBtn>
        <TabBtn active={activeTab === "checkups"} onClick={() => setActiveTab("checkups")}>
          🏥 儿保体检
          {pastCheckups.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {pastCheckups.length}
            </span>
          )}
        </TabBtn>
      </div>

      {/* Alert Banner */}
      {activeOverdue > 0 && activeTab !== "checkups" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">🔴</span>
          <div>
            <p className="font-medium text-red-800">{activeOverdue} 项疫苗已超期</p>
            <p className="text-sm text-red-600 mt-1">
              {overdueVac.map((v) => v.name + " " + v.dose).join("、")}
            </p>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "vaccines" && (
        <VaccineTabContent
          vaccines={vaccines}
          overdueVac={overdueVac}
          dueSoonVac={dueSoonVac}
          doneVac={doneVac}
          pendingVac={pendingVac}
          activeOverdue={activeOverdue}
          onVaccinate={setVaccinateTarget}
        />
      )}

      {activeTab === "milestones" && (
        <MilestoneTabContent
          milestones={milestones}
          onAchieve={setMilestoneTarget}
        />
      )}

      {activeTab === "checkups" && (
        <CheckupTabContent
          vaccines={vaccines}
          pastCheckups={pastCheckups}
          today={today}
        />
      )}

      {/* ICS Link */}
      <div className="text-center pt-4 border-t border-gray-100">
        <Link
          href="/api/milestones/ics"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span>📅</span> 导出 ICS 日历（里程碑 + 疫苗 + 儿保）
        </Link>
      </div>

      {/* Modals */}
      {vaccinateTarget && (
        <Modal title="💉 确认接种" onClose={() => setVaccinateTarget(null)}>
          <VaccinateModal item={vaccinateTarget} onClose={() => setVaccinateTarget(null)} />
        </Modal>
      )}

      {milestoneTarget && (
        <Modal title="🏆 确认达成" onClose={() => setMilestoneTarget(null)}>
          <MilestoneAchieveModal
            title={milestoneTarget.title}
            monthLabel={milestoneTarget.monthLabel}
            onClose={() => setMilestoneTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── Tab Button ────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
        active
          ? "border-purple-600 text-purple-700 bg-purple-50/50"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Vaccine Tab Content ───────────────────────────────────────────

function VaccineTabContent({
  vaccines,
  overdueVac,
  dueSoonVac,
  doneVac,
  pendingVac,
  activeOverdue,
  onVaccinate,
}: {
  vaccines: VaccineData | null;
  overdueVac: VaccineItem[];
  dueSoonVac: VaccineItem[];
  doneVac: VaccineItem[];
  pendingVac: VaccineItem[];
  activeOverdue: number;
  onVaccinate: (v: VaccineItem) => void;
}) {
  if (!vaccines) {
    return <p className="text-gray-400 text-sm py-8 text-center">暂无疫苗数据</p>;
  }

  const allFree = vaccines.vaccines;
  const allOptional = vaccines.optionalVaccines;

  return (
    <div className="space-y-6">
      {/* Count Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CountCard label="到期" value={activeOverdue} color="red" />
        <CountCard label="即将到期" value={dueSoonVac.length} color="orange" />
        <CountCard label="已接种" value={doneVac.length} color="green" />
        <CountCard label="待处理" value={pendingVac.length} color="gray" />
      </div>

      {/* Overdue Section */}
      {overdueVac.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-1.5">
            <span>🔴</span> 已超期 / 到期
          </h3>
          <div className="space-y-2">
            {overdueVac.map((item) => (
              <VaccineCard key={item.id} item={item} onVaccinate={() => onVaccinate(item)} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Section */}
      {dueSoonVac.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-orange-700 mb-3 flex items-center gap-1.5">
            <span>🟠</span> 即将到期
          </h3>
          <div className="space-y-2">
            {dueSoonVac.map((item) => (
              <VaccineCard key={item.id} item={item} onVaccinate={() => onVaccinate(item)} />
            ))}
          </div>
        </section>
      )}

      {/* All Free Vaccines */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 全部规划疫苗</h3>
        <div className="space-y-1.5">
          {allFree.map((item) => (
            <VaccineRow key={item.id} item={item} onVaccinate={() => onVaccinate(item)} />
          ))}
        </div>
      </section>

      {/* Optional Vaccines */}
      {allOptional.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">💊 自费疫苗</h3>
          <div className="space-y-1.5">
            {allOptional.map((item) => (
              <VaccineRow key={item.id} item={item} onVaccinate={() => onVaccinate(item)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Milestone Tab Content ─────────────────────────────────────────

function MilestoneTabContent({
  milestones,
  onAchieve,
}: {
  milestones: MilestoneData | null;
  onAchieve: (m: { title: string; monthLabel: string }) => void;
}) {
  if (!milestones) {
    return <p className="text-gray-400 text-sm py-8 text-center">暂无里程碑数据</p>;
  }

  return (
    <div className="space-y-6">
      {MILESTONE_SECTION.map((sec) => {
        const items = milestones[sec.key] as MilestoneItem[] | undefined;
        if (!items || items.length === 0) return null;

        const isAchieved = sec.status === "achieved";

        return (
          <section key={sec.status}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {sec.label}（{items.length}）
            </h3>
            <div className="space-y-2">
              {items.map((item: MilestoneItem) => (
                <MilestoneCard
                  key={item.id}
                  item={item}
                  showAchieveBtn={!isAchieved}
                  onAchieve={() => onAchieve({ title: item.title, monthLabel: item.monthRange })}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Checkup Tab Content ───────────────────────────────────────────

function CheckupTabContent({
  vaccines,
  pastCheckups,
  today,
}: {
  vaccines: VaccineData | null;
  pastCheckups: CheckupItem[];
  today: string;
}) {
  if (!vaccines || vaccines.checkups.length === 0) {
    return <p className="text-gray-400 text-sm py-8 text-center">暂无儿保体检数据</p>;
  }

  return (
    <div className="space-y-4">
      {pastCheckups.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-lg mt-0.5">🔴</span>
          <div>
            <p className="font-medium text-red-800">{pastCheckups.length} 项儿保体检已到期</p>
            <p className="text-sm text-red-600 mt-1">建议尽快预约完成</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {vaccines.checkups.map((item, idx) => {
          const isPast = pastCheckups.includes(item);
          return (
            <div
              key={idx}
              className={`border rounded-lg p-4 flex items-start justify-between ${
                isPast ? "border-red-200 bg-red-50" : "border-gray-200"
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{item.monthLabel}</span>
                  {isPast && <span className="text-xs text-red-600 font-medium">🔴 已到期</span>}
                </div>
                <p className="text-sm text-gray-600">{item.items}</p>
                <p className="text-xs text-gray-400 mt-1">
                  建议日期：{item.suggestedDate}
                </p>
              </div>
              <span className="text-sm">{item.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vaccine Card (overdue/upcoming) ───────────────────────────────

function VaccineCard({
  item,
  onVaccinate,
}: {
  item: VaccineItem;
  onVaccinate: () => void;
}) {
  const isOverdue = item.status === "到期" || item.status === "超期";
  const isDueSoon = item.status === "即将到期";
  const isDone = item.status === "确认";

  const borderColor = isOverdue ? "border-red-200 bg-red-50" : isDueSoon ? "border-orange-200 bg-orange-50" : "border-gray-200";

  return (
    <div className={`border rounded-lg p-4 ${borderColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs mb-1">
            {item.freeStatus === "免费" ? (
              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">免费</span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">自费</span>
            )}
            <span className="text-gray-400">{item.monthLabel}</span>
            {isOverdue && <span className="text-red-600 font-medium">🔴 超期</span>}
            {isDueSoon && <span className="text-orange-600 font-medium">🟠 即将到期</span>}
            {isDone && <span className="text-green-600 font-medium">✅ 已接种</span>}
          </div>
          <p className="font-medium text-sm">{item.name} {item.dose}</p>
          <p className="text-xs text-gray-400 mt-0.5">应种 {item.plannedDate}</p>
          {item.note && <p className="text-xs text-gray-500 mt-1">{item.note}</p>}
        </div>

        {!isDone && (
          <button
            onClick={onVaccinate}
            className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            ✅ 已接种
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Vaccine Row (compact for full list) ───────────────────────────

function VaccineRow({
  item,
  onVaccinate,
}: {
  item: VaccineItem;
  onVaccinate: () => void;
}) {
  const statusColor = STATUS_COLORS[item.status] || "text-gray-500 bg-gray-50";
  const isDone = item.status === "确认";

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor}`}>
        {item.status}
      </span>
      <span className="text-xs text-gray-400 w-12 shrink-0">{item.monthLabel}</span>
      <span className="text-sm flex-1 min-w-0 truncate">{item.name} {item.dose}</span>
      <span className="text-xs text-gray-400">{item.plannedDate}</span>
      {!isDone && (
        <button
          onClick={onVaccinate}
          className="shrink-0 text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
        >
          接种
        </button>
      )}
      {isDone && item.actualDate && (
        <span className="text-xs text-green-600">{item.actualDate}</span>
      )}
    </div>
  );
}

// ─── Milestone Card ────────────────────────────────────────────────

function MilestoneCard({
  item,
  showAchieveBtn,
  onAchieve,
}: {
  item: MilestoneItem;
  showAchieveBtn: boolean;
  onAchieve: () => void;
}) {
  const isAchieved = !!item.achievedDate;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs mb-1">
            <span className="text-gray-400">{item.domain}</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-400">{item.monthRange}</span>
          </div>
          <p className="font-medium text-sm">{item.title}</p>
          <div className="flex items-center gap-2 mt-1">
            {isAchieved ? (
              <span className="text-xs text-green-600">✅ 已达成 · {item.achievedDate}</span>
            ) : item.expectedDate ? (
              <span className="text-xs text-gray-400">预计 {item.expectedDate}</span>
            ) : null}
          </div>
          {item.note && <p className="text-xs text-gray-500 mt-1">{item.note}</p>}
        </div>

        {showAchieveBtn && !isAchieved && (
          <button
            onClick={onAchieve}
            className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            🏆 已达成
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Count Card ────────────────────────────────────────────────────

function CountCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "red" | "orange" | "green" | "gray";
}) {
  const dotColor = {
    red: "bg-red-500",
    orange: "bg-orange-500",
    green: "bg-green-500",
    gray: "bg-gray-400",
  }[color];

  const bgColor = {
    red: "bg-red-50 border-red-100",
    orange: "bg-orange-50 border-orange-100",
    green: "bg-green-50 border-green-100",
    gray: "bg-gray-50 border-gray-100",
  }[color];

  return (
    <div className={`border rounded-lg p-3 ${bgColor}`}>
      <span className={`block w-2 h-2 rounded-full mb-1.5 ${dotColor}`} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
