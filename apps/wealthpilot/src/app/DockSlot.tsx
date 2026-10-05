import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const SlotContext = createContext<{ target: HTMLElement | null; active: boolean }>({
  target: null,
  active: false,
});

/** Lets the dock host the active page's commands while their state stays in the page. */
export function DockSlotProvider({ children }: { children: (setTarget: (el: HTMLElement | null) => void) => ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ target, active: true }}>{children(setTarget)}</SlotContext.Provider>;
}

/** Marks a page subtree as the visible one (only it may fill the dock). */
export function PageScope({ active, children }: { active: boolean; children: ReactNode }) {
  const { target } = useContext(SlotContext);
  return <SlotContext.Provider value={{ target, active }}>{children}</SlotContext.Provider>;
}

export function DockActions({ children }: { children: ReactNode }) {
  const { target, active } = useContext(SlotContext);
  return active && target ? createPortal(children, target) : null;
}
