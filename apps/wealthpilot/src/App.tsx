import { Select } from "./Select";
import {
  Component,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSnapshot } from "./useSnapshot";
import { Dock } from "./Dock";
import { PageActionsProvider } from "./PageActions";
import { Database } from "lucide-react";
import "./shell.css";
import { isActivePage, resolveActiveRoute } from "./navigation";
import { focusRouteHeading } from "./route-focus";
import type { TransactionDrilldown, TransactionSelection } from "./navigation";
import { today, addDays, dateLabel } from "./domain";
import { useCurrentDate } from "./useCurrentDate";
import {
  budgetCalendar,
  budgetCycle,
  budgetCycleKey,
  periodBounds,
  type DateRange,
} from "./periods";
import { Dashboard } from "./Dashboard";
import { ImportPage } from "./ImportPage";
import { EditorDialog } from "./Editors";
import { Empty } from "./ui";
import { TransactionsPage } from "./TransactionsPage";
import { WeekPage } from "./WeekPage";
const routeFromHash = () => resolveActiveRoute(location.hash);
function savedMonth() {
  try {
    const value = localStorage.getItem("wealthpilot-next-month");
    return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
      ? value
      : today().slice(0, 7);
  } catch {
    return today().slice(0, 7);
  }
}
export function App() {
  const snapshot = useSnapshot();
  const asOf = useCurrentDate();
  const [route, setRoute] = useState(routeFromHash()),
    [month, setMonth] = useState(savedMonth),
    [account, setAccount] = useState(() => {
      try {
        return localStorage.getItem("wealthpilot-account") ?? "";
      } catch {
        return "";
      }
    }),
    [period, setPeriod] = useState(() => {
      try {
        const value = localStorage.getItem("wealthpilot-period") ?? "current";
        return [
          "current",
          "30d",
          "1",
          "3",
          "4",
          "6",
          "12",
          "all",
          "custom",
        ].includes(value)
          ? value
          : "current";
      } catch {
        return "current";
      }
    }),
    [customFrom, setCustomFrom] = useState(() => {
      try {
        const value = localStorage.getItem("wealthpilot-custom-from");
        return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
          ? value
          : savedMonth();
      } catch {
        return savedMonth();
      }
    }),
    [toast, setToast] = useState("");
  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const [drillRange, setDrillRange] = useState<DateRange>();
  const dataToolsButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const opened = useRef(false);
  const transactionOpened = useRef(route === "transactions");
  const weekOpened = useRef(route === "week");
  useEffect(() => {
    if (route === "week") weekOpened.current = true;
  }, [route]);
  useEffect(() => focusRouteHeading(), [route]);
  const [transactionFilter, setTransactionFilter] = useState<
    {
      category: string;
      revision: number;
    } & TransactionSelection
  >();
  useEffect(() => {
    if (route === "transactions" && !transactionOpened.current) {
      transactionOpened.current = true;
    }
  }, [route]);
  useEffect(() => {
    if (snapshot && !opened.current) {
      opened.current = true;
      if (!snapshot.transactions.length) {
        location.hash = "import";
        setRoute("import");
      }
    }
  }, [snapshot]);
  useEffect(() => {
    try {
      localStorage.setItem("wealthpilot-next-month", month);
      localStorage.setItem("wealthpilot-period", period);
      localStorage.setItem("wealthpilot-custom-from", customFrom);
      localStorage.setItem("wealthpilot-account", account);
    } catch {
      /* Context only; financial data uses IndexedDB. */
    }
  }, [month, period, customFrom, account]);
  useEffect(() => {
    if (snapshot && account && !snapshot.accounts.some((a) => a.id === account))
      setAccount("");
  }, [snapshot, account]);
  useEffect(() => {
    const update = () => setRoute(routeFromHash());
    addEventListener("hashchange", update);
    return () => {
      removeEventListener("hashchange", update);
      clearTimeout(timer.current);
    };
  }, []);
  const notify = useCallback((message: string) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 6500);
  }, []);
  const navigate = useCallback(
    (next: string) => {
      if (!isActivePage(next)) {
        notify(
          "Cette fonction n’est pas proposée dans les quatre pages actuelles. Vos données sont conservées.",
        );
        return;
      }
      location.hash = next;
      setRoute(next);
      window.scrollTo({ top: 0, behavior: "instant" });
    },
    [notify],
  );
  const importPage = useCallback(() => navigate("import"), [navigate]);
  const navigatePage = useCallback(
    (page: string, scope: { account: string; month: string }) => {
      if (!isActivePage(page)) {
        navigate(page);
        return;
      }
      setAccount(scope.account);
      setMonth(scope.month);
      setDrillRange(undefined);
      navigate(page);
    },
    [navigate],
  );
  const transactionsPage = useCallback(
    (category = "", context?: TransactionDrilldown) => {
      transactionOpened.current = true;
      if (context) {
        setAccount(context.account);
        setMonth(context.month);
        setCustomFrom(context.from);
        setPeriod(context.from === context.month ? "1" : "custom");
        setDrillRange(context.range);
      }
      setTransactionFilter((previous) => ({
        ...context,
        category,
        revision: (previous?.revision ?? 0) + 1,
      }));
      navigate("transactions");
    },
    [navigate],
  );
  if (!snapshot)
    return (
      <div className="loading-page">
        <div className="wordmark">
          wealthpilot
          <span className="brand-dots">
            <i />
            <i />
          </span>
        </div>
        <p>Ouverture de votre espace local…</p>
      </div>
    );
  const calendar = budgetCalendar(snapshot.transactions, asOf);
  const currentCycle = budgetCycleKey(asOf, calendar);
  const months = [
    ...new Set([
      currentCycle,
      ...snapshot.transactions
        .filter((t) => t.date <= asOf)
        .map((t) => budgetCycleKey(t.date, calendar)),
    ]),
  ]
    .sort()
    .reverse();
  const selectedMonth =
    period === "current" || period === "30d" || month > currentCycle
      ? currentCycle
      : (months.find((m) => m <= month) ?? months.at(-1)!);
  const selectedFrom =
    months.find((m) => m <= customFrom && m <= selectedMonth) ?? months.at(-1)!;
  const from =
    period === "all"
      ? (months.at(-1) ?? selectedMonth)
      : period === "custom"
        ? selectedFrom
        : period === "30d"
          ? budgetCycleKey(addDays(asOf, -29), calendar)
          : months[
              Math.min(
                months.length - 1,
                months.indexOf(selectedMonth) + (Number(period) || 1) - 1,
              )
            ];
  const range =
    drillRange ??
    (period === "30d"
      ? { from: addDays(asOf, -29), to: asOf }
      : periodBounds(from, selectedMonth, calendar));
  const cycleLabel = (key: string) =>
    new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(new Date(key + "-15"));
  const describePeriod = (key: string) => {
    const dates = budgetCycle(key, calendar);
    const observed = calendar.observed.some((p) => p.month === key);
    const endKnown = calendar.observed.some(
      (p) => p.date === addDays(dates.to, 1),
    );
    const endEstimated = calendar.projected.some(
      (p) => p.date === addDays(dates.to, 1),
    );
    const actualEnd = dates.to < asOf ? dates.to : asOf;
    const actual = `${dateLabel(dates.from)} — ${dateLabel(actualEnd)}`;
    if (!observed)
      return (
        actual +
        (calendar.observed.length
          ? " · historique initial partiel"
          : " · revenu régulier non identifié, mois civil provisoire")
      );
    return (
      actual +
      " · premier revenu du foyer" +
      (endKnown
        ? ""
        : endEstimated
          ? ` · prochaine frontière estimée : ${dateLabel(addDays(dates.to, 1))}`
          : " · prochaine frontière inconnue")
    );
  };
  const periodDescription = describePeriod(selectedMonth);
  const clearDrill = () => setDrillRange(undefined);
  const filters =
    route === "dashboard" || route === "transactions" || route === "week" ? (
      <div className="dock-filters">
        <label className="sr-only" htmlFor="account-filter">
          Compte affiché
        </label>
        <Select
          id="account-filter"
          side="top"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">Tous les comptes</option>
          {snapshot.accounts.map((a) => (
            <option key={a.id}>{a.id}</option>
          ))}
        </Select>
        {route !== "week" && (
          <>
            <label className="sr-only" htmlFor="period-filter">
              Période affichée
            </label>
            <Select
              id="period-filter"
              side="top"
              value={period}
              onChange={(e) => {
                clearDrill();
                setPeriod(e.target.value);
                setMonth(selectedMonth);
              }}
            >
              <option value="current">Mois en cours</option>
              <option value="30d">30 derniers jours</option>
              <option value="1">Un mois</option>
              <option value="3">Trois mois</option>
              <option value="4">Quatre mois</option>
              <option value="6">Six mois</option>
              <option value="12">Un an</option>
              <option value="all">Tout l’historique</option>
              <option value="custom">Période personnalisée</option>
            </Select>
            {period === "custom" && (
              <label className="field period-start">
                <span>Depuis</span>
                <Select
                  aria-label="Début de période"
                  side="top"
                  value={selectedFrom}
                  onChange={(e) =>
                    e.target.value &&
                    (clearDrill(), setCustomFrom(e.target.value))
                  }
                >
                  {months
                    .filter((m) => m <= selectedMonth)
                    .map((m) => (
                      <option
                        key={m}
                        value={m}
                        data-description={describePeriod(m)}
                      >
                        {cycleLabel(m)}
                      </option>
                    ))}
                </Select>
              </label>
            )}
            {period !== "30d" && (
              <>
                <label className="sr-only" htmlFor="month-filter">
                  Mois budgétaire affiché
                </label>
                <Select
                  id="month-filter"
                  title={periodDescription}
                  aria-describedby="budget-period-description"
                  side="top"
                  value={selectedMonth}
                  onChange={(e) => {
                    clearDrill();
                    setMonth(e.target.value);
                    if (period === "current") setPeriod("1");
                  }}
                >
                  {months.map((m) => (
                    <option
                      value={m}
                      key={m}
                      data-description={describePeriod(m)}
                    >
                      {cycleLabel(m)}
                    </option>
                  ))}
                </Select>
                <span id="budget-period-description" className="sr-only">
                  {periodDescription}
                </span>
              </>
            )}
          </>
        )}
      </div>
    ) : null;
  return (
    <PageActionsProvider route={route}>
      <div className="app-shell">
        <div className="app-brand">
          <button
            className="brand-button"
            onClick={() => navigate("dashboard")}
            aria-label="WealthPilot, dashboard"
          >
            <span className="wordmark">
              wealthpilot
              <span className="brand-dots" aria-hidden="true">
                <i />
                <i />
              </span>
            </span>
          </button>
        </div>
        <div hidden={route !== "dashboard"}>
          <Dashboard
            snapshot={snapshot}
            month={selectedMonth}
            account={account}
            from={from}
            range={range}
            transactionsPage={transactionsPage}
            navigatePage={navigatePage}
            importPage={importPage}
            notify={notify}
          />
        </div>
        <div hidden={route !== "import"}>
          <ImportPage
            active={route === "import"}
            snapshot={snapshot}
            notify={notify}
            onImported={() => {
              setMonth(currentCycle);
              setPeriod("current");
              clearDrill();
              setAccount("");
              navigate("dashboard");
            }}
          />
          {dataToolsOpen && (
            <section className="page" aria-label="Sauvegarde locale">
              <div id="import-data-tools">
                <EditorDialog
                  inline
                  kind="data"
                  snapshot={snapshot}
                  month={selectedMonth}
                  category=""
                  notify={notify}
                  onClose={() => {
                    setDataToolsOpen(false);
                    dataToolsButton.current?.focus();
                  }}
                />
              </div>
            </section>
          )}
        </div>
        <div hidden={route !== "transactions"}>
          {(transactionOpened.current || route === "transactions") && (
            <TransactionsPage
              snapshot={snapshot}
              from={from}
              month={selectedMonth}
              range={{
                from: range.from,
                to: range.to > asOf ? asOf : range.to,
              }}
              account={account}
              navigationFilter={transactionFilter}
              notify={notify}
            />
          )}
        </div>
        <div hidden={route !== "week"}>
          {(weekOpened.current || route === "week") && (
            <WeekPage snapshot={snapshot} account={account} notify={notify} />
          )}
        </div>
        {route === "unavailable" && (
          <main className="page">
            <Empty
              title="Cette page n’est plus proposée."
              action="Ouvrir le dashboard"
              onAction={() => navigate("dashboard")}
            >
              L’application se concentre sur Dashboard, Ma semaine, Transactions
              et Import CSV. Vos données existantes sont conservées.
            </Empty>
          </main>
        )}
        <Dock route={route} navigate={navigate}>
          {filters}
          {route === "import" && (
            <button
              ref={dataToolsButton}
              className="dock-action"
              aria-label="Sauvegarder ou restaurer mes données"
              aria-expanded={dataToolsOpen}
              aria-controls="import-data-tools"
              onClick={() => {
                setDataToolsOpen(!dataToolsOpen);
                if (!dataToolsOpen)
                  requestAnimationFrame(() =>
                    document
                      .getElementById("import-data-tools")
                      ?.scrollIntoView({ block: "start", behavior: "instant" }),
                  );
              }}
            >
              <Database size={18} />
              <span>Sauvegardes</span>
            </button>
          )}
        </Dock>
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button
              aria-label="Fermer la notification"
              onClick={() => setToast("")}
            >
              ×
            </button>
          </div>
        )}
      </div>
    </PageActionsProvider>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="page">
        <Empty
          title="L’espace local n’a pas pu s’ouvrir."
          action="Réessayer"
          onAction={() => location.reload()}
        >
          {this.state.error.message}. Vos anciennes bases ne sont pas modifiées.
          Vérifiez que ce navigateur autorise le stockage local.
        </Empty>
      </main>
    ) : (
      this.props.children
    );
  }
}
