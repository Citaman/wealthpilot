import type { ReactNode } from "react";

/** Ink tooltip bubble anchored above (x, y) inside a positioned chart. */
export function Bubble({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <div className="ui-chart-bubble" style={{ left: x, top: y }} aria-hidden>
      {children}
    </div>
  );
}

export const hatchId = (base: string) =>
  `hatch-${base.replace(/[^a-zA-Z0-9_-]/g, "")}`;

/** 45° stripes in `currentColor`. */
export function HatchPattern({ id }: { id: string }) {
  return (
    <pattern
      id={id}
      width={6}
      height={6}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line x1={1} y1={0} x2={1} y2={6} stroke="currentColor" strokeWidth={2} />
    </pattern>
  );
}
