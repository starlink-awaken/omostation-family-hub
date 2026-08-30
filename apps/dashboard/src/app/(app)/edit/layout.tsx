import type { ReactNode } from "react";

export default function EditLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="position-fixed"
      style={{
        inset: 0,
        top: 46, /* TopNav height */
        background: "var(--family-bg)",
        zIndex: 20,
      }}
    >
      {children}
    </div>
  );
}
