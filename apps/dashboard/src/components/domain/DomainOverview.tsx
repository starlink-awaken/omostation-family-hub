import Link from "next/link";
import type { DomainData } from "@/types/domain";
import type { GroupedItems } from "@/lib/grouping";

export function DomainOverview({
  data,
  groups,
}: {
  data: DomainData;
  groups?: GroupedItems[];
}) {
  const list = groups && groups.length ? groups : [{ title: "条目概览", items: data.items }];
  const hasExtras =
    (data.focus?.length ?? 0) > 0 ||
    (data.nextActions?.length ?? 0) > 0 ||
    (data.links?.length ?? 0) > 0;

  function normalizeHref(href: string): string {
    if (!href.startsWith("/doc?")) {
      return href;
    }

    const queryIndex = href.indexOf("?");
    if (queryIndex === -1) {
      return href;
    }

    const params = new URLSearchParams(href.slice(queryIndex + 1));
    const pathValue = params.get("path");
    if (!pathValue) {
      return href;
    }

    params.set("path", pathValue);
    return `/doc?${params.toString()}`;
  }

  function isExternalHref(href: string): boolean {
    return href.startsWith("http://") || href.startsWith("https://");
  }

  return (
    <div className="space-y-6">
      <section
        className="rounded-2xl border p-5 sm:p-6"
        style={{
          borderColor: "var(--family-border)",
          background: "var(--family-surface)",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold">{data.overview.title}</h1>
            {data.overview.description ? (
              <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
                {data.overview.description}
              </p>
            ) : null}

            {hasExtras ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.focus.length ? (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface-2)",
                    }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--family-text-3)" }}
                    >
                      重点
                    </p>
                    <div className="mt-2 space-y-2">
                      {data.focus.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-sm">
                          {item.sourcePath ? (
                            <Link
                              href={`/doc?path=${encodeURIComponent(item.sourcePath)}`}
                              className="underline underline-offset-4"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                          {item.summary ? (
                            <div className="mt-1 text-xs" style={{ color: "var(--family-text-2)" }}>
                              {item.summary}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface-2)",
                    }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--family-text-3)" }}
                    >
                      重点
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
                      暂无
                    </p>
                  </div>
                )}

                {data.nextActions.length ? (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface-2)",
                    }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--family-text-3)" }}
                    >
                      下一步
                    </p>
                    <div className="mt-2 space-y-2">
                      {data.nextActions.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-sm">
                          {item.sourcePath ? (
                            <Link
                              href={`/doc?path=${encodeURIComponent(item.sourcePath)}`}
                              className="underline underline-offset-4"
                            >
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                          {item.summary ? (
                            <div className="mt-1 text-xs" style={{ color: "var(--family-text-2)" }}>
                              {item.summary}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface-2)",
                    }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--family-text-3)" }}
                    >
                      下一步
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
                      暂无
                    </p>
                  </div>
                )}

                {data.links.length ? (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface-2)",
                    }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--family-text-3)" }}
                    >
                      快捷入口
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {data.links.slice(0, 6).map((entry) => {
                        const href = normalizeHref(entry.href);
                        const external = isExternalHref(href);
                        return (
                          <Link
                            key={`${entry.title}-${href}`}
                            href={href}
                            className="rounded-full border px-3 py-1 text-xs"
                            style={{
                              borderColor: "var(--family-border)",
                              background: "var(--family-surface)",
                            }}
                            target={external ? "_blank" : undefined}
                            rel={external ? "noreferrer" : undefined}
                          >
                            {entry.title}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      borderColor: "var(--family-border)",
                      background: "var(--family-surface-2)",
                    }}
                  >
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--family-text-3)" }}
                    >
                      快捷入口
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--family-text-2)" }}>
                      暂无
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[280px] lg:flex-none">
            <div
              className="rounded-2xl border p-3"
              style={{
                borderColor: "var(--family-border)",
                background: "var(--family-surface-2)",
              }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
                聚合数量
              </p>
              <p className="mt-2 text-lg font-semibold">{data.overview.totalCount}</p>
            </div>
            <div
              className="rounded-2xl border p-3"
              style={{
                borderColor: "var(--family-border)",
                background: "var(--family-surface-2)",
              }}
            >
              <p className="text-xs font-medium" style={{ color: "var(--family-text-3)" }}>
                来源文件
              </p>
              <p className="mt-2 text-lg font-semibold">{data.overview.sourceCount}</p>
            </div>
          </div>
        </div>
      </section>

      {list.map((group) => (
        <section
          key={group.title}
          className="rounded-2xl border p-5"
          style={{
            borderColor: "var(--family-border)",
            background: "var(--family-surface)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">{group.title}</div>
            <div className="text-xs" style={{ color: "var(--family-text-3)" }}>
              {group.items.length} 条
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {group.items.length ? (
              group.items.slice(0, 6).map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border px-4 py-3"
                  style={{
                    borderColor: "var(--family-border)",
                    background: "var(--family-surface-2)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold">
                      {item.sourcePath ? (
                        <Link
                          href={`/doc?path=${encodeURIComponent(item.sourcePath)}`}
                          className="underline underline-offset-4"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </div>
                    {item.sourceTitle ? (
                      <div
                        className="text-xs"
                        style={{ color: "var(--family-text-3)" }}
                      >
                        {item.sourceTitle}
                      </div>
                    ) : null}
                  </div>
                  {item.summary ? (
                    <p
                      className="mt-2 text-sm"
                      style={{ color: "var(--family-text-2)" }}
                    >
                      {item.summary}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <div
                className="rounded-xl border px-4 py-3 text-sm"
                style={{
                  borderColor: "var(--family-border)",
                  background: "var(--family-surface-2)",
                  color: "var(--family-text-2)",
                }}
              >
                暂无聚合条目
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
