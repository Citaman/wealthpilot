import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  budgetCalendar,
  currentMonthEnd,
  monthOf,
  monthRange,
  nextBoundary,
  periodOptions,
  resolvePeriod,
} from "./periods";
import { tx } from "./test-fixtures";

const pay = (date: string, label = "Salaire", amount = 250000) =>
  tx(date, date, amount, { merchant: "Employeur", label });

it("income-anchored budget months: first salary, variable paydays, late or missing pay, no income", () => {
  // opens October on the first household salary, whatever the account or later income
  {
    const rows = [
      tx("Avant cycle", "2026-09-25", -5000),
      tx("Salaire Anthony", "2026-09-26", 250000),
      tx("Salaire Yaren", "2026-09-27", 180000, { account: "Y" }),
      tx("CAF", "2026-10-05", 20000, { account: "Y" }),
      tx("Futur", "2026-10-26", 250000),
    ];
    const calendar = budgetCalendar(rows, "2026-10-05");
    expect(monthRange("2026-10", calendar)).toEqual({
      from: "2026-09-26",
      to: "2026-10-25",
      estimatedEnd: true,
    });
    expect(monthOf("2026-09-25", calendar)).toBe("2026-09");
    expect(monthRange("2026-09", calendar)).toEqual({
      from: "2026-09-01",
      to: "2026-09-25",
      partial: true,
    });
    expect(nextBoundary(calendar)).toEqual({
      date: "2026-10-26",
      estimated: true,
    });
    expect(currentMonthEnd(calendar, "2026-10-05")).toBe("2026-10-25");
  }
  // follows real variable paydays, the household's first income and year changes
  {
    const rows = [
      tx("Salaire A", "2025-12-26", 250000),
      tx("Salaire B", "2025-12-24", 150000, { account: "Y" }),
      tx("Salaire A", "2026-01-27", 250000),
      tx("Salaire B", "2026-01-29", 150000, { account: "Y" }),
      tx("Salaire A", "2026-02-25", 250000),
      tx("Salaire B", "2026-02-24", 150000, { account: "Y" }),
    ];
    const calendar = budgetCalendar(rows, "2026-03-05");
    expect(calendar.observed.map((p) => [p.month, p.date])).toEqual([
      ["2026-01", "2025-12-24"],
      ["2026-02", "2026-01-27"],
      ["2026-03", "2026-02-24"],
    ]);
    expect(monthRange("2026-01", calendar)).toEqual({
      from: "2025-12-24",
      to: "2026-01-26",
    });
    expect(monthRange("2026-02", calendar)).toEqual({
      from: "2026-01-27",
      to: "2026-02-23",
    });
    for (
      let date = "2025-12-01";
      date <= "2026-03-05";
      date = addDays(date, 1)
    ) {
      const range = monthRange(monthOf(date, calendar), calendar);
      expect(date >= range.from && date <= range.to, date).toBe(true);
    }
  }
  // ignores refunds, bonuses and transfers, keeps the CAF, never opens a month on a future salary
  {
    const rows = [
      tx("Salaire A", "2026-08-25", 250000),
      tx("Salaire A", "2026-09-27", 250000),
      tx("CAF", "2026-09-04", 20000, { account: "Y" }),
      tx("CAF", "2026-10-05", 20000, { account: "Y" }),
      tx("Prime employeur", "2026-09-20", 150000),
      tx("Remboursement", "2026-09-21", 150000),
      tx("Salaire interne", "2026-09-22", 150000, { internal: true }),
      tx("Salaire A", "2026-10-29", 250000),
    ];
    const calendar = budgetCalendar(rows, "2026-10-28");
    expect(calendar.observed.map((p) => [p.month, p.date])).toEqual([
      ["2026-09", "2026-08-25"],
      ["2026-10", "2026-09-27"],
    ]);
    expect(monthOf("2026-10-28", calendar)).toBe("2026-10");
    expect(nextBoundary(calendar)).toEqual({
      date: "2026-10-29",
      estimated: false,
    });
    const updated = budgetCalendar(rows, "2026-10-29");
    expect(monthRange("2026-10", updated).to).toBe("2026-10-28");
    expect(monthOf("2026-10-29", updated)).toBe("2026-11");
  }
  // keeps a month open when a salary is missing; vague transfers do not prove a payday
  {
    const calendar = budgetCalendar(
      [pay("2026-06-25"), pay("2026-08-27")],
      "2026-09-05",
    );
    expect(monthRange("2026-07", calendar)).toMatchObject({
      from: "2026-06-25",
      to: "2026-08-26",
    });
    expect(monthOf("2026-08-25", calendar)).toBe("2026-07");
    const fallback = budgetCalendar(
      [tx("Virement reçu", "2026-09-26", 50000)],
      "2026-10-05",
    );
    expect(fallback.observed).toEqual([]);
    expect(monthRange("2026-10", fallback)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  }
  // keeps history stable and attaches a delayed pay to its wave without skipping the next
  {
    const early = [pay("2026-06-14")];
    expect(budgetCalendar(early, "2026-06-30").observed[0]).toEqual(
      budgetCalendar([...early, pay("2026-07-16")], "2026-07-31").observed[0],
    );
    const delayed = budgetCalendar(
      [pay("2026-08-28"), pay("2026-09-29"), pay("2026-11-02")],
      "2026-11-05",
    );
    expect(delayed.observed.map((p) => p.month)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(monthRange("2026-11", delayed)).toMatchObject({
      from: "2026-11-02",
      to: "2026-11-27",
    });
    const future = budgetCalendar(
      [
        pay("2026-08-26"),
        pay("2026-09-26", "Paie septembre + prime annuelle"),
        pay("2026-10-20", "Remboursement frais"),
        pay("2026-10-21", "Prime exceptionnelle"),
        pay("2026-10-28"),
      ],
      "2026-10-05",
    );
    expect(future.observed.at(-1)?.date).toBe("2026-09-26");
    expect(monthRange("2026-10", future).to).toBe("2026-10-27");
    expect(future.projected[0].date).toBe("2026-10-28");
    const refunds = ["07", "08", "09"].map((m) => ({
      ...pay(`2026-${m}-22`, "AVOIR ACHAT", 5000),
      merchant: "Boutique",
    }));
    expect(budgetCalendar(refunds, "2026-10-05").observed).toEqual([]);
  }
  // loses no day before the first pay and caps an open month at 35 days of horizon
  {
    const rows = [tx("CAF", "2026-10-05", 20000)];
    const calendar = budgetCalendar(rows, "2026-11-05");
    expect(calendar.projected).toEqual([]);
    for (const date of [
      "2026-10-01",
      "2026-10-04",
      "2026-10-05",
      "2026-11-05",
    ]) {
      const range = monthRange(monthOf(date, calendar), calendar);
      expect(date >= range.from && date <= range.to, date).toBe(true);
    }
    expect(currentMonthEnd(calendar, "2026-11-05")).toBe("2026-12-10");
  }
});

const rows = [
  tx("old", "2026-07-10", -1000),
  pay("2026-08-26"),
  pay("2026-09-25"),
  tx("now", "2026-10-04", -1000),
];
const calendar = budgetCalendar(rows, "2026-10-05");

it("period menu: budget months newest first, rolling and multi-month resolution", () => {
  // lists budget months newest first with real ranges, then rolling choices
  {
    const options = periodOptions(calendar, "2026-10-05");
    expect(options.map((o) => o.label)).toEqual([
      "Octobre",
      "Septembre",
      "Août",
      "Juillet",
      "30 derniers jours",
      "3 mois",
      "6 mois",
      "12 mois",
      "Tout l’historique",
    ]);
    expect(options[0].range).toEqual({
      from: "2026-09-25",
      to: "2026-10-25",
      estimatedEnd: true,
    });
    expect(options[2].range).toEqual({
      from: "2026-08-01",
      to: "2026-08-25",
      partial: true,
    });
  }
  // resolves rolling and multi-month periods against the budget calendar
  {
    expect(
      resolvePeriod({ kind: "rolling", days: 30 }, calendar, "2026-10-05"),
    ).toEqual({
      from: "2026-09-06",
      to: "2026-10-05",
      label: "30 derniers jours",
    });
    expect(
      resolvePeriod({ kind: "months", count: 3 }, calendar, "2026-10-05"),
    ).toMatchObject({
      from: "2026-08-01",
      to: "2026-10-25",
    });
    expect(
      resolvePeriod({ kind: "all" }, calendar, "2026-10-05"),
    ).toMatchObject({
      from: "2026-07-10",
      to: "2026-10-25",
    });
  }
});
