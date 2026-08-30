"use client";

import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  badge?: string;
};

export function NavLink({ href, children, active, onClick, className = "", badge }: Props) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`nav-link group ${active ? "nav-link--active" : ""} ${className}`}
    >
      {children}
      {badge && <span className="nav-badge">{badge}</span>}
    </Link>
  );
}
