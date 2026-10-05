import type {
  Snapshot,
  Transaction,
  Due,
  Goal,
  WidgetId,
  WidgetSize,
} from "./types";
import {
  addDays,
  monthEnd,
  today,
  parseMoney,
  parseDate,
  balanceAt,
} from "./domain";
import { normalize } from "./search";
import { budgetCalendar, budgetCycle, budgetCycleKey } from "./periods";

export const allGoals = (s: Snapshot) => [
  ...(s.preferences.goal ? [s.preferences.goal] : []),
  ...(s.preferences.extraGoals ?? []),
];
export const goalReserve = (s: Snapshot) =>
  allGoals(s).reduce((n, g) => n + g.saved, 0);
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 15)).toISOString().slice(0, 7);
}
export function monthRange(from: string, to: string) {
  const months: string[] = [];
  for (let m = from; m <= to && months.length < 120; m = shiftMonth(m, 1))
    months.push(m);
  return months;
}
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const median = (n: number[]) => {
  const a = [...n].sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : 0;
};
const distance = (a: string, b: string) =>
  Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
export { recurrenceIdentity } from "./transactionIdentity";
import { recurrenceIdentity } from "./transactionIdentity";
export interface Recurrence {
  aliases?: string[];
  confirmed?: boolean;
  paused?: boolean;
  ruleId?: string;
  end?: string;
  key: string;
  name: string;
  account: string;
  amount: number;
  category: string;
  frequency: "monthly" | "weekly";
  confidence: number;
  count: number;
  last: string;
  next: string;
  day: number;
  minimum: number;
  maximum: number;
  sourceIds: string[];
}
export function detectRecurrences(
  tx: Transaction[],
  asOf = today(),
): Recurrence[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of tx) {
    if (
      t.internal ||
      !t.amount ||
      t.date > asOf ||
      t.date < addDays(asOf, -370)
    )
      continue;
    const name = recurrenceIdentity(t);
    if (name.length < 3) continue;
    const key = JSON.stringify([t.account, name, Math.sign(t.amount)]);
    const group = groups.get(key);
    if (group) group.push(t);
    else groups.set(key, [t]);
  }
  const result: Recurrence[] = [];
  for (const [key, raw] of groups) {
    const rows = raw.toSorted((a, b) => a.date.localeCompare(b.date));
    const recent = rows.slice(-8);
    if (
      recent.length < 3 ||
      new Set(recent.map((t) => t.date)).size !== recent.length
    )
      continue;
    const amounts = recent.map((t) => t.amount),
      amount = median(amounts);
    // One exceptional positive payment (e.g. a bonus) must not erase an otherwise
    // repeated income. Never extrapolate a single payment or an irregular sender.
    const stable = amounts.filter(
      (n) => Math.abs(n - amount) <= Math.max(150, Math.abs(amount) * 0.15),
    );
    const robustIncome =
      amount > 0 &&
      stable.length >= 3 &&
      stable.length / amounts.length >= 0.75;
    if (stable.length !== amounts.length && !robustIncome) continue;
    const gaps = recent
      .slice(1)
      .map((t, i) => distance(t.date, recent[i].date));
    const monthly = gaps.every((g) => g >= 25 && g <= 35);
    const weekly = gaps.every((g) => g >= 5 && g <= 9);
    if (!monthly && !weekly) continue;
    const last = recent.at(-1)!;
    if (distance(asOf, last.date) > (monthly ? 45 : 12)) continue;
    const day = median(recent.map((t) => Number(t.date.slice(8))));
    const nextMonth = shiftMonth(last.date.slice(0, 7), 1);
    const next = monthly
      ? nextMonth +
        "-" +
        String(Math.min(day, Number(monthEnd(nextMonth).slice(8)))).padStart(
          2,
          "0",
        )
      : addDays(last.date, 7);
    result.push({
      key,
      aliases: [
        ...new Set(
          rows.map((t) =>
            JSON.stringify([
              t.account,
              norm(t.merchant || t.label),
              Math.sign(t.amount),
            ]),
          ),
        ),
      ],
      name: last.merchant || last.label,
      account: last.account,
      category: last.category,
      amount,
      frequency: monthly ? "monthly" : "weekly",
      count: recent.length,
      last: last.date,
      next,
      day,
      minimum: Math.min(...amounts),
      maximum: Math.max(...amounts),
      sourceIds: recent.map((t) => t.id),
      confidence:
        stable.length !== amounts.length ? 65 : recent.length >= 5 ? 90 : 70,
    });
  }
  return result.sort((a, b) => a.next.localeCompare(b.next));
}
export function activeRecurrences(s: Snapshot, asOf = today()): Recurrence[] {
  const detected = detectRecurrences(s.transactions, asOf);
  const rules = s.preferences.recurrenceRules ?? [];
  const configured = rules.map((rule) => {
    const source = detected.find(
      (r) =>
        r.key === rule.sourceKey ||
        r.aliases?.includes(rule.sourceKey ?? "") ||
        (r.account === rule.account &&
          norm(r.name) === norm(rule.name) &&
          Math.sign(r.amount) === Math.sign(rule.amount)),
    );
    return {
      key: source?.key ?? rule.sourceKey ?? "rule:" + rule.id,
      aliases: [
        ...new Set([
          ...(source?.aliases ?? []),
          ...(rule.sourceKey ? [rule.sourceKey] : []),
        ]),
      ],
      ruleId: rule.id,
      name: rule.name,
      account: rule.account,
      amount: rule.amount,
      category: rule.category,
      frequency: rule.frequency,
      next: rule.next,
      day: Number(rule.next.slice(8)),
      last: source?.last ?? "",
      minimum: source?.minimum ?? rule.amount,
      maximum: source?.maximum ?? rule.amount,
      sourceIds: source?.sourceIds ?? [],
      count: source?.count ?? 0,
      confidence: 100,
      confirmed: true,
      paused: rule.paused,
      end: rule.end,
    };
  });
  return [
    ...configured,
    ...detected
      .filter((r) => !configured.some((c) => c.key === r.key))
      .map((r) => ({
        ...r,
        paused: [r.key, ...(r.aliases ?? [])].some((key) =>
          s.preferences.dismissedRecurrences?.includes(key),
        ),
      })),
  ].sort((a, b) => a.next.localeCompare(b.next));
}
export function estimatedDues(s: Snapshot, end: string, asOf = today()): Due[] {
  const events: Due[] = [];
  for (const r of activeRecurrences(s, asOf)) {
    if (r.paused) continue;
    const dates: string[] = [];
    let date = r.next;
    const earliest = addDays(asOf, -5);
    if (r.frequency === "weekly" && date < earliest)
      date = addDays(
        date,
        Math.max(0, Math.ceil(distance(earliest, date) / 7)) * 7,
      );
    if (r.frequency === "monthly" && date.slice(0, 7) < earliest.slice(0, 7)) {
      const m = earliest.slice(0, 7);
      date =
        m +
        "-" +
        String(Math.min(r.day, Number(monthEnd(m).slice(8)))).padStart(2, "0");
    }
    for (let i = 0; date <= end && (!r.end || date <= r.end) && i < 130; i++) {
      if (date >= addDays(asOf, -5)) dates.push(date);
      if (r.frequency === "weekly") date = addDays(date, 7);
      else {
        const m = shiftMonth(date.slice(0, 7), 1);
        date =
          m +
          "-" +
          String(Math.min(r.day, Number(monthEnd(m).slice(8)))).padStart(
            2,
            "0",
          );
      }
    }
    // One payment (or its linked manual due) can cover only one occurrence.
    // A ±4-day tolerance otherwise consumes two adjacent weekly occurrences.
    const resources = [
      ...s.transactions
        .filter(
          (t) =>
            !t.internal &&
            t.account === r.account &&
            (norm(t.merchant || t.label) === norm(r.name) ||
              JSON.stringify([
                t.account,
                recurrenceIdentity(t),
                Math.sign(t.amount),
              ]) === r.key),
        )
        .map((t) => ({
          key: "transaction:" + t.id,
          date: t.date,
          amount: t.amount,
        })),
      ...s.dues
        .filter(
          (d) =>
            !d.originOccurrenceId &&
            d.account === r.account &&
            (d.recurrenceKey === r.key ||
              r.aliases?.includes(d.recurrenceKey ?? "") ||
              norm(d.label) === norm(r.name)),
        )
        .map((d) => ({
          key: d.transactionId
            ? "transaction:" + d.transactionId
            : "due:" + d.id,
          date: d.date,
          amount: d.amount,
        })),
    ];
    const matches = dates
      .flatMap((date) =>
        resources
          .filter(
            (v) =>
              Math.sign(v.amount) === Math.sign(r.amount) &&
              Math.abs(v.amount - r.amount) <=
                Math.max(150, Math.abs(r.amount) * 0.2) &&
              Math.abs(distance(v.date, date)) <= 4,
          )
          .map((v) => ({
            date,
            key: v.key,
            gap: Math.abs(distance(v.date, date)),
          })),
      )
      .sort(
        (a, b) =>
          a.gap - b.gap ||
          a.date.localeCompare(b.date) ||
          a.key.localeCompare(b.key),
      );
    const coveredDates = new Set<string>(),
      usedResources = new Set<string>();
    for (const match of matches) {
      if (coveredDates.has(match.date) || usedResources.has(match.key))
        continue;
      coveredDates.add(match.date);
      usedResources.add(match.key);
    }
    for (const date of dates)
      if (
        !coveredDates.has(date) &&
        ![r.key, ...(r.aliases ?? [])].some((key) => {
          const id = "estimate:" + key + ":" + date;
          return (
            s.dues.some((d) => d.originOccurrenceId === id) ||
            s.preferences.ignoredOccurrences?.includes(id)
          );
        })
      )
        events.push({
          id: "estimate:" + r.key + ":" + date,
          label: r.name,
          amount: r.amount,
          date,
          account: r.account,
          estimated: true,
          confidence: r.confidence,
          recurrenceKey: r.key,
          category: r.category,
          recurrenceConfirmed: r.confirmed,
        });
  }
  return events;
}
export function withEstimates(
  s: Snapshot,
  end: string,
  asOf = today(),
): Snapshot {
  const recorded = {
    ...s,
    dues: s.dues.filter((d) => !d.id.startsWith("estimate:")),
  };
  return {
    ...s,
    dues: [...recorded.dues, ...estimatedDues(recorded, end, asOf)],
  };
}
export function spendingHistory(
  s: Snapshot,
  asOf = today(),
  calendar = budgetCalendar(s.transactions, asOf),
) {
  // Exclude the unfinished cycle; imported activity is not proof of full coverage.
  const day = calendar;
  const boundary = budgetCycle(budgetCycleKey(asOf, day), day).from;
  const months = [
    ...new Set(
      s.transactions
        .filter((t) => t.date < boundary)
        .map((t) => budgetCycleKey(t.date, day)),
    ),
  ]
    .sort()
    .slice(-3);
  const tx = s.transactions.filter(
    (t) => months.includes(budgetCycleKey(t.date, day)) && !t.internal,
  );
  const map = new Map<string, number>();
  for (const t of tx)
    if (t.amount < 0)
      map.set(t.category, (map.get(t.category) ?? 0) - t.amount);
  const n = months.length;
  return {
    months,
    income: n
      ? Math.round(
          tx.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) /
            n,
        )
      : 0,
    categories: [...map]
      .map(([category, total]) => ({
        category,
        average: Math.round(total / Math.max(1, n)),
      }))
      .sort((a, b) => b.average - a.average),
    coverage:
      "Cycles observés dans les fichiers, sans garantie de relevés complets. Le cycle en cours est exclu.",
  };
}
export function suggestBudgets(s: Snapshot, minimum: number, asOf = today()) {
  const history = spendingHistory(s, asOf);
  const monthlyGoals = allGoals(s).reduce((n, g) => n + (g.monthly ?? 0), 0);
  const expenditure = history.categories.reduce((n, c) => n + c.average, 0);
  // Safety is a stock, not a monthly expense: replenish only its observed shortfall.
  const known = s.accounts.length > 0 && s.accounts.every((a) => a.checkpoint);
  const observed = known
    ? s.accounts.reduce(
        (n, a) => n + (balanceAt(a, s.transactions, asOf) ?? 0),
        0,
      )
    : null;
  const topUp = observed === null ? 0 : Math.max(0, minimum - observed);
  const capacity = Math.max(0, history.income - monthlyGoals - topUp);
  const factor = expenditure ? Math.min(1, capacity / expenditure) : 1;
  let remaining = Math.min(expenditure, capacity);
  const categories = history.categories.map((c, i) => {
    const proposed =
      i === history.categories.length - 1
        ? remaining
        : Math.min(remaining, Math.floor(c.average * factor));
    remaining -= proposed;
    return { ...c, proposed, share: expenditure ? c.average / expenditure : 0 };
  });
  return {
    ...history,
    categories,
    expenditure,
    capacity,
    topUp,
    known,
    monthlyGoals,
    factor,
  };
}
// These are the previous repo's DEFAULT_GOALS, not recovered personal balances.
export const legacyGoalTemplates: Goal[] = [
  { name: "Fonds de sécurité", target: 300000, saved: 0 },
  { name: "Entretien voiture", target: 150000, saved: 0 },
  { name: "Vacances en famille", target: 250000, saved: 0 },
  { name: "Grand projet (maison / voiture)", target: 240000, saved: 0 },
  { name: "Épargne enfant 1", target: 120000, saved: 0 },
  { name: "Épargne enfant 2", target: 120000, saved: 0 },
];
const historicGoalNames: Record<string, string> = {
  "emergency fund": "fonds de securite",
  "car maintenance": "entretien voiture",
  "family vacation": "vacances en famille",
  "big plan house car": "grand projet maison voiture",
  "child 1 savings": "epargne enfant 1",
  "child 2 savings": "epargne enfant 2",
};
const goalKey = (g: Goal) =>
  historicGoalNames[normalize(g.name)] ?? normalize(g.name);
export function mergeLegacyGoals(
  current: Goal[],
  incoming: Goal[],
  replace = false,
) {
  const goals = [...current];
  let added = 0,
    replaced = 0,
    skipped = 0;
  for (const goal of incoming) {
    const index = goals.findIndex((g) =>
      g.legacyId && goal.legacyId
        ? g.legacyId === goal.legacyId
        : goalKey(g) === goalKey(goal),
    );
    if (index < 0) {
      goals.push(goal);
      added++;
    } else if (replace) {
      goals[index] = goal;
      replaced++;
    } else skipped++;
  }
  if (goals.length > 101)
    throw new Error(
      "Maximum 101 objectifs. Sélectionnez moins d’objectifs à récupérer.",
    );
  return { goals, added, replaced, skipped };
}
export function goalRecoverySummary(
  result: ReturnType<typeof mergeLegacyGoals>,
) {
  return `${result.added} objectifs ajoutés · ${result.replaced} remplacés · ${result.skipped} conservés sans modification.`;
}
export function readLegacyPlan(value: unknown): {
  goals: Goal[];
  budgets: { category: string; amount: number; month: string }[];
  warnings: string[];
} {
  const v = value as {
    meta?: { formatVersion?: number };
    tables?: {
      goals?: Record<string, unknown>[];
      budgets?: Record<string, unknown>[];
      accounts?: Record<string, unknown>[];
    };
  };
  if (
    v?.meta?.formatVersion !== 1 ||
    !Array.isArray(v.tables?.goals) ||
    !Array.isArray(v.tables?.budgets)
  )
    throw new Error(
      "Choisissez une sauvegarde JSON non chiffrée de l’ancien WealthPilot.",
    );
  const money = (n: unknown) => {
    const c = typeof n === "number" ? parseMoney(String(n)) : null;
    if (c === null || c < 0)
      throw new Error("Montant invalide dans la sauvegarde.");
    return c;
  };
  const warnings: string[] = [];
  const goals = v.tables.goals
    .filter((g) => g.isActive !== false)
    .flatMap((g): Goal[] => {
      if (typeof g.name !== "string" || !g.name.trim())
        throw new Error("Objectif sans nom.");
      const target = money(g.targetAmount);
      if (!target) throw new Error("Cible invalide.");
      const linked = Array.isArray(v.tables?.accounts)
        ? v.tables.accounts.find((a) => a.id === g.linkedAccountId)
        : undefined;
      if (linked && typeof linked.balance === "number" && linked.balance < 0) {
        warnings.push(
          `${g.name} n’a pas été repris : le solde de son compte lié est négatif. Vérifiez cet objectif dans l’ancienne application avant de le récupérer. Aucun montant réservé n’a été inventé.`,
        );
        return [];
      }
      const deadline =
        g.deadline === undefined || g.deadline === ""
          ? undefined
          : typeof g.deadline === "string"
            ? parseDate(g.deadline)
            : null;
      if (deadline === null)
        throw new Error(`Échéance invalide pour l’objectif ${g.name}.`);
      return [
        {
          name: g.name,
          target,
          saved: money(
            linked && typeof linked.balance === "number"
              ? linked.balance
              : g.currentAmount,
          ),
          ...(g.id !== undefined ? { legacyId: String(g.id) } : {}),
          ...(deadline ? { deadline } : {}),
          ...(typeof g.description === "string"
            ? { description: g.description }
            : {}),
          ...(typeof g.monthlyContribution === "number"
            ? { monthly: money(g.monthlyContribution) }
            : {}),
        },
      ];
    });
  const budgets = v.tables.budgets
    .filter((b) => b.period === "monthly")
    .map((b) => {
      if (
        typeof b.category !== "string" ||
        !Number.isInteger(b.year) ||
        !Number.isInteger(b.month) ||
        Number(b.month) < 1 ||
        Number(b.month) > 12
      )
        throw new Error("Budget invalide.");
      return {
        category: b.category,
        amount: money(b.amount),
        month: String(b.year) + "-" + String(b.month).padStart(2, "0"),
      };
    });
  return { goals, budgets, warnings };
}
export const widgetSizes: WidgetSize[] = [
  "tiny",
  "small",
  "medium",
  "large",
  "xlarge",
];
export function sizesFor(id: WidgetId): WidgetSize[] {
  if (
    [
      "chart",
      "comparison",
      "library",
      "configuration",
      "scenario",
      "goals",
    ].includes(id)
  )
    return ["medium", "large", "xlarge"];
  if (
    [
      "budgets",
      "transactions",
      "dues",
      "recurring",
      "categories",
      "accounts",
    ].includes(id)
  )
    return ["small", "medium", "large", "xlarge"];
  return widgetSizes;
}
export const defaultSize = (id: WidgetId): WidgetSize =>
  id === "chart" ? "xlarge" : "medium";
