"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, useRef, useEffect } from "react";
import { useClickOutside } from "./use-click-outside";
import { NavLink } from "./NavLink";
import type { NavGroup } from "./nav-data";

function DropdownPanel({ group, currentPath, onClose }: { group: NavGroup; currentPath: string; onClose: () => void }) {
  return (
    <div
      className="dropdown-panel"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-1 text-[10px] font-semibold tracking-wider" style={{ color: "var(--family-text-3)" }}>
        <span>{group.icon}</span>
        <span>{group.title}</span>
      </div>
      {group.items.map((item) => {
        const active = item.href === currentPath;
        return (
          <NavLink
            key={item.href}
            href={item.href}
            active={active}
            onClick={onClose}
            badge={item.badge}
          >
            {item.title}
          </NavLink>
        );
      })}
    </div>
  );
}

export function DropdownGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const currentPath = pathname || "/";
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = group.items.some((it) => it.href === currentPath);
  const panelRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  }, [cancelClose]);

  useEffect(() => {
    return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  return (
    <div
      ref={panelRef}
      className="dropdown-root"
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className={`dropdown-trigger ${isActive ? "dropdown-trigger--active" : ""}`}
      >
        <span>{group.title}</span>
        <svg
          className="dropdown-chevron"
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <DropdownPanel group={group} currentPath={currentPath} onClose={() => setOpen(false)} />}
    </div>
  );
}
