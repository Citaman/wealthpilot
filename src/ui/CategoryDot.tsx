import type { CSSProperties } from "react";
import "./CategoryDot.css";

export function CategoryDot({
  color,
  size = 8,
  label,
}: {
  color: string;
  size?: 8 | 10 | 12 | 16;
  label?: string;
}) {
  return (
    <span
      className="ui-dot"
      style={{ "--dot": color, "--dot-size": `${size}px` } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
