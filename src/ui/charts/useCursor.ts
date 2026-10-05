import { useState, type KeyboardEvent } from "react";

/**
 * Index-based cursor shared by interactive charts: pointer hover sets it,
 * ←/→/Home/End move it, Enter selects. Keyboard focus keeps it visible.
 */
export function useCursor(
  count: number,
  onSelect?: (index: number) => void,
  initial?: number,
) {
  const [index, setIndex] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const clampIndex = (value: number) => Math.min(count - 1, Math.max(0, value));

  const onKeyDown = (event: KeyboardEvent) => {
    if (!count) return;
    const current = index ?? initial ?? count - 1;
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      Home: 0,
      End: count - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      setIndex(clampIndex(moves[event.key]));
    } else if ((event.key === "Enter" || event.key === " ") && onSelect) {
      event.preventDefault();
      onSelect(current);
    } else if (event.key === "Escape") setIndex(null);
  };

  return {
    index,
    setIndex,
    focused,
    handlers: {
      onKeyDown,
      onFocus: () => {
        setFocused(true);
        setIndex((value) => value ?? clampIndex(initial ?? count - 1));
      },
      onBlur: () => {
        setFocused(false);
        setIndex(null);
      },
      onPointerLeave: () => {
        if (!focused) setIndex(null);
      },
    },
  };
}
