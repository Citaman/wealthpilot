import type { ReactNode } from "react";
import "./Badge.css";

export type BadgeTone =
  | "neutral"
  | "estimated"
  | "positive"
  | "negative"
  | "new"
  | "duplicate"
  | "error"
  | "warning";

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className="ui-badge" data-tone={tone} title={title}>
      {children}
    </span>
  );
}
