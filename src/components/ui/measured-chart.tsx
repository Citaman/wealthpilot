"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MeasuredChartProps {
  className?: string;
  ariaLabel?: string;
  children: (size: { width: number; height: number }) => ReactNode;
}

/**
 * Mounts a chart only after its container has a real size. This avoids the
 * transient -1 Recharts dimensions produced by responsive grids and hidden
 * client boundaries during hydration.
 */
export function MeasuredChart({ className, ariaLabel, children }: MeasuredChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const update = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      const next = { width: Math.floor(width), height: Math.floor(height) };
      setSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };

    update(element.clientWidth, element.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={cn("min-h-0 min-w-0", className)} aria-label={ariaLabel}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  );
}
