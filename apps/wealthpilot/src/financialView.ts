import { selectDashboard, today } from "./domain";
import { withEstimates } from "./intelligence";
import type { Snapshot } from "./types";
import { budgetCalendar, budgetCycle, type DateRange } from "./periods";

type Calculation = ReturnType<typeof selectDashboard>;
type Entry = {
  accounts: Snapshot["accounts"];
  budgets: Snapshot["budgets"];
  dues: Snapshot["dues"];
  key: string;
  estimates: Map<string, Snapshot["dues"]>;
  results: Map<string, Calculation>;
};
const cache = new WeakMap<Snapshot["transactions"], Entry[]>();
const presentation = new Set([
  "board",
  "widgets",
  "sizes",
  "tones",
  "widgetViews",
  "budgetOrder",
  "budgetLimit",
  "budgetView",
  "dock",
  "dockPages",
  "setupDone",
]);

export function financialView(
  s: Snapshot,
  month: string,
  account = "",
  from = month,
  asOf = today(),
  range?: DateRange,
) {
  // Unknown future preferences invalidate by default; only known presentation
  // fields are excluded. Source arrays are immutable database snapshots.
  const key = JSON.stringify(
    Object.entries(s.preferences).filter(([name]) => !presentation.has(name)),
  );
  const entries = cache.get(s.transactions) ?? [];
  let entry = entries.find(
    (e) =>
      e.accounts === s.accounts &&
      e.budgets === s.budgets &&
      e.dues === s.dues &&
      e.key === key,
  );
  if (!entry) {
    entry = {
      accounts: s.accounts,
      budgets: s.budgets,
      dues: s.dues,
      key,
      estimates: new Map(),
      results: new Map(),
    };
    cache.set(s.transactions, [entry, ...entries].slice(0, 4));
  }
  const end = [
    range?.to ?? "",
    budgetCycle(month, budgetCalendar(s.transactions, asOf)).to,
  ]
    .sort()
    .at(-1)!;
  const period = `${month}|${asOf}|${end}`;
  let dues = entry.estimates.get(period);
  if (!dues) {
    dues = withEstimates(s, end, asOf).dues;
    entry.estimates.set(period, dues);
    if (entry.estimates.size > 24)
      entry.estimates.delete(entry.estimates.keys().next().value!);
  }
  const projected = { ...s, dues };
  const scope = `${period}|${from}|${account}|${range?.from ?? ""}|${range?.to ?? ""}`;
  let result = entry.results.get(scope);
  if (!result) {
    result = selectDashboard(projected, month, account, asOf, from, range);
    entry.results.set(scope, result);
    if (entry.results.size > 64)
      entry.results.delete(entry.results.keys().next().value!);
  }
  const order = s.preferences.budgetOrder ?? [];
  const rank = (name: string) =>
    order.includes(name) ? order.indexOf(name) : order.length;
  const budgets = [...result.budgets].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.category.localeCompare(b.category, "fr"),
  );
  return { projected, dashboard: { ...result, budgets } };
}
