import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SlotContext = createContext<{
  target: HTMLElement | null;
  active: boolean;
}>({
  target: null,
  active: false,
});

/** Wraps a mounted page; only the visible one may put commands in the dock. */
export function PageScope({
  target,
  active,
  children,
}: {
  target: HTMLElement | null;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <SlotContext.Provider value={{ target, active }}>
      {children}
    </SlotContext.Provider>
  );
}

/** Renders the page's commands inside the dock; their state stays in the page. */
export function DockActions({ children }: { children: ReactNode }) {
  const { target, active } = useContext(SlotContext);
  return active && target ? createPortal(children, target) : null;
}

/** True while the page is the visible one. */
export const usePageActive = () => useContext(SlotContext).active;
