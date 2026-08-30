"use client";

import { memo, useEffect, useRef } from "react";

const MermaidDocInner = memo(function MermaidDocInner({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mermaidDivs = el.querySelectorAll<HTMLElement>(".mermaid");
    if (mermaidDivs.length === 0) return;

    let cancelled = false;

    import("mermaid").then(async ({ default: mermaid }) => {
      if (cancelled || !el) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        flowchart: { useMaxWidth: true, htmlLabels: true },
        securityLevel: "loose",
      });

      for (const div of Array.from(mermaidDivs)) {
        if (cancelled) return;
        const id = `m-${Math.random().toString(36).slice(2, 8)}`;
        try {
          const raw = div.textContent || "";
          const normalized = raw
            .replace(/\u201c/g, '"')
            .replace(/\u201d/g, '"');
          const { svg } = await mermaid.render(id, normalized);
          div.outerHTML = svg;
        } catch {
          div.outerHTML = `<div style="color:#a04844;font-size:0.8125rem;padding:0.5rem;border:1px solid #f5e0df;border-radius:8px;margin:1rem 0;">图表渲染失败</div>`;
        }
      }
    });

    return () => { cancelled = true; };
  }, [html]);

  return (
    <div
      ref={ref}
      className="md-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export function MermaidDoc(props: { html: string }) {
  return <MermaidDocInner html={props.html} />;
}
