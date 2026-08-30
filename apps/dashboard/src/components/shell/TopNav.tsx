"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOP_LEVEL, GROUPS } from "./nav-data";
import { NavLink } from "./NavLink";
import { DropdownGroup } from "./DropdownGroup";
import { ThemeToggle } from "./ThemeToggle";
import { SearchButton } from "./SearchButton";
import { MobileMenu } from "./MobileMenu";

function applyTheme(mode: string) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

export function TopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    const stored = localStorage.getItem("family-theme");
    const initialTheme = stored && ["system", "dark", "light"].includes(stored) ? stored : "system";
    const frame = requestAnimationFrame(() => {
      setTheme(initialTheme);
      applyTheme(initialTheme);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function cycleTheme() {
    setTheme((t) => {
      const next = t === "system" ? "dark" : t === "dark" ? "light" : "system";
      applyTheme(next);
      localStorage.setItem("family-theme", next);
      return next;
    });
  }

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="topnav-left">
          <Link href="/" className="topnav-brand">
            <span className="topnav-brand-title">家庭驾驶舱</span>
            <span className="topnav-brand-sub">家庭生活知识系统</span>
          </Link>

          <nav className="topnav-nav">
            {TOP_LEVEL.map((it) => (
              <NavLink
                key={it.href}
                href={it.href}
                active={it.href === pathname}
              >
                {it.title}
              </NavLink>
            ))}
            {GROUPS.map((g) => (
              <DropdownGroup key={g.title} group={g} />
            ))}
          </nav>
        </div>

        <div className="topnav-right">
          <ThemeToggle theme={theme} onCycle={cycleTheme} />
          <SearchButton />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="nav-icon-btn md-hidden"
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            dangerouslySetInnerHTML={{
              __html: menuOpen
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>`,
            }}
          />
        </div>
      </div>

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        topLevel={TOP_LEVEL}
        groups={GROUPS}
      />
    </header>
  );
}
