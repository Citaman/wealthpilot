import { describe, expect, it } from "vitest";
import { addDays, selectDashboard } from "./domain";
import {
  budgetCalendar,
  budgetCycle,
  budgetCycleKey,
  bucketKey,
  periodBounds,
} from "./periods";
import { forecastCash, simulatePurchase, weeklyPlan } from "./forecasting";
import { spendingHistory } from "./intelligence";
import { financialView } from "./financialView";
import { aggregatePoints } from "./Chart";
import { validateBackup } from "./store";
import { emptySnapshot, type Snapshot, type Transaction } from "./types";

const operation = (
  id: string,
  date: string,
  amount: number,
  account = "Anthony",
): Transaction => ({
  id,
  date,
  amount,
  account,
  merchant: id,
  label: id,
  category: amount > 0 ? "Revenus" : "Courses",
  internal: false,
  batchId: "fixture",
  fingerprint: id,
  raw: {},
});
function fixture(): Snapshot {
  const s = structuredClone(emptySnapshot);
  // Old stored settings must no longer determine the dates.
  s.preferences.cycleStartDay = 9;
  s.preferences.safety = 0;
  s.accounts = [
    { id: "Anthony", checkpoint: { date: "2026-10-05", amount: 200000 } },
    { id: "Yaren", checkpoint: { date: "2026-10-05", amount: 100000 } },
  ];
  s.transactions = [
    operation("Avant cycle", "2026-09-25", -5000),
    operation("Salaire Anthony", "2026-09-26", 250000),
    operation("Salaire Yaren", "2026-09-27", 180000, "Yaren"),
    { ...operation("Loyer", "2026-10-01", -90000), category: "Logement" },
    operation("Courses", "2026-10-03", -10000),
    operation("CAF", "2026-10-05", 20000, "Yaren"),
    operation("Futur", "2026-10-26", 250000),
  ];
  return s;
}

describe("Cycle salarial : frontières, cash réel, prévisions et granularité", () => {
  it("rattache salaire de septembre et loyer d’octobre au même cycle, avec scopes et virements neutres", () => {
    const s = fixture();
    s.transactions.push(
      ...[
        { ...operation("Virement A", "2026-10-04", -1000), internal: true },
        {
          ...operation("Virement B", "2026-10-04", 1000, "Yaren"),
          internal: true,
        },
      ],
    );
    const d = selectDashboard(s, "2026-10", "", "2026-10-05");
    expect(d.period).toEqual({ from: "2026-09-26", to: "2026-10-25" });
    expect([d.income, d.spending, d.balance, d.horizon]).toEqual([
      450000,
      100000,
      300000,
      "2026-10-25",
    ]);
    expect(d.rows.map((t) => t.id)).not.toContain("Avant cycle");
    expect(d.rows.map((t) => t.id)).not.toContain("Futur");
    expect(selectDashboard(s, "2026-10", "Yaren", "2026-10-05").income).toBe(
      200000,
    );
    const wider = selectDashboard(s, "2026-10", "", "2026-10-05", "2026-08");
    expect(wider.balance).toBe(d.balance);
    expect(wider.points.find((p) => p.date === "2026-10-03")?.value).toBe(
      d.points.find((p) => p.date === "2026-10-03")?.value,
    );
  });

  it("suit les dates réellement variables, le premier revenu du foyer et les changements d’année", () => {
    const rows = [
      operation("Salaire A", "2025-12-26", 250000),
      operation("Salaire B", "2025-12-24", 150000, "Yaren"),
      operation("Salaire A", "2026-01-27", 250000),
      operation("Salaire B", "2026-01-29", 150000, "Yaren"),
      operation("Salaire A", "2026-02-25", 250000),
      operation("Salaire B", "2026-02-24", 150000, "Yaren"),
    ];
    const calendar = budgetCalendar(rows, "2026-03-05");
    expect(calendar.observed.map((p) => [p.month, p.date])).toEqual([
      ["2026-01", "2025-12-24"],
      ["2026-02", "2026-01-27"],
      ["2026-03", "2026-02-24"],
    ]);
    expect(budgetCycle("2026-01", calendar)).toEqual({
      from: "2025-12-24",
      to: "2026-01-26",
    });
    expect(budgetCycle("2026-02", calendar)).toEqual({
      from: "2026-01-27",
      to: "2026-02-23",
    });
    expect(periodBounds("2026-01", "2026-02", calendar)).toEqual({
      from: "2025-12-24",
      to: "2026-02-23",
    });
    for (
      let date = "2025-12-01";
      date <= "2026-03-05";
      date = addDays(date, 1)
    ) {
      const bounds = budgetCycle(budgetCycleKey(date, calendar), calendar);
      expect(date >= bounds.from && date <= bounds.to, date).toBe(true);
    }
  });

  it("exclut remboursements, primes et virements internes, conserve la CAF et ne crée pas un mois sur salaire prévu", () => {
    const rows = [
      operation("Salaire A", "2026-08-25", 250000),
      operation("Salaire A", "2026-09-27", 250000),
      operation("CAF", "2026-09-04", 20000, "Yaren"),
      operation("CAF", "2026-10-05", 20000, "Yaren"),
      operation("Prime employeur", "2026-09-20", 150000),
      operation("Remboursement", "2026-09-21", 150000),
      { ...operation("Salaire interne", "2026-09-22", 150000), internal: true },
      operation("Salaire A", "2026-10-29", 250000),
    ];
    const calendar = budgetCalendar(rows, "2026-10-28");
    expect(calendar.observed.map((p) => [p.month, p.date])).toEqual([
      ["2026-09", "2026-08-25"],
      ["2026-10", "2026-09-27"],
    ]);
    expect(budgetCycleKey("2026-10-28", calendar)).toBe("2026-10");
    const updated = budgetCalendar(rows, "2026-10-29");
    expect(budgetCycle("2026-10", updated).to).toBe("2026-10-28");
    expect(budgetCycleKey("2026-10-29", updated)).toBe("2026-11");
  });

  it("conserve une période ouverte si un salaire manque, et les virements vagues ne prouvent pas une paie", () => {
    const rows = [
      operation("Salaire A", "2026-06-25", 250000),
      operation("Salaire A", "2026-08-27", 250000),
    ];
    const calendar = budgetCalendar(rows, "2026-09-05");
    expect(budgetCycle("2026-07", calendar)).toEqual({
      from: "2026-06-25",
      to: "2026-08-26",
    });
    expect(budgetCycleKey("2026-08-25", calendar)).toBe("2026-07");
    const fallback = budgetCalendar(
      [operation("Virement reçu", "2026-09-26", 50000)],
      "2026-10-05",
    );
    expect(fallback.observed).toEqual([]);
    expect(budgetCycle("2026-10", fallback)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("borne les plages personnalisées sans polluer le cache ni déplacer le solde d’ancrage", () => {
    const s = fixture();
    const a = financialView(s, "2026-10", "", "2026-10", "2026-10-05", {
      from: "2026-10-01",
      to: "2026-10-03",
    }).dashboard;
    const b = financialView(s, "2026-10", "", "2026-10", "2026-10-05", {
      from: "2026-10-01",
      to: "2026-10-05",
    }).dashboard;
    expect(a.income).toBe(0);
    expect(b.income).toBe(20000);
    expect(a.balance).toBe(280000);
    expect(b.balance).toBe(300000);
    expect(b.points.filter((p) => !p.future).at(-1)?.date).toBe("2026-10-05");
  });

  it("garde les frontières historiques stables et rattache une paie retardée à sa vague, sans sauter la suivante", () => {
    const source = (date: string, label = "Salaire", amount = 250000) => ({
      ...operation(date, date, amount),
      merchant: "Employeur",
      label,
    });
    const early = [source("2026-06-14")];
    const later = [...early, source("2026-07-16")];
    expect(budgetCalendar(early, "2026-06-30").observed[0]).toEqual(
      budgetCalendar(later, "2026-07-31").observed[0],
    );
    const delayed = budgetCalendar(
      [source("2026-08-28"), source("2026-09-29"), source("2026-11-02")],
      "2026-11-05",
    );
    expect(delayed.observed.map((p) => p.month)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(budgetCycle("2026-11", delayed)).toEqual({
      from: "2026-11-02",
      to: "2026-11-27",
    });
    const income = [
      source("2026-08-26"),
      source("2026-09-26", "Paie septembre + prime annuelle"),
      source("2026-10-20", "Remboursement frais"),
      source("2026-10-21", "Prime exceptionnelle"),
      source("2026-10-28"),
    ];
    const future = budgetCalendar(income, "2026-10-05");
    expect(future.observed.at(-1)?.date).toBe("2026-09-26");
    expect(budgetCycle("2026-10", future).to).toBe("2026-10-27");
    expect(future.projected[0].date).toBe("2026-10-28");
    const refunds = ["07", "08", "09"].map((m) => ({
      ...source(`2026-${m}-22`, "AVOIR ACHAT", 5000),
      merchant: "Boutique",
    }));
    expect(budgetCalendar(refunds, "2026-10-05").observed).toEqual([]);
  });

  it("ne perd aucun jour avant la première paie et ne double pas une enveloppe sans prochaine date de revenu", () => {
    const s = structuredClone(emptySnapshot);
    s.accounts = [
      { id: "Anthony", checkpoint: { date: "2026-11-05", amount: 100000 } },
    ];
    s.transactions = [
      operation("CAF", "2026-10-05", 20000),
      {
        ...operation("Courses prévues", "2026-11-07", -5000),
        category: "Courses",
      },
    ];
    s.budgets = [
      { id: "food", month: "2026-10", category: "Courses", amount: 10000 },
    ];
    const calendar = budgetCalendar(s.transactions, "2026-11-05");
    expect(calendar.projected).toEqual([]);
    for (const date of [
      "2026-10-01",
      "2026-10-04",
      "2026-10-05",
      "2026-11-05",
    ]) {
      const range = budgetCycle(budgetCycleKey(date, calendar), calendar);
      expect(date >= range.from && date <= range.to, date).toBe(true);
    }
    const forecast = forecastCash(s, "2026-11-08", "", "2026-11-05");
    expect(forecast.variable.get("2026-10")).toBe(5000);
    expect(forecast.points.at(-1)?.value).toBe(90000);
    expect(forecast.events.some((d) => d.date === "2026-11-07")).toBe(true);
    expect(forecast.warnings.join(" ")).toContain(
      "Prochaine entrée de revenu non déterminée",
    );
    expect(forecastCash(s, "2026-11-06", "", "2026-11-05").points).toEqual(
      forecast.points.slice(0, 2),
    );
  });

  it("provisionne l’enveloppe jusqu’au 25 sans recompter dépenses ni échéances", () => {
    const s = fixture();
    s.budgets = [
      { id: "food", category: "Courses", amount: 40000, month: "2026-10" },
    ];
    s.dues = [
      {
        id: "scheduled",
        category: "Courses",
        account: "Anthony",
        label: "Livraison",
        date: "2026-10-10",
        amount: -5000,
      },
    ];
    const d = selectDashboard(s, "2026-10", "", "2026-10-05");
    expect(d.budgets[0]).toMatchObject({
      spent: 10000,
      committed: 5000,
      remaining: 25000,
    });
    const f = forecastCash(s, "2026-10-25", "", "2026-10-05");
    expect(f.points.at(-1)?.value).toBe(270000);
    expect(f.points.at(-1)?.date).toBe("2026-10-25");
    const following = forecastCash(s, "2026-10-26", "", "2026-10-05");
    expect(following.points.at(-1)?.value).toBe(520000);
  });

  it("alloue les jours d’une semaine entre deux cycles, et simule un achat dans le bon cycle", () => {
    const s = fixture();
    s.budgets = [
      { id: "oct", month: "2026-10", category: "Courses", amount: 50000 },
      { id: "nov", month: "2026-11", category: "Courses", amount: 50000 },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-26",
        account: "",
        limits: { Courses: 7000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    const week = weeklyPlan(s, "2026-10-26", "", "2026-10-05");
    expect(
      week.rows
        .find((r) => r.category === "Courses")
        ?.monthLimits.map((m) => m.month),
    ).toEqual(["2026-11"]);
    const result = simulatePurchase(
      s,
      {
        amount: 1000,
        category: "Courses",
        date: "2026-10-27",
        account: "Anthony",
        included: true,
      },
      "2026-10-12",
    );
    expect(
      result.householdAfter.points.find((p) => p.date === "2026-11-25")?.value,
    ).toBe(
      result.householdBefore.points.find((p) => p.date === "2026-11-25")?.value,
    );
    expect(
      result.householdAfter.points.find((p) => p.date === "2026-10-27")!.value,
    ).toBeLessThan(
      result.householdBefore.points.find((p) => p.date === "2026-10-27")!.value,
    );
  });

  it("exclut le cycle inachevé des références et conserve le solde de clôture en semaine/mois", () => {
    const s = fixture();
    s.transactions.push(
      operation("Salaire précédent", "2026-08-26", 240000),
      operation("Courses précédentes", "2026-09-01", -15000),
    );
    expect(spendingHistory(s, "2026-10-05").months).toEqual(["2026-09"]);
    expect(spendingHistory(s, "2026-10-05").income).toBe(240000);
    const points = [
      { date: "2026-09-26", value: 100, future: false },
      { date: "2026-09-27", value: 200, future: false },
      { date: "2026-09-28", value: 300, future: false },
      { date: "2026-09-29", value: 400, future: true },
    ];
    const monthly = aggregatePoints(points, "month");
    expect(monthly.map((p) => p.value)).toEqual([100, 300, 400]);
    expect(monthly.map((p) => p.future)).toEqual([false, false, true]);
    expect(bucketKey("2026-10-04", "week")).toBe("2026-09-28");
    expect(aggregatePoints(points, "day")).toBe(points);
  });

  it("valide le réglage dans les sauvegardes sans rendre les anciennes incompatibles", () => {
    for (const day of [undefined, 1, 26, 31]) {
      const s = structuredClone(emptySnapshot);
      s.preferences.cycleStartDay = day;
      expect(() =>
        validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
      ).not.toThrow();
    }
    for (const day of [0, 32, 1.5]) {
      const s = structuredClone(emptySnapshot);
      s.preferences.cycleStartDay = day;
      expect(() =>
        validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
      ).toThrow();
    }
  });
  it("ne change pas le cash d’une même date quand l’horizon d’affichage raccourcit", () => {
    const s = fixture();
    s.budgets = [
      { id: "oct", month: "2026-10", category: "Courses", amount: 30000 },
    ];
    s.dues = [
      {
        id: "engaged",
        category: "Courses",
        account: "Anthony",
        label: "Livraison",
        date: "2026-10-20",
        amount: -10000,
      },
    ];
    const short = forecastCash(s, "2026-10-10", "", "2026-10-05");
    const long = forecastCash(s, "2026-10-25", "", "2026-10-05");
    expect(short.points).toEqual(
      long.points.filter((p) => p.date <= "2026-10-10"),
    );
    expect(short.events).not.toContainEqual(
      expect.objectContaining({ id: "engaged" }),
    );
    expect(short.variable).toEqual(long.variable);
  });
});
