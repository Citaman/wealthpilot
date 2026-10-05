import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ActivePageId } from "./navigation";

const Context = createContext<{
  route: string;
  host: HTMLDivElement | null;
  setHost: (node: HTMLDivElement | null) => void;
} | null>(null);

/** Keep commands next to their page state while displaying them in the dock. */
export function PageActionsProvider({
  route,
  children,
}: {
  route: string;
  children: ReactNode;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <Context.Provider value={{ route, host, setHost }}>
      {children}
    </Context.Provider>
  );
}

export function PageActions({
  page,
  children,
}: {
  page: ActivePageId;
  children: ReactNode;
}) {
  const context = useContext(Context);
  if (!context) return <>{children}</>;
  return context.route === page && context.host
    ? createPortal(children, context.host)
    : null;
}

export function PageActionsHost() {
  const context = useContext(Context);
  return <div className="dock-page-actions" ref={context?.setHost} />;
}
