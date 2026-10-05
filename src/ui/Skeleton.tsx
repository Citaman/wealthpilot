import type { CSSProperties } from "react";
import "./Skeleton.css";

export interface SkeletonProps {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  shape?: "text" | "tile" | "card" | "pill";
}

export function Skeleton({
  width = "100%",
  height = "1em",
  shape = "text",
}: SkeletonProps) {
  return (
    <span
      className="ui-skeleton"
      data-shape={shape}
      style={{ width, height }}
      aria-hidden
    />
  );
}
