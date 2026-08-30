"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function DocImagePreview({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const imgs = el.querySelectorAll<HTMLImageElement>(
      ".md-body img, .family-doc-content img, .rounded-2xl img"
    );
    const handlers: (() => void)[] = [];
    imgs.forEach((img) => {
      const handler = () => {
        const src = img.getAttribute("src");
        if (src && !src.startsWith("data:")) setPreviewSrc(src);
        else {
          // For relative image paths, resolve against API
          const srcAttr = src || img.src;
          if (srcAttr) setPreviewSrc(srcAttr);
        }
      };
      img.style.cursor = "zoom-in";
      img.addEventListener("click", handler);
      handlers.push(() => img.removeEventListener("click", handler));
    });
    return () => handlers.forEach((h) => h());
  }, [children]);

  return (
    <>
      <div ref={containerRef}>{children}</div>
      {previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.8)", cursor: "zoom-out" }}
          onClick={() => setPreviewSrc(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setPreviewSrc(null)}
            className="absolute border-0 bg-transparent flex items-center justify-center"
            style={{
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.4)",
              color: "#fff",
              fontSize: "1.25rem",
              cursor: "pointer",
              zIndex: 1,
            }}
            aria-label="关闭"
          >
            ✕
          </button>
          <img
            src={previewSrc}
            alt="预览图片"
            className="block"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              borderRadius: 8,
              objectFit: "contain",
              cursor: "default",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
