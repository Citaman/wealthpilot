import { describe, expect, it } from "vitest";
import { searchScore } from "./search";
import { brandFor } from "./merchants";
import { readLegacyPlan, mergeLegacyGoals } from "./intelligence";
import { validateBackup } from "./store";
import { emptySnapshot } from "./types";
import { parseCSV, detectMapping, previewImport, exportCSV } from "./importer";
import type { Transaction } from "./types";
const t: Transaction = {
  id: "1",
  batchId: "b",
  date: "2026-10-02",
  amount: -2490,
  account: "Commun",
  merchant: "McDonald's",
  label: "CB MCDONALDS PARIS",
  category: "Restauration",
  subcategory: "Fast food",
  internal: false,
  fingerprint: "",
  raw: {},
};
describe("Recherche, identités et récupération", () => {
  it("retrouve mcdo dans différentes écritures sans dictionnaire de synonymes", () => {
    for (const merchant of ["McDonald's", "Macdonalds", "MCDONALDS PARIS"])
      expect(
        searchScore({ ...t, merchant, label: merchant }, "mcdo"),
      ).toBeGreaterThan(0);
  });
  it("tolère accents et une faute, tout en imposant tous les mots", () => {
    expect(
      searchScore(
        { ...t, merchant: "Boulangerie Émile", label: "" },
        "emile boulangerie",
      ),
    ).toBeGreaterThan(0);
    expect(
      searchScore({ ...t, merchant: "Carrefour", label: "" }, "carrefor"),
    ).toBeGreaterThan(0);
    expect(searchScore(t, "mcdo pharmacie")).toBe(0);
    expect(
      searchScore({ ...t, merchant: "Laboratoire Central", label: "" }, "mcdo"),
    ).toBe(0);
  });
  it("préfère un résultat exact à une abréviation et trouve les notes", () => {
    expect(searchScore(t, "mcdonalds")).toBeGreaterThan(searchScore(t, "mcdo"));
    expect(
      searchScore({ ...t, note: "Anniversaire Léa" }, "anniversaire lea"),
    ).toBeGreaterThan(0);
  });
  it("résout des logos locaux et laisse les entités inconnues génériques", () => {
    expect(brandFor("CB MCDONALDS PARIS")?.slug).toBe("mcdonalds");
    expect(brandFor("Spotify")?.slug).toBe("spotify");
    expect(brandFor("Laboratoire Central")).toBeNull();
  });
  it("reprend le solde lié et conserve échéance et identité historique", () => {
    const result = readLegacyPlan({
      meta: { formatVersion: 1 },
      tables: {
        goals: [
          {
            id: 42,
            name: "Maison",
            targetAmount: 25000,
            currentAmount: 0,
            linkedAccountId: 7,
            deadline: "2028-06-01",
            isActive: true,
          },
        ],
        accounts: [{ id: 7, balance: 6200 }],
        budgets: [],
      },
    });
    expect(result.goals[0]).toMatchObject({
      saved: 620000,
      target: 2500000,
      legacyId: "42",
      deadline: "2028-06-01",
    });
  });
  it("fusionne les modèles traduits avec un bilan explicite et sans écraser implicitement", () => {
    const old = {
      name: "Emergency Fund",
      target: 300000,
      saved: 50000,
      legacyId: "1",
    };
    const current = [
      { name: "Fonds de sécurité", target: 300000, saved: 10000 },
    ];
    expect(mergeLegacyGoals(current, [old])).toEqual({
      goals: current,
      added: 0,
      replaced: 0,
      skipped: 1,
    });
    const merged = mergeLegacyGoals(current, [old], true);
    expect(merged.goals).toHaveLength(1);
    expect(merged.goals[0].saved).toBe(50000);
    expect(merged).toMatchObject({ added: 0, replaced: 1, skipped: 0 });
    expect(mergeLegacyGoals(merged.goals, [old], true).goals).toEqual(
      merged.goals,
    );
  });
  it("ne confond pas deux objectifs historiques distincts portant le même nom", () => {
    const first = {
      name: "Maison",
      target: 300000,
      saved: 10000,
      legacyId: "1",
    };
    const second = { ...first, legacyId: "2" };
    expect(mergeLegacyGoals([first], [second], true)).toMatchObject({
      goals: [first, second],
      added: 1,
      replaced: 0,
    });
  });
  it("n’emprunte pas un logo à un mot ressemblant à une marque", () => {
    for (const name of [
      "Boulangerie Emile",
      "Orangeade du marché",
      "Notionnel Banque",
      "Appleton Bakery",
    ])
      expect(brandFor(name), name).toBeNull();
    expect(brandFor("CB Burger King PARIS")?.slug).toBe("burgerking");
  });
  it("normalise les échéances migrées pour permettre la restauration de la sauvegarde", () => {
    const result = readLegacyPlan({
      meta: { formatVersion: 1 },
      tables: {
        goals: [
          {
            name: "Maison",
            targetAmount: 500,
            currentAmount: 20,
            deadline: "2028-06-01T00:00:00Z",
          },
        ],
        budgets: [],
      },
    });
    expect(result.goals[0].deadline).toBe("2028-06-01");
    const s = structuredClone(emptySnapshot);
    s.preferences.goal = result.goals[0];
    expect(
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).toEqual(s);
    expect(() =>
      readLegacyPlan({
        meta: { formatVersion: 1 },
        tables: {
          goals: [
            {
              name: "Maison",
              targetAmount: 500,
              currentAmount: 20,
              deadline: "2028-02-31",
            },
          ],
          budgets: [],
        },
      }),
    ).toThrow(/Échéance invalide/);
  });
  it("signale un compte lié à découvert et conserve les autres objectifs valides", () => {
    const result = readLegacyPlan({
      meta: { formatVersion: 1 },
      tables: {
        goals: [
          {
            name: "Compte à vérifier",
            targetAmount: 500,
            currentAmount: 20,
            linkedAccountId: 1,
          },
          { name: "Vacances", targetAmount: 800, currentAmount: 100 },
        ],
        accounts: [{ id: 1, balance: -30 }],
        budgets: [],
      },
    });
    expect(result.goals).toEqual([
      { name: "Vacances", target: 80000, saved: 10000 },
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/Compte à vérifier.*négatif/);
  });
  it("conserve les corrections et sous-catégories dans un export réimporté", () => {
    const original = {
      ...t,
      merchantName: "Restaurant du quartier",
      note: "Famille",
      reviewed: true,
    };
    const file = parseCSV(exportCSV([original]));
    const row = previewImport(file, detectMapping(file.fields), "", [])[0]
      .transaction;
    expect(row).toMatchObject({
      merchant: "McDonald's",
      merchantName: original.merchantName,
      note: "Famille",
      subcategory: "Fast food",
      reviewed: true,
    });
  });
});
