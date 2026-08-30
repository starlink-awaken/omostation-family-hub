import Link from "next/link";
import type { HealthMemberCard } from "@/types/health";

const STATUS_VARIANT_STYLES: Record<string, { bg: string; color: string }> = {
  warning: { bg: "var(--family-warning)", color: "var(--family-surface)" },
  "primary-soft": { bg: "var(--family-primary-soft)", color: "var(--family-primary)" },
  primary: { bg: "var(--family-primary-soft)", color: "var(--family-primary)" },
  info: { bg: "var(--family-info)", color: "var(--family-surface)" },
  success: { bg: "var(--family-success)", color: "var(--family-surface)" },
  danger: { bg: "var(--family-danger)", color: "var(--family-surface)" },
};

export function HealthCoreMembers({ members }: { members: HealthMemberCard[] }) {
  if (members.length === 0) {
    return (
      <article
        className="surface-panel p-5 sm:p-6 xl:col-span-8"
        style={{
          border: "1px solid var(--family-border)",
          borderRadius: "var(--family-radius-lg)",
          background: "var(--family-surface)",
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="family-h2 text-[22px]">核心对象</h2>
            <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
              暂无成员健康数据
            </p>
          </div>
        </div>
      </article>
    );
  }

  const mainMembers = members.slice(0, 2);
  const extraMembers = members.slice(2);

  return (
    <article
      className="surface-panel p-5 sm:p-6 xl:col-span-8"
      style={{
        border: "1px solid var(--family-border)",
        borderRadius: "var(--family-radius-lg)",
        background: "var(--family-surface)",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="family-h2 text-[22px]">核心对象</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
            只保留当前最值得被照看的健康重点、一个简短标签和下一步，让家庭成员一眼知道要先关心什么。
          </p>
        </div>
        <span
          className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
          style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
        >
          状态优先
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {mainMembers.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      {extraMembers.length > 0 ? (
        <div className="mt-4 space-y-4">
          {extraMembers.map((member) => (
            <WideMemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function MemberCard({ member }: { member: HealthMemberCard }) {
  const variantStyle = STATUS_VARIANT_STYLES[member.status.variant] ?? STATUS_VARIANT_STYLES.primary;

  return (
    <article
      className="member-card rounded-2xl border p-4 sm:p-5 family-transition"
      style={{
        borderColor: "var(--family-border)",
        background: "var(--family-surface)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="avatar-chip inline-flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}
          >
            {member.avatarChar}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="family-h3 truncate text-[18px]">{member.name}</h3>
            <p className="mt-1 truncate text-sm" style={{ color: "var(--family-text-2)" }}>
              {member.tagline}
            </p>
          </div>
        </div>
        <span
          className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
          style={{ background: variantStyle.bg, color: variantStyle.color }}
        >
          {member.status.label}
        </span>
      </div>

      {member.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {member.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium"
              style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {member.description ? (
        <div className="mt-4 space-y-2 text-sm leading-6" style={{ color: "var(--family-text-2)" }}>
          <p>{member.description}</p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-xl border px-3 py-3"
          style={{ borderColor: "var(--family-border)", background: "var(--family-surface-2)" }}
        >
          <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
            近期关注
          </p>
          <p className="mt-2 text-sm font-semibold" style={{ color: "var(--family-text)" }}>
            {member.focus ?? "待补充"}
          </p>
        </div>
        <div
          className="rounded-xl border px-3 py-3"
          style={{ borderColor: "var(--family-border)", background: "var(--family-surface-2)" }}
        >
          <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
            下一步
          </p>
          <p className="mt-2 text-sm font-semibold" style={{ color: "var(--family-text)" }}>
            {member.next ?? "查看完整档案"}
          </p>
        </div>
      </div>

      <Link
        href={`/doc?path=${encodeURIComponent(member.sourcePath)}`}
        className="ghost-btn mt-4 inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold family-transition"
        style={{
          border: "1px solid var(--family-border)",
          background: "var(--family-surface)",
          color: "var(--family-text)",
        }}
      >
        {member.archiveLabel}
        <ArrowRightIcon />
      </Link>
    </article>
  );
}

function WideMemberCard({ member }: { member: HealthMemberCard }) {
  const variantStyle = STATUS_VARIANT_STYLES[member.status.variant] ?? STATUS_VARIANT_STYLES.primary;

  return (
    <article
      className="member-card rounded-2xl border p-4 sm:p-5 family-transition"
      style={{
        borderColor: "var(--family-border)",
        background: "var(--family-surface)",
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span
              className="avatar-chip inline-flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
              style={{ background: "var(--family-primary-soft)", color: "var(--family-primary)" }}
            >
              {member.avatarChar}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="family-h3 truncate text-[18px]">{member.name}</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--family-text-2)" }}>
                {member.tagline}
              </p>
            </div>
          </div>
          {member.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {member.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-medium"
                  style={{ background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {member.description ? (
              <p
                className="rounded-xl border px-3 py-3 text-sm leading-6"
                style={{ borderColor: "var(--family-border)", background: "var(--family-surface-2)", color: "var(--family-text-2)" }}
              >
                {member.description}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <span
            className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold"
            style={{ background: variantStyle.bg, color: variantStyle.color }}
          >
            {member.status.label}
          </span>
          <Link
            href={`/doc?path=${encodeURIComponent(member.sourcePath)}`}
            className="ghost-btn inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold family-transition"
            style={{
              border: "1px solid var(--family-border)",
              background: "var(--family-surface)",
              color: "var(--family-text)",
            }}
          >
            {member.archiveLabel}
            <ArrowRightIcon />
          </Link>
        </div>
      </div>
    </article>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="btn-arrow h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
