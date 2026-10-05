import { describe, expect, it } from "vitest";
import { forecastCash, weeklyPlan } from "./forecasting";
import { parseCSV } from "./importer";
import { emptySnapshot, type Snapshot } from "./types";

const base = (): Snapshot => ({
  ...structuredClone(emptySnapshot),
  accounts: [{ id: "A", checkpoint: { date: "2026-10-04", amount: 100000 } }],
});
describe("Revue indépendante interaction → contrats de finances", () => {
  it("protège une charge échue non rapprochée avant de proposer une dépense nouvelle", () => {
    const s = base();
    s.accounts[0].checkpoint!.amount = 10000;
    s.dues = [
      {
        id: "overdue",
        account: "A",
        date: "2026-10-02",
        amount: -9000,
        label: "Loyer impayé",
        category: "Logement",
      },
    ];
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Courses: 8000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    expect(
      weeklyPlan(s, "2026-10-05", "A", "2026-10-04").remaining,
    ).toBeLessThanOrEqual(1000);
  });
  it("inclut une charge encore non rapprochée due aujourd’hui dans le point bas", () => {
    const s = base();
    s.dues = [
      {
        id: "today",
        account: "A",
        date: "2026-10-04",
        amount: -80000,
        label: "Loyer à payer",
      },
    ];
    expect(forecastCash(s, "2026-10-10", "A", "2026-10-04").low?.value).toBe(
      20000,
    );
  });
  it("n’immobilise pas la capacité de cette semaine pour une charge au-delà de l’horizon", () => {
    const s = base();
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "A",
        limits: { Courses: 10000 },
        reserve: 0,
        reduction: 0,
      },
    ];
    s.dues = [
      {
        id: "future",
        account: "A",
        date: "2028-01-01",
        amount: -200000,
        label: "Projet lointain",
      },
    ];
    expect(weeklyPlan(s, "2026-10-05", "A", "2026-10-04").remaining).toBe(
      10000,
    );
  });
  it("rejette une opération SG dont la date sort de la période annoncée", () => {
    const file = parseCSV(
      "00012345678;01/09/2026;04/10/2026;1;02/10/2026;1000 EUR\n\nDate de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise\n31/08/2026;CARTE;CARTE REF;-10,00;EUR",
    );
    expect(file.errors.some((e) => /période|couverture|hors/i.test(e))).toBe(
      true,
    );
  });
  it("protège au moins les réserves des objectifs affectés au compte payeur", () => {
    const s = base();
    s.preferences.goal = {
      name: "Maison",
      account: "A",
      target: 1000000,
      saved: 30000,
    };
    expect(forecastCash(s, "2026-10-11", "A", "2026-10-04").reserve).toBe(
      30000,
    );
  });
});
