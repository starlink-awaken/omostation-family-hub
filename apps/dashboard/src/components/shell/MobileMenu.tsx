"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink } from "./NavLink";
import type { NavGroup } from "./nav-data";

type Props = {
  open: boolean;
  onClose: () => void;
  topLevel: { title: string; href: string }[];
  groups: NavGroup[];
};

export function MobileMenu({ open, onClose, topLevel, groups }: Props) {
  const pathname = usePathname();

  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="mobile-menu-overlay" onClick={onClose}>
      <div
        className="mobile-menu-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-menu-header">
          <span className="text-sm font-semibold" style={{ color: "var(--family-text)" }}>导航菜单</span>
          <button onClick={onClose} className="nav-icon-btn" aria-label="关闭菜单">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="mobile-menu-section">
          {topLevel.map((it) => (
            <NavLink key={it.href} href={it.href} active={it.href === pathname}>{it.title}</NavLink>
          ))}
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <div className="mobile-menu-group-label">
              <span>{g.icon}</span>
              <span>{g.title}</span>
            </div>
            <div className="mobile-menu-section">
              {g.items.map((it) => (
                <NavLink
                  key={it.href} href={it.href} active={it.href === pathname} badge={it.badge}
                >
                  {it.title}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
