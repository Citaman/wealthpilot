import { expect, it } from "vitest";
import { available } from "./available";
import { upcoming } from "./events";
import { inbox } from "./inbox";
import { forecast } from "./forecast";
import {
  anchored,
  budget,
  due,
  ledgerOf,
  tx,
  type World,
} from "./test-fixtures";

const values = (w: World, asOf: string, end: string, account = "") =>
  forecast(ledgerOf(w, asOf), account, end).points.map((p) => p.value);

const brief = (salary = "2026-10-09"): World => ({
  accounts: [anchored("A", "2026-10-02", 100000)],
  dues: [
    due("charge", "2026-10-06", -30000),
    due("salary", salary, 50000),
    due("grocery", "2026-10-10", -10000, { category: "Courses" }),
  ],
  prefs: { safety: 20000 },
});

it("fixture du brief 4 oct 2026 : soldes de fin de journée 5–11 oct, point bas, salaire retardé, virements internes neutres, opération future comptée une fois", () => {
  // projects end-of-day balances 5–11 Oct without turning the reserve into a debit
  {
    for (const account of ["", "A"]) {
      const f = forecast(
        ledgerOf(brief(), "2026-10-04"),
        account,
        "2026-10-11",
      );
      expect(f.points.slice(1).map((p) => p.value)).toEqual([
        100000, 70000, 70000, 70000, 120000, 110000, 110000,
      ]);
      expect(f.lowPoint).toMatchObject({ date: "2026-10-06", value: 70000 });
    }
    expect(
      forecast(ledgerOf(brief(), "2026-10-04"), "", "2026-10-11").reserve,
    ).toBe(20000);
  }
  // does not credit a delayed salary on the 9th
  {
    expect(values(brief("2026-10-12"), "2026-10-04", "2026-10-11").at(-1)).toBe(
      60000,
    );
  }
  // credits the salary on the 26th before debiting the 28th
  {
    const w = {
      ...base(),
      dues: [
        due("pay", "2026-10-26", 50000),
        due("rent", "2026-10-28", -30000),
      ],
    };
    const f = forecast(ledgerOf(w, "2026-10-04"), "A", "2026-10-31");
    expect(f.points.find((p) => p.date === "2026-10-25")?.value).toBe(100000);
    expect(f.points.find((p) => p.date === "2026-10-26")?.value).toBe(150000);
    expect(f.points.at(-1)?.value).toBe(120000);
  }
  // keeps internal transfers cash-neutral for the household but real for each payer
  {
    const w: World = {
      accounts: [
        anchored("A", "2026-10-04", 100000),
        anchored("B", "2026-10-04", 10000),
      ],
      transactions: [
        tx("out", "2026-10-06", -5000, { internal: true }),
        tx("in", "2026-10-06", 5000, { account: "B", internal: true }),
      ],
    };
    expect(values(w, "2026-10-04", "2026-10-07").at(-1)).toBe(110000);
    expect(values(w, "2026-10-04", "2026-10-07", "A").at(-1)).toBe(95000);
    const nested = {
      ...w,
      budgets: [
        budget("g", "2026-10", "Courses", 10000),
        budget("a", "2026-10", "Courses", 6000, "A"),
      ],
    };
    const household = forecast(
      ledgerOf(nested, "2026-10-04"),
      "",
      "2026-10-31",
    );
    expect(household.provisions["2026-10"]).toBe(10000);
    expect(household.points.at(-1)?.value).toBe(100000);
    const payer = forecast(ledgerOf(nested, "2026-10-04"), "A", "2026-10-31");
    expect(payer.provisions["2026-10"]).toBe(6000);
    expect(payer.points.at(-1)?.value).toBe(89000);
  }
  // counts a known future operation once and drops its linked due
  {
    const t = tx("bill", "2026-10-06", -10000);
    const w = {
      ...base(),
      transactions: [t],
      dues: [due("d", "2026-10-06", -10000, { transactionId: t.id })],
    };
    expect(values(w, "2026-10-04", "2026-10-07", "A").at(-1)).toBe(90000);
  }
});

const base = (): World => ({
  accounts: [anchored("A", "2026-10-04", 100000)],
});

it("échéances en retard : dues non rapprochées appliquées à asOf, > 31 jours écartées, revenu en retard jamais compté comme cash", () => {
  // applies unreconciled overdue and same-day dues at asOf, so the low point sees them
  {
    const w = {
      ...base(),
      dues: [
        due("today", "2026-10-04", -80000),
        due("late", "2026-10-01", -5000),
      ],
    };
    const f = forecast(ledgerOf(w, "2026-10-04"), "A", "2026-10-10");
    expect(f.points[0].value).toBe(15000);
    expect(f.lowPoint?.value).toBe(15000);
    expect(f.events.find((e) => e.id === "late")?.overdue).toBe(true);
  }
  // drops unreconciled dues older than 31 days from cash, leaving them to the inbox
  {
    const w = {
      ...base(),
      dues: [
        due("recent", "2026-09-10", -5000),
        due("stale", "2026-09-02", -7000),
      ],
    };
    const ledger = ledgerOf(w, "2026-10-04");
    expect(forecast(ledger, "A", "2026-10-10").points[0].value).toBe(95000);
    expect(available(ledger, "").charges.map((c) => c.id)).toEqual(["recent"]);
    expect(inbox(ledger, "")).toContainEqual({
      kind: "overdue",
      ids: ["stale"],
    });
  }
  // never counts a late income as cash, estimated or manual, but keeps it listed
  {
    const salaries = ["07", "08", "09"].map((m) =>
      tx(`pay-${m}`, `2026-${m}-01`, 200000, { merchant: "Salaire" }),
    );
    const w = {
      ...base(),
      transactions: salaries,
      dues: [due("refund", "2026-10-02", 3000)],
    };
    const ledger = ledgerOf(w, "2026-10-04");
    const late = upcoming(ledger, "A", "2026-10-10").filter(
      (o) => o.amount > 0,
    );
    expect(late.map((o) => [o.kind, o.date, o.overdue])).toEqual([
      ["estimate", "2026-10-01", true],
      ["due", "2026-10-02", true],
    ]);
    const f = forecast(ledger, "A", "2026-10-10");
    expect(f.points.map((p) => p.value)).toEqual(f.points.map(() => 100000));
    expect(available(ledger, "")).toMatchObject({ free: 100000 });
    expect(available(ledger, "").expectedIncome).toHaveLength(2);
  }
});
