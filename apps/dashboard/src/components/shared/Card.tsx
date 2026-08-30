import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: "sm" | "md" | "lg" | "none";
  hover?: boolean;
  as?: "div" | "section" | "article" | "li";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

export function Card({
  children,
  className = "",
  style,
  padding = "md",
  hover = false,
  as: Tag = "div",
}: CardProps) {
  return (
    <Tag
      className={`rounded-xl border ${paddingMap[padding]} ${hover ? "transition-shadow hover:shadow-sm" : ""} ${className}`}
      style={{
        borderColor: "var(--family-border)",
        background: "var(--family-surface)",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
