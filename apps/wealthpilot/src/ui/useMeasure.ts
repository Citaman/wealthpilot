import { useCallback, useState } from "react";

export interface Size {
  width: number;
  height: number;
}

/** Callback ref + content-box size, updated by a ResizeObserver. */
export function useMeasure<T extends Element>(): [
  (element: T | null) => void,
  Size,
] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      // A hidden page measures 0×0: keep the last size so it reappears unchanged.
      if (!box.width && !box.height) return;
      setSize((previous) =>
        Math.round(previous.width) === Math.round(box.width) &&
        Math.round(previous.height) === Math.round(box.height)
          ? previous
          : { width: box.width, height: box.height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}
