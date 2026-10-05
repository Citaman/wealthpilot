import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { today } from "../domain/dates";
import type { Ledger } from "../domain/ledger";
import { currentMonthKey, resolvePeriod, type PeriodValue } from "../domain/periods";
import type { DateRange, IsoDate } from "../domain/types";

const keys = {
  account: "wealthpilot-account",
  period: "wealthpilot-period",
  legacyMonth: "wealthpilot-next-month",
};

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the choice simply isn't remembered.
  }
}

export function encodePeriod(p: PeriodValue): string {
  if (p.kind === "month") return `month:${p.key}`;
  if (p.kind === "rolling") return "30d";
  if (p.kind === "months") return `${p.count}m`;
  return "all";
}

/** Reads v2 values and the v1 presets (current|30d|1|3|4|6|12|all|custom). */
export function decodePeriod(value: string | null, legacyMonth: string | null): PeriodValue | null {
  if (!value) return null;
  const month = value.match(/^month:(\d{4}-\d{2})$/);
  if (month) return { kind: "month", key: month[1] };
  if (value === "30d") return { kind: "rolling", days: 30 };
  if (value === "all" || value === "custom") return { kind: "all" };
  const months = value.match(/^(3|6|12)m$/);
  if (months) return { kind: "months", count: Number(months[1]) as 3 | 6 | 12 };
  if (value === "1" && legacyMonth && /^\d{4}-\d{2}$/.test(legacyMonth))
    return { kind: "month", key: legacyMonth };
  if (value === "3" || value === "4") return { kind: "months", count: 3 };
  if (value === "6") return { kind: "months", count: 6 };
  if (value === "12") return { kind: "months", count: 12 };
  return null;
}

/** The calendar day, refreshed when the tab wakes up after midnight. */
export function useToday(): IsoDate {
  const [day, setDay] = useState(today);
  useEffect(() => {
    const refresh = () => setDay(today());
    const timer = setInterval(refresh, 60_000);
    addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return day;
}

export interface ReadingContext {
  asOf: IsoDate;
  /** "" = whole household. */
  account: string;
  setAccount(account: string): void;
  /** null = current budget month. */
  period: PeriodValue | null;
  setPeriod(period: PeriodValue | null): void;
  range: DateRange & { label: string };
}

const Context = createContext<ReadingContext | null>(null);

export function ReadingProvider({
  ledger,
  asOf,
  children,
}: {
  ledger: Ledger;
  asOf: IsoDate;
  children: ReactNode;
}) {
  const [storedAccount, setStoredAccount] = useState(() => read(keys.account) ?? "");
  const [period, setStoredPeriod] = useState<PeriodValue | null>(() =>
    decodePeriod(read(keys.period), read(keys.legacyMonth)),
  );
  // A deleted or restored-away account falls back to the household view.
  const account = ledger.accounts.some((a) => a.id === storedAccount) ? storedAccount : "";

  const value = useMemo<ReadingContext>(() => {
    const current: PeriodValue = { kind: "month", key: currentMonthKey(ledger.calendar, asOf) };
    const range = resolvePeriod(period ?? current, ledger.calendar, asOf);
    return {
      asOf,
      account,
      period,
      range,
      setAccount(next) {
        setStoredAccount(next);
        write(keys.account, next);
      },
      setPeriod(next) {
        setStoredPeriod(next);
        write(keys.period, next ? encodePeriod(next) : "");
      },
    };
  }, [account, asOf, ledger.calendar, period]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReading(): ReadingContext {
  const value = useContext(Context);
  if (!value) throw new Error("useReading outside ReadingProvider");
  return value;
}
