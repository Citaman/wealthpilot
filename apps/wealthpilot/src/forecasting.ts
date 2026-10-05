import type { Budget, Due, Snapshot } from "./types";
import { addDays, balanceAt, monthEnd, today, weekStart } from "./domain";
import { allGoals, detectRecurrences, withEstimates } from "./intelligence";
import { balanceCoverage } from "./coverage";
import { budgetCalendar, budgetCycle, budgetCycleKey } from "./periods";

export type CashPoint = {
  date: string;
  value: number;
  lower: number;
  upper: number;
  future: boolean;
  uncertain?: boolean;
  events: string[];
};
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
export const median = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b),
    i = Math.floor(sorted.length / 2);
  return sorted.length
    ? Math.round(
        sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2,
      )
    : 0;
};
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const planningHorizon = (date: string, asOf = today()) =>
  [addDays(date, 14), addDays(asOf, 45), monthEnd(date.slice(0, 7))]
    .sort()
    .at(-1)!;
export const scopedBudgets = (s: Snapshot, account: string) =>
  s.budgets.filter((b) =>
    account
      ? b.account === account
      : !b.account ||
        !s.budgets.some(
          (global) =>
            !global.account &&
            global.month === b.month &&
            global.category === b.category,
        ),
  );

function freeBudget(s: Snapshot, b: Budget, events: Due[], asOf: string) {
  const calendar = budgetCalendar(s.transactions, asOf);
  const spent = -sum(
    s.transactions
      .filter(
        (t) =>
          (!b.account || t.account === b.account) &&
          budgetCycleKey(t.date, calendar) === b.month &&
          t.date <= asOf &&
          !t.internal &&
          t.amount < 0 &&
          t.category === b.category,
      )
      .map((t) => t.amount),
  );
  const committed = -sum(
    events
      .filter(
        (d) =>
          (!b.account || d.account === b.account) &&
          budgetCycleKey(d.date, calendar) === b.month &&
          d.amount < 0 &&
          !d.internal &&
          d.category === b.category,
      )
      .map((d) => d.amount),
  );
  return Math.max(0, b.amount - spent - committed);
}

/** Cash and earmarked money are deliberately separate. Scenarios are not probabilities. */
export function forecastCash(
  s: Snapshot,
  end: string,
  account = "",
  asOf = today(),
  extra: Due[] = [],
) {
  const calendar = budgetCalendar(s.transactions, asOf);
  const accounts = s.accounts.filter((a) => !account || a.id === account);
  const balances = accounts.map((a) => balanceAt(a, s.transactions, asOf));
  const balance =
    accounts.length && balances.every((b) => b !== null)
      ? sum(balances as number[])
      : null;
  // Envelope commitments cover the entire final cycle, independently of how
  // far the chart is displayed. Otherwise shortening it changes earlier cash.
  const finalKey = budgetCycleKey(end, calendar);
  const openEnded =
    calendar.observed.length > 0 &&
    ![...calendar.observed, ...calendar.projected].some(
      (p) => p.month > finalKey,
    );
  const commitmentEnd = [
    end,
    budgetCycle(finalKey, calendar).to,
    ...(openEnded
      ? [...s.dues, ...s.transactions.filter((t) => t.date > asOf)]
          .filter((d) => budgetCycleKey(d.date, calendar) === finalKey)
          .map((d) => d.date)
      : []),
  ]
    .sort()
    .at(-1)!;
  const projected = withEstimates(s, commitmentEnd, asOf);
  const knownFuture: Due[] = s.transactions
    .filter((t) => t.date > asOf && t.date <= commitmentEnd)
    .map((t) => ({
      id: "known:" + t.id,
      date: t.date,
      amount: t.amount,
      label: t.merchant || t.label,
      account: t.account,
      category: t.category,
      internal: t.internal,
    }));
  const budgetEvents = [
    ...new Map(
      [...projected.dues, ...knownFuture, ...extra]
        .filter(
          (d) =>
            !d.transactionId &&
            d.date <= commitmentEnd &&
            (!account || d.account === account),
        )
        .map((d) => [d.id, d]),
    ).values(),
  ];
  const events = budgetEvents.filter((d) => d.date <= end);
  const recurrences = detectRecurrences(s.transactions, asOf);
  const warnings: string[] = [];
  if (calendar.observed.length && !calendar.projected.length)
    warnings.push(
      "Prochaine entrée de revenu non déterminée : aucune date de renouvellement du budget n’est confirmée.",
    );
  for (const a of accounts) {
    if (!a.checkpoint) warnings.push(`${a.id} : solde à confirmer.`);
    else if (a.checkpoint.status === "derived")
      warnings.push(
        `${a.id} : ancrage reconstruit au ${a.checkpoint.date}, non confirmé par observation bancaire.`,
      );
    else if (!["observed", "covered"].includes(balanceCoverage(a, asOf)))
      warnings.push(
        `${a.id} : solde observé le ${a.checkpoint.date}, mouvements ultérieurs à vérifier.`,
      );
  }
  if (events.some((d) => d.date <= asOf))
    warnings.push(
      "Échéances échues ou du jour non rapprochées : leur paiement reste à vérifier. Celles du jour sont provisionnées dans le scénario.",
    );
  const allocated = s.preferences.weeklyPlans?.find(
    (p) => p.account === account && p.start === weekStart(asOf),
  );
  const linkedReserve = sum(
    allGoals(s)
      .filter((g) => !account || g.account === account)
      .map((g) => g.saved),
  );
  const reserve = account
    ? Math.max(allocated?.reserve ?? 0, linkedReserve)
    : s.preferences.safety + linkedReserve;
  if (
    account &&
    !allocated &&
    (s.preferences.safety || allGoals(s).some((g) => g.saved))
  )
    warnings.push(
      "Réserves du foyer non affectées à ce compte : aucune répartition arbitraire appliquée.",
    );
  // Free provision excludes both paid and scheduled expenses; they enter cash exactly once.
  const variable = new Map<string, number>();
  // Account allocations are inside a household envelope, never added on top.
  const effectiveBudgets = scopedBudgets(s, account);
  for (const b of effectiveBudgets.filter(
    (b) =>
      b.month >= budgetCycleKey(asOf, calendar) &&
      b.month <= budgetCycleKey(end, calendar),
  )) {
    const scope = b.account || account;
    const spent = -sum(
      s.transactions
        .filter(
          (t) =>
            (!scope || t.account === scope) &&
            budgetCycleKey(t.date, calendar) === b.month &&
            t.date <= asOf &&
            !t.internal &&
            t.amount < 0 &&
            t.category === b.category,
        )
        .map((t) => t.amount),
    );
    const committed = -sum(
      budgetEvents
        .filter(
          (d) =>
            (!scope || d.account === scope) &&
            budgetCycleKey(d.date, calendar) === b.month &&
            d.amount < 0 &&
            !d.internal &&
            d.category === b.category,
        )
        .map((d) => d.amount),
    );
    variable.set(
      b.month,
      (variable.get(b.month) ?? 0) + Math.max(0, b.amount - spent - committed),
    );
  }
  if (!account && s.preferences.essentials > 0)
    variable.set(budgetCycleKey(asOf, calendar), s.preferences.essentials);
  const points: CashPoint[] = [];
  let central = balance ?? 0,
    lower = central,
    upper = central;
  for (let date = asOf; date <= end; date = addDays(date, 1)) {
    const dayEvents = events.filter((d) => d.date === date);
    if (date === asOf) {
      const adjustment = sum(dayEvents.map((d) => d.amount));
      central += adjustment;
      lower += adjustment;
      upper += adjustment;
    }
    if (date > asOf) {
      const delta = sum(dayEvents.map((d) => d.amount));
      let spread = 0;
      for (const event of dayEvents.filter(
        (d) => d.estimated && !d.recurrenceConfirmed,
      )) {
        const r = recurrences.find((r) => r.key === event.recurrenceKey);
        spread += r
          ? Math.max(
              Math.abs(event.amount - r.minimum),
              Math.abs(event.amount - r.maximum),
            )
          : Math.round(Math.abs(event.amount) * 0.15);
      }
      const m = budgetCycleKey(date, calendar),
        cycle = budgetCycle(m, calendar),
        first =
          m === budgetCycleKey(asOf, calendar) ? asOf : addDays(cycle.from, -1);
      const n = Math.max(1, daysBetween(first, cycle.to));
      const day = daysBetween(first, date),
        provision = variable.get(m) ?? 0;
      const allocated = (elapsed: number) =>
        Math.floor((provision * Math.max(0, Math.min(n, elapsed))) / n);
      const spend = allocated(day) - allocated(day - 1);
      central += delta - spend;
      lower += delta - spread - Math.ceil(spend * 1.2);
      upper += delta + spread - Math.floor(spend * 0.8);
    }
    points.push({
      date,
      value: central,
      lower,
      upper,
      future: date > asOf,
      uncertain: warnings.length > 0,
      events: dayEvents.map((d) => d.label),
    });
  }
  const low = points.reduce((a, b) => (b.value < a.value ? b : a), points[0]);
  const prudentLow = points.reduce(
    (a, b) => (b.lower < a.lower ? b : a),
    points[0],
  );
  return {
    balance,
    points: balance === null ? [] : points,
    low: balance === null ? null : low,
    prudentLow: balance === null ? null : prudentLow,
    reserve,
    events,
    budgetEvents,
    warnings,
    variable,
    assumptions:
      "Central : échéances et enveloppes restantes. Prudent/favorable : dispersion des montants récurrents et ±20 % des provisions variables. Scénarios, pas intervalles probabilistes. Revenus à leur date attendue ; retards à simuler séparément.",
  };
}

export function weeklyPlan(
  s: Snapshot,
  start: string,
  account = "",
  asOf = today(),
  reduction = 0,
) {
  const calendar = budgetCalendar(s.transactions, asOf);
  const end = addDays(start, 6),
    scope = s.transactions.filter((t) => !account || t.account === account);
  const saved = s.preferences.weeklyPlans?.find(
    (p) => p.start === start && p.account === account,
  );
  const historyStart = addDays(weekStart(asOf), -84);
  const history = scope.filter(
    (t) =>
      !t.internal &&
      t.amount < 0 &&
      t.date >= historyStart &&
      t.date < weekStart(asOf),
  );
  const first = scope.map((t) => t.date).sort()[0];
  const accounts = s.accounts.filter((a) => !account || a.id === account);
  const coveredWeeks: string[] = [];
  for (let w = historyStart; w < weekStart(asOf); w = addDays(w, 7))
    if (
      accounts.length &&
      accounts.every((a) =>
        a.coverage?.some(
          (c) => c.complete && c.from <= w && c.through >= addDays(w, 6),
        ),
      )
    )
      coveredWeeks.push(w);
  const weeks: string[] = [];
  for (let w = historyStart; w < weekStart(asOf); w = addDays(w, 7))
    if (coveredWeeks.length ? coveredWeeks.includes(w) : first && w >= first)
      weeks.push(w);
  const categories = [
    ...new Set([
      ...history.map((t) => t.category),
      ...s.budgets.map((b) => b.category),
      ...Object.keys(saved?.limits ?? {}),
    ]),
  ].sort();
  const horizon = planningHorizon(end, asOf);
  const forecast = forecastCash(s, horizon, account, asOf);
  const householdEvents = account
    ? forecastCash(s, horizon, "", asOf).budgetEvents
    : forecast.budgetEvents;
  const spent = scope.filter(
    (t) =>
      !t.internal &&
      t.amount < 0 &&
      t.date >= start &&
      t.date <= end &&
      t.date <= asOf,
  );
  const committed = forecast.events.filter(
    (d) =>
      d.amount < 0 &&
      !d.internal &&
      d.date >= start &&
      d.date <= end &&
      d.date >= asOf,
  );
  const reserve = Math.max(saved?.reserve ?? 0, forecast.reserve);
  const overdue = -sum(
    forecast.events
      .filter((d) => d.date < asOf && d.amount < 0)
      .map((d) => d.amount),
  );
  // The initial point prevents advancing future income as today's cash. Subsequent
  // points protect obligations chronologically, rather than subtracting 45 days of
  // charges while ignoring the salary that funds them in between.
  const fixed = forecastCash(
    { ...s, budgets: [], preferences: { ...s.preferences, essentials: 0 } },
    horizon,
    account,
    asOf,
  );
  const cashCapacity =
    forecast.balance === null
      ? null
      : Math.max(
          0,
          Math.min(forecast.balance, fixed.prudentLow?.lower ?? 0) -
            reserve -
            overdue,
        );
  const weekDays: string[] = [];
  for (let d = start > asOf ? start : asOf; d <= end; d = addDays(d, 1))
    weekDays.push(d);
  const months = [...new Set(weekDays.map((d) => budgetCycleKey(d, calendar)))];
  const rows = categories.map((category) => {
    const samples = weeks.map(
      (w) =>
        -sum(
          history
            .filter((t) => t.category === category && weekStart(t.date) === w)
            .map((t) => t.amount),
        ),
    );
    const average = median(samples);
    const paid = -sum(
      spent.filter((t) => t.category === category).map((t) => t.amount),
    );
    const engaged = -sum(
      committed.filter((d) => d.category === category).map((d) => d.amount),
    );
    const proposed = Math.round(
      average * (1 - (saved?.reduction ?? reduction) / 100),
    );
    const target = saved?.limits[category] ?? proposed;
    const requested = Math.max(0, target - paid - engaged);
    let allocatedDays = 0;
    const monthLimits = months.map((month) => {
      const count = weekDays.filter(
        (d) => budgetCycleKey(d, calendar) === month,
      ).length;
      const portion =
        Math.floor((requested * (allocatedDays + count)) / weekDays.length) -
        Math.floor((requested * allocatedDays) / weekDays.length);
      allocatedDays += count;
      const budgets = scopedBudgets(s, account).filter(
        (b) => b.month === month && b.category === category,
      );
      let remaining = budgets.length
        ? sum(budgets.map((b) => freeBudget(s, b, forecast.budgetEvents, asOf)))
        : null;
      // A payer's explicit allocation is nested in the shared envelope. Spending
      // by another payer reduces that ceiling too, but never creates an allocation.
      const global =
        account &&
        s.budgets.find(
          (b) => !b.account && b.month === month && b.category === category,
        );
      if (global) {
        const sharedRemaining = freeBudget(s, global, householdEvents, asOf);
        remaining =
          remaining === null
            ? sharedRemaining
            : Math.min(remaining, sharedRemaining);
      }
      return {
        month,
        remaining,
        allowed: remaining === null ? portion : Math.min(portion, remaining),
      };
    });
    return {
      category,
      average,
      spent: paid,
      committed: engaged,
      target,
      desired: sum(monthLimits.map((m) => m.allowed)),
      monthLimits,
      limit: 0,
    };
  });
  const desired = sum(rows.map((r) => r.desired));
  const pool = Math.min(desired, cashCapacity ?? 0);
  const allowed = rows.map((r) => ({
    ...r,
    limit: desired ? Math.floor((r.desired / desired) * pool) : 0,
  }));
  let remainder = pool - sum(allowed.map((r) => r.limit));
  for (const row of allowed) {
    if (remainder > 0 && row.limit < row.desired) {
      row.limit++;
      remainder--;
    }
  }
  const status = saved
    ? "confirmed"
    : weeks.length && history.length
      ? "estimated"
      : "unconfigured";
  return {
    start,
    end,
    account,
    status,
    rows: allowed,
    weeks: weeks.length,
    verifiedWeeks: coveredWeeks.length,
    forecast,
    reserve,
    overdue,
    saved,
    capacity: cashCapacity,
    remaining: sum(allowed.map((r) => r.limit)),
    spent: Math.abs(sum(spent.map((t) => t.amount))),
    committed: Math.abs(sum(committed.map((d) => d.amount))),
    coverage: coveredWeeks.length
      ? `Médiane de ${coveredWeeks.length} semaines avec couverture déclarée complète.`
      : "Historique incomplet : médiane exploratoire, pas un budget validé. La présence d’opérations ne prouve pas un relevé complet ; vérifiez les trous de couverture.",
  };
}

export function simulatePurchase(
  s: Snapshot,
  input: {
    amount: number;
    category: string;
    date: string;
    account: string;
    included: boolean;
  },
  asOf = today(),
) {
  const calendar = budgetCalendar(s.transactions, asOf);
  const week = weeklyPlan(s, weekStart(input.date), input.account, asOf);
  const envelope = week.rows.find((r) => r.category === input.category);
  const end = planningHorizon(input.date, asOf);
  const before = forecastCash(s, end, input.account, asOf);
  // An included purchase consumes existing free provision, not a second monthly reserve.
  const householdBefore = forecastCash(s, end, "", asOf);
  let accountConsumption = input.amount;
  let householdConsumption = input.amount;
  const householdBudgetIds = new Set(scopedBudgets(s, "").map((b) => b.id));
  const adjusted = input.included
    ? {
        ...s,
        budgets: s.budgets.map((b) => {
          if (
            b.category !== input.category ||
            b.month !== budgetCycleKey(input.date, calendar) ||
            (input.account && b.account && b.account !== input.account)
          )
            return b;
          const household = householdBudgetIds.has(b.id);
          const available = freeBudget(
            s,
            b,
            householdBefore.budgetEvents,
            asOf,
          );
          const consumed = Math.min(
            household ? householdConsumption : accountConsumption,
            available,
          );
          if (household) householdConsumption -= consumed;
          else accountConsumption -= consumed;
          return { ...b, amount: b.amount - consumed };
        }),
      }
    : s;
  // Additional purchase is outside the envelope category so it cannot silently reduce its provision.
  const after = forecastCash(adjusted, end, input.account, asOf, [
    {
      id: "simulation",
      label: "Achat simulé",
      amount: -input.amount,
      account: input.account,
      date: input.date,
      category: "__additional_purchase__",
    },
  ]);
  const householdAfter = forecastCash(adjusted, end, "", asOf, [
    {
      id: "simulation",
      label: "Achat simulé",
      amount: -input.amount,
      account: input.account,
      date: input.date,
      category: "__additional_purchase__",
    },
  ]);
  const payer = s.accounts.find((a) => a.id === input.account);
  const cash = payer ? balanceAt(payer, s.transactions, asOf) : null;
  const shortfall = after.prudentLow
    ? Math.max(
        0,
        before.reserve - after.prudentLow.lower,
        input.amount - (envelope?.limit ?? 0),
        input.amount - (cash ?? 0),
      )
    : null;
  return {
    week,
    before,
    after,
    householdBefore,
    householdAfter,
    cash,
    envelope,
    remaining: (envelope?.limit ?? 0) - input.amount,
    shortfall,
  };
}
