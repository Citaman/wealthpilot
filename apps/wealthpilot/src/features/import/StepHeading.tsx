import { useEffect, useRef, type ReactNode } from "react";

/** Card title text that takes focus when its step appears (after dialogs restore theirs). */
export function StepHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => ref.current?.focus());
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <span ref={ref} tabIndex={-1} className="import-heading">
      {children}
    </span>
  );
}
