"use client";

type Props = {
  theme: string;
  onCycle: () => void;
};

export function ThemeToggle({ theme, onCycle }: Props) {
  const isDark = theme === "dark";
  return (
    <button
      onClick={onCycle}
      className="nav-icon-btn"
      aria-label={isDark ? "切换到亮色模式" : "切换到暗色模式"}
      dangerouslySetInnerHTML={{
        __html: isDark
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
      }}
    />
  );
}
