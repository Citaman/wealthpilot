import { CalendarRange, House, List, Sprout, Upload } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { hrefFor, navigate, pages, type Page } from "./router";
import "./shell.css";

const items: Record<Page, { label: string; icon: ReactNode }> = {
  dashboard: { label: "Dashboard", icon: <House size={20} aria-hidden /> },
  week: { label: "Ma semaine", icon: <CalendarRange size={20} aria-hidden /> },
  plan: { label: "Notre plan", icon: <Sprout size={20} aria-hidden /> },
  transactions: { label: "Transactions", icon: <List size={20} aria-hidden /> },
  import: { label: "Import CSV", icon: <Upload size={20} aria-hidden /> },
};

export function Dock({
  page,
  slotRef,
}: {
  page: Page;
  slotRef: (el: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLElement>(null);

  // The page reserves the dock's real height so nothing ends up under it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        "--dock-h",
        `${el.offsetHeight}px`,
      ),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return;
      const index = Number(event.code.replace("Digit", "")) - 1;
      if (pages[index]) {
        event.preventDefault();
        navigate(pages[index]);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <nav className="dock" ref={ref} aria-label="Navigation principale">
      <ul className="dock-nav">
        {pages.map((p, i) => (
          <li key={p}>
            <a
              className="dock-link"
              href={hrefFor(p)}
              aria-current={p === page ? "page" : undefined}
              title={`${items[p].label} (Alt+${i + 1})`}
            >
              {items[p].icon}
              <span>{items[p].label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="dock-actions" ref={slotRef} />
    </nav>
  );
}
