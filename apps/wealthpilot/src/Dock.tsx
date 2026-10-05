import { House, CalendarDays, List, Upload } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { PageActionsHost } from "./PageActions";
import { activePageIds, pageLabels, type ActivePageId } from "./navigation";
import "./dock.css";

const icons = {
  dashboard: House,
  week: CalendarDays,
  transactions: List,
  import: Upload,
};

/** Four stable destinations. Historical pinned preferences stay untouched in storage. */
export function Dock({
  route,
  navigate,
  children,
}: {
  route: string;
  navigate: (page: ActivePageId) => void;
  children?: ReactNode;
}) {
  const dock = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = dock.current;
    const shell = node?.closest<HTMLElement>(".app-shell");
    if (!node || !shell) return;
    const measure = () => {
      const space = `${node.offsetHeight + 40}px`;
      shell.style.setProperty("--dock-space", space);
      document.documentElement.style.setProperty("--wp-dock-space", space);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--wp-dock-space");
    };
  }, []);
  return (
    <div className="wp-dock" ref={dock}>
      <div className="wp-dock-bar">
        <nav className="dock-navigation" aria-label="Navigation principale">
          {activePageIds.map((page) => {
            const Icon = icons[page];
            return (
              <div className="wp-dock-slot" key={page}>
                <button
                  aria-current={route === page ? "page" : undefined}
                  onClick={() => navigate(page)}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{pageLabels[page]}</span>
                </button>
              </div>
            );
          })}
        </nav>
        <div className="dock-divider" aria-hidden="true" />
        <section className="dock-context" aria-label="Commandes de la page">
          {children}
          <PageActionsHost />
        </section>
      </div>
    </div>
  );
}
