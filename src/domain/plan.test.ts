import { expect, it } from "vitest";
import { demoSnapshot } from "../dev/demo";
import { buildLedger, financePrefs } from "./ledger";
import {
  allowances,
  myShare,
  people,
  scenarios,
  settlement,
  trajectory,
} from "./plan";

const asOf = "2026-10-05";
const s = demoSnapshot(asOf);
const ledger = buildLedger({ ...s, prefs: financePrefs(s.preferences) }, asOf);

it("répartition par salaires récents, salaire de référence saisi, règlement, allocations personnelles seulement", () => {
  // splits by the latest salaries, the higher earner first
  {
    const p = people(ledger, {})!;
    expect(p.me).toBe("Alex");
    expect(p.partner).toBe("Sam");
    expect(p.share).toBeCloseTo(265000 / (265000 + 218000), 5);
    expect(myShare("personal", p)).toBeNull();
    expect(myShare("half", p)).toBe(0.5);
  }
  // settlement: partner owes my fair share of what I paid for shared groups
  {
    const p = people(ledger, {})!;
    const { usual } = settlement(ledger, {}, p);
    for (const g of usual)
      expect(g.balance).toBe(
        g.share === null ? 0 : Math.round(g.paidMe - g.total * g.share),
      );
    const rent = usual.find((g) => g.group === "Housing · Rent")!;
    expect(rent.mode).toBe("income");
    const personal = settlement(
      ledger,
      { modes: { "Housing · Rent": "me" } },
      p,
    ).usual.find((g) => g.group === "Housing · Rent")!;
    expect(personal.balance).toBe(0);
  }
  // a typed reference salary replaces the detected one in the key
  {
    const p = people(ledger, { incomes: { Sam: 189248 } })!;
    expect(p.partnerIncome).toBe(189248);
    expect(p.share).toBeCloseTo(265000 / (265000 + 189248), 5);
  }
  // weekly allowances only cover personal spending
  {
    const rows = allowances(ledger, {}, "Sam", 10000);
    expect(rows.every((r) => r.category !== "Courses")).toBe(true);
  }
});

it("trajectoire : effort relève chaque mois futur, charge temporaire arrêtée ; un seul scénario recommandé", () => {
  // an effort raises every future month by the saved amount, a temporary charge stops
  {
    const base = trajectory(ledger, {});
    const saving = trajectory(ledger, { effort: 2000 });
    saving.months
      .slice(1)
      .forEach((m, i) =>
        expect(m.withEffort).toBeGreaterThan(base.months[i + 1].end),
      );
    const rent = base.fixed.find((f) => f.name.includes("Loyer"))!;
    const ended = trajectory(ledger, {
      ends: { [rent.key]: base.months[1].key },
    });
    expect(ended.months[3].end - base.months[3].end).toBe(2 * rent.monthly);
  }
  // recommends the earliest month reachable without high pressure
  {
    const list = scenarios(trajectory(ledger, {}));
    expect(list.filter((s) => s.recommended)).toHaveLength(1);
  }
});
