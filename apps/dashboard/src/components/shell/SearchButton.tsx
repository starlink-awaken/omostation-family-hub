"use client";

export function SearchButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("family:open-search"))}
      className="nav-icon-btn search-btn"
      aria-label="搜索 (Cmd+K)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <span className="search-hint">⌘K</span>
    </button>
  );
}
