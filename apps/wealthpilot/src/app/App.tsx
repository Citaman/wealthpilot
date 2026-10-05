import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { useLedger, useLoaded } from "../data/hooks";
import type { Ledger } from "../domain/ledger";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ImportPage } from "../features/import/ImportPage";
import { TransactionsPage } from "../features/transactions/TransactionsPage";
import { WeekPage } from "../features/week/WeekPage";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { Skeleton } from "../ui/Skeleton";
import { ToastView } from "../ui/ToastView";
import { ReadingProvider, useToday } from "./context";
import { Dock } from "./Dock";
import { PageScope } from "./DockSlot";
import { hrefFor, navigate, pages, useRoute, type Page } from "./router";
import { ToastProvider, useToastList } from "./toast";
import "./shell.css";

export interface PageProps {
  ledger: Ledger;
  /** Drilldown parameters from the hash (`#/transactions?cat=…`). */
  params: URLSearchParams;
  active: boolean;
}

const components: Record<Page, ComponentType<PageProps>> = {
  dashboard: DashboardPage,
  week: WeekPage,
  transactions: TransactionsPage,
  import: ImportPage,
};

const titles: Record<Page, string> = {
  dashboard: "Dashboard",
  week: "Ma semaine",
  transactions: "Transactions",
  import: "Import CSV",
};

export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const asOf = useToday();
  const loaded = useLoaded();
  const ledger = useLedger(asOf);
  const route = useRoute();
  const [dockTarget, setDockTarget] = useState<HTMLElement | null>(null);
  const [visited, setVisited] = useState<Set<Page>>(
    () => new Set([route.page]),
  );
  const scroll = useRef(new Map<Page, number>());
  const previous = useRef(route.page);
  const sentToImport = useRef(false);

  // An empty database starts on Import, once; afterwards every page is reachable.
  useEffect(() => {
    if (!loaded || sentToImport.current) return;
    sentToImport.current = true;
    if (!ledger.transactions.length && route.page !== "import")
      navigate("import");
  }, [loaded, ledger.transactions.length, route.page]);

  useLayoutEffect(() => {
    const from = previous.current;
    if (from === route.page) return;
    scroll.current.set(from, scrollY);
    previous.current = route.page;
    setVisited((set) =>
      set.has(route.page) ? set : new Set(set).add(route.page),
    );
    // Drilldowns start at the top; returning to a page restores its position.
    scrollTo(0, route.params.size ? 0 : (scroll.current.get(route.page) ?? 0));
    document
      .querySelector<HTMLElement>(`[data-page="${route.page}"] h1`)
      ?.focus({ preventScroll: true });
  }, [route]);

  useEffect(() => {
    document.title = `${titles[route.page]} · WealthPilot`;
  }, [route.page]);

  return (
    <ReadingProvider ledger={ledger} asOf={asOf}>
      <div className="app">
        <a
          className="logo"
          href={hrefFor("dashboard")}
          aria-label="WealthPilot, Dashboard"
        >
          wealthpilot
          <span className="logo-dots" aria-hidden />
        </a>
        {!loaded ? (
          <div className="first-load" aria-busy="true" aria-label="Chargement">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} shape="card" height="100%" />
            ))}
          </div>
        ) : (
          pages
            .filter((page) => visited.has(page) || page === route.page)
            .map((page) => {
              const Component = components[page];
              const active = page === route.page;
              return (
                <section
                  key={page}
                  className="page"
                  data-page={page}
                  hidden={!active}
                >
                  <h1 className="sr-only" tabIndex={-1}>
                    {titles[page]}
                  </h1>
                  <PageScope target={dockTarget} active={active}>
                    <ErrorBoundary label="Cette page">
                      <Component
                        ledger={ledger}
                        params={active ? route.params : emptyParams}
                        active={active}
                      />
                    </ErrorBoundary>
                  </PageScope>
                </section>
              );
            })
        )}
      </div>
      <Dock page={route.page} slotRef={setDockTarget} />
      <ToastHost />
    </ReadingProvider>
  );
}

const emptyParams = new URLSearchParams();

function ToastHost() {
  const { toasts, dismiss } = useToastList();
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastView
          key={t.id}
          message={t.message}
          tone={t.tone}
          onClose={() => dismiss(t.id)}
          action={
            t.action && {
              label: t.action.label,
              onClick: () => {
                dismiss(t.id);
                void t.action!.run();
              },
            }
          }
        />
      ))}
    </div>
  );
}
