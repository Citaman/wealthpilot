import { useSyncExternalStore } from "react";
import { today } from "./domain";

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout>;
function refresh() {
  clearTimeout(timer);
  listeners.forEach((listener) => listener());
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  timer = setTimeout(refresh, midnight.getTime() - Date.now() + 50);
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    }
  };
}
export const useCurrentDate = () =>
  useSyncExternalStore(subscribe, today, today);
