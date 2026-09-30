import { fromCents, toCents } from "./money";

export type CashPlanScenario = "cautious" | "realistic" | "recovery";

export interface MonthlyIncomeSource {
  id: string;
  name: string;
  dayOfMonth: number;
  startDate?: string;
  amounts: Record<CashPlanScenario, number>;
  note?: string;
}

export interface CashPlanAssumptions {
  startDate: string;
  weeks: number;
  startingBalance: number;
  scenario: CashPlanScenario;
  incomeSources: MonthlyIncomeSource[];
  weeklyNeeds: number;
  weeklyWants: number;
  monthlyFixedCosts: number;
  fixedCostDay: number;
  taxAdjustmentAmount: number;
  taxAdjustmentDay: number;
  taxPaymentsRemaining: number;
  targetEndBalance: number;
  safetyFloor: number;
}

export interface CashPlanEvent {
  date: string;
  label: string;
  amount: number;
  kind: "income" | "fixed" | "needs" | "wants" | "tax";
}

export interface CashPlanWeek {
  index: number;
  startDate: string;
  endDate: string;
  openingBalance: number;
  income: number;
  fixedCosts: number;
  needs: number;
  wants: number;
  tax: number;
  net: number;
  closingBalance: number;
  lowestBalance: number;
  events: CashPlanEvent[];
}

export interface CashPlanResult {
  weeks: CashPlanWeek[];
  endingBalance: number;
  lowestBalance: number;
  targetGap: number;
  requiredWeeklyImprovement: number;
  firstBelowFloorWeek: number | null;
  totalIncome: number;
  totalOutflows: number;
}

export interface CashPlanConfigurationStatus {
  isReady: boolean;
  missing: Array<"balance" | "target" | "floor">;
}

export interface CashPlanWeekActual {
  income: number;
  spending: number;
  net: number;
  remainingEnvelope: number;
}

const DAY_MS = 86_400_000;

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateAtDay(year: number, month: number, requestedDay: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(Math.max(1, requestedDay), lastDay)));
}

function monthlyDates(start: Date, end: Date, dayOfMonth: number, sourceStart?: string): Date[] {
  const dates: Date[] = [];
  const sourceStartDate = sourceStart ? parseDate(sourceStart) : start;
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor <= end) {
    const occurrence = dateAtDay(cursor.getUTCFullYear(), cursor.getUTCMonth(), dayOfMonth);
    if (occurrence >= start && occurrence <= end && occurrence >= sourceStartDate) {
      dates.push(occurrence);
    }
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return dates;
}

function sumEvents(events: CashPlanEvent[], kind: CashPlanEvent["kind"]): number {
  return fromCents(events
    .filter((event) => event.kind === kind)
    .reduce((sum, event) => sum + toCents(Math.abs(event.amount)), 0));
}

export function buildCashPlan(assumptions: CashPlanAssumptions): CashPlanResult {
  const weeks = Math.max(1, Math.floor(assumptions.weeks));
  const start = parseDate(assumptions.startDate);
  const horizonEnd = addDays(start, weeks * 7 - 1);
  const datedEvents: CashPlanEvent[] = [];

  for (const source of assumptions.incomeSources) {
    const amount = source.amounts[assumptions.scenario];
    if (amount <= 0) continue;
    for (const date of monthlyDates(start, horizonEnd, source.dayOfMonth, source.startDate)) {
      datedEvents.push({ date: isoDate(date), label: source.name, amount, kind: "income" });
    }
  }

  if (assumptions.monthlyFixedCosts > 0) {
    for (const date of monthlyDates(start, horizonEnd, assumptions.fixedCostDay)) {
      datedEvents.push({
        date: isoDate(date),
        label: "Fixed monthly costs",
        amount: -Math.abs(assumptions.monthlyFixedCosts),
        kind: "fixed",
      });
    }
  }

  const taxDates = monthlyDates(start, horizonEnd, assumptions.taxAdjustmentDay)
    .slice(0, Math.max(0, Math.floor(assumptions.taxPaymentsRemaining)));
  for (const date of taxDates) {
    datedEvents.push({
      date: isoDate(date),
      label: "Temporary tax adjustment",
      amount: -Math.abs(assumptions.taxAdjustmentAmount),
      kind: "tax",
    });
  }

  const resultWeeks: CashPlanWeek[] = [];
  let balanceCents = toCents(assumptions.startingBalance);
  let lowestBalanceCents = balanceCents;
  let totalIncomeCents = 0;
  let totalOutflowsCents = 0;
  let firstBelowFloorWeek: number | null = null;

  for (let index = 0; index < weeks; index += 1) {
    const weekStart = addDays(start, index * 7);
    const weekEnd = addDays(weekStart, 6);
    const openingBalance = fromCents(balanceCents);
    const events = datedEvents.filter((event) => {
      const date = parseDate(event.date);
      return date >= weekStart && date <= weekEnd;
    });
    events.push({ date: isoDate(weekEnd), label: "Essential weekly envelope", amount: -Math.abs(assumptions.weeklyNeeds), kind: "needs" });
    events.push({ date: isoDate(weekEnd), label: "Flexible weekly envelope", amount: -Math.abs(assumptions.weeklyWants), kind: "wants" });

    const sortedEvents = events.sort((a, b) => a.date.localeCompare(b.date));
    const income = sumEvents(sortedEvents, "income");
    const fixedCosts = sumEvents(events, "fixed");
    const needs = sumEvents(events, "needs");
    const wants = sumEvents(events, "wants");
    const tax = sumEvents(events, "tax");
    const netCents = toCents(income) - toCents(fixedCosts) - toCents(needs) - toCents(wants) - toCents(tax);
    let weekBalanceCents = balanceCents;
    let weekLowestBalanceCents = balanceCents;
    for (const event of sortedEvents) {
      weekBalanceCents += toCents(event.amount);
      weekLowestBalanceCents = Math.min(weekLowestBalanceCents, weekBalanceCents);
    }
    balanceCents = weekBalanceCents;
    lowestBalanceCents = Math.min(lowestBalanceCents, weekLowestBalanceCents);
    totalIncomeCents += toCents(income);
    totalOutflowsCents += toCents(fixedCosts) + toCents(needs) + toCents(wants) + toCents(tax);

    if (firstBelowFloorWeek === null && weekLowestBalanceCents < toCents(assumptions.safetyFloor)) {
      firstBelowFloorWeek = index + 1;
    }

    resultWeeks.push({
      index: index + 1,
      startDate: isoDate(weekStart),
      endDate: isoDate(weekEnd),
      openingBalance,
      income,
      fixedCosts,
      needs,
      wants,
      tax,
      net: fromCents(netCents),
      closingBalance: fromCents(balanceCents),
      lowestBalance: fromCents(weekLowestBalanceCents),
      events: sortedEvents,
    });
  }

  const endingBalance = fromCents(balanceCents);
  const targetGapCents = Math.max(0, toCents(assumptions.targetEndBalance) - balanceCents);

  return {
    weeks: resultWeeks,
    endingBalance,
    lowestBalance: fromCents(lowestBalanceCents),
    targetGap: fromCents(targetGapCents),
    requiredWeeklyImprovement: fromCents(Math.ceil(targetGapCents / weeks)),
    firstBelowFloorWeek,
    totalIncome: fromCents(totalIncomeCents),
    totalOutflows: fromCents(totalOutflowsCents),
  };
}

/** A projection must never be presented as actionable before these three inputs are confirmed. */
export function getCashPlanConfigurationStatus(input: {
  balanceConfirmed: boolean;
  targetConfirmed: boolean;
  floorConfirmed: boolean;
}): CashPlanConfigurationStatus {
  const missing: CashPlanConfigurationStatus["missing"] = [];
  if (!input.balanceConfirmed) missing.push("balance");
  if (!input.targetConfirmed) missing.push("target");
  if (!input.floorConfirmed) missing.push("floor");
  return { isReady: missing.length === 0, missing };
}

export function calculateWeekActual(
  week: Pick<CashPlanWeek, "needs" | "wants">,
  transactions: Array<{ direction: "credit" | "debit"; amount: number; isExcluded?: boolean; category?: string }>
): CashPlanWeekActual {
  const included = transactions.filter((transaction) => !transaction.isExcluded && transaction.category !== "Transfers");
  const income = fromCents(included
    .filter((transaction) => transaction.direction === "credit")
    .reduce((sum, transaction) => sum + toCents(Math.abs(transaction.amount)), 0));
  const spending = fromCents(included
    .filter((transaction) => transaction.direction === "debit")
    .reduce((sum, transaction) => sum + toCents(Math.abs(transaction.amount)), 0));
  return {
    income,
    spending,
    net: fromCents(toCents(income) - toCents(spending)),
    remainingEnvelope: fromCents(toCents(week.needs + week.wants) - toCents(spending)),
  };
}

export function calculateSafeToSpendThisWeek(
  week: Pick<CashPlanWeek, "openingBalance" | "income" | "fixedCosts" | "tax" | "needs" | "wants">,
  safetyFloor: number
): number {
  const availableBeforeEnvelope = toCents(week.openingBalance) + toCents(week.income)
    - toCents(week.fixedCosts) - toCents(week.tax) - toCents(safetyFloor);
  return fromCents(Math.max(0, Math.min(toCents(week.needs + week.wants), availableBeforeEnvelope)));
}

export function daysBetween(startDate: string, endDate: string): number {
  return Math.round((parseDate(endDate).getTime() - parseDate(startDate).getTime()) / DAY_MS);
}
