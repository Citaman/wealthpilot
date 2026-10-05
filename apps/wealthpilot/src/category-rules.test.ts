import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WealthDatabase } from "./store";
import {
  defaultPreferences,
  type CategoryRule,
  type Transaction,
} from "./types";
import {
  applyCategoryPreview,
  previewCategoryRules,
  ruleMatches,
  undoCategoryChanges,
} from "./category-rules";
let db: WealthDatabase;
const rule = (patch: Partial<CategoryRule> = {}): CategoryRule => ({
  id: "rule",
  name: "Téléphone",
  pattern: "free mobile",
  account: "A",
  direction: "expense",
  category: "Télécom",
  subcategory: "Mobile",
  enabled: true,
  priority: 0,
  ...patch,
});
const tx = (id = "t", patch: Partial<Transaction> = {}): Transaction => ({
  id,
  batchId: "test",
  date: "2026-10-04",
  amount: -1999,
  account: "A",
  label: "PRLV FREE MOBILE",
  merchant: "Free Mobile",
  category: "À catégoriser",
  fingerprint: id,
  raw: { bank: "BRUT" },
  internal: false,
  ...patch,
});
beforeEach(() => {
  db = new WealthDatabase("category-test-" + crypto.randomUUID());
});
afterEach(async () => {
  await db.delete();
});
async function seed(transactions = [tx()], rules = [rule()]) {
  await db.transactions.bulkPut(transactions);
  await db.preferences.put({
    ...structuredClone(defaultPreferences),
    categoryRules: rules,
  });
}
describe("Règles explicites — contrat et sûreté", () => {
  it("respecte mots entiers, accents, compte et sens sans confondre Free et Freepik", () => {
    expect(
      ruleMatches(
        rule({ pattern: "électricité" }),
        tx("t", { label: "ÉLECTRICITÉ FRANCE" }),
      ),
    ).toBe(true);
    expect(
      ruleMatches(
        rule({ pattern: "free" }),
        tx("t", { label: "FREEPIK", merchant: "Freepik" }),
      ),
    ).toBe(false);
    expect(ruleMatches(rule(), tx("t", { account: "B" }))).toBe(false);
    expect(ruleMatches(rule(), tx("t", { amount: 1999 }))).toBe(false);
    expect(ruleMatches(rule(), tx("t", { internal: true }))).toBe(false);
  });
  it("prend la première règle active et protège toutes les catégories existantes et vérifiées", () => {
    const preview = previewCategoryRules(
      [
        tx(),
        tx("manual", { category: "Autres" }),
        tx("checked", { reviewed: true }),
      ],
      [rule({ id: "second", priority: 1, category: "Autre résultat" }), rule()],
    );
    expect(preview.changes).toHaveLength(1);
    expect(preview.changes[0].after.category).toBe("Télécom");
    expect(preview.protectedCount).toBe(2);
  });
  it("applique puis annule uniquement classification, préservant notes et brut", async () => {
    await seed();
    const preview = previewCategoryRules(await db.transactions.toArray(), [
      rule(),
    ]);
    const undo = await applyCategoryPreview(db, preview);
    expect((await db.transactions.get("t"))?.subcategory).toBe("Mobile");
    await db.transactions.update("t", { note: "Correction personnelle" });
    await undoCategoryChanges(db, undo);
    expect(await db.transactions.get("t")).toMatchObject({
      category: "À catégoriser",
      note: "Correction personnelle",
      raw: { bank: "BRUT" },
      amount: -1999,
    });
    expect((await db.transactions.get("t"))?.subcategory).toBeUndefined();
  });
  it("ne modifie rien si une seule ligne a changé depuis l’aperçu", async () => {
    await seed([tx("1"), tx("2")]);
    const preview = previewCategoryRules(await db.transactions.toArray(), [
      rule(),
    ]);
    await db.transactions.update("2", { category: "Manuelle" });
    await expect(applyCategoryPreview(db, preview)).rejects.toThrow(
      /opération a changé/,
    );
    expect((await db.transactions.get("1"))?.category).toBe("À catégoriser");
  });
  it("refuse une règle modifiée ou une nouvelle vérification depuis l’aperçu", async () => {
    await seed();
    const preview = previewCategoryRules(await db.transactions.toArray(), [
      rule(),
    ]);
    await db.preferences.put({
      ...structuredClone(defaultPreferences),
      categoryRules: [rule({ enabled: false })],
    });
    await expect(applyCategoryPreview(db, preview)).rejects.toThrow(
      /règles ont changé/,
    );
    await db.preferences.put({
      ...structuredClone(defaultPreferences),
      categoryRules: [rule()],
    });
    await db.transactions.update("t", { reviewed: true });
    await expect(applyCategoryPreview(db, preview)).rejects.toThrow(
      /opération a changé/,
    );
  });
  it("refuse l’annulation en conflit sans effacer d’autre classification", async () => {
    await seed([tx("1"), tx("2")]);
    const changes = await applyCategoryPreview(
      db,
      previewCategoryRules(await db.transactions.toArray(), [rule()]),
    );
    await db.transactions.update("2", { category: "Décision manuelle" });
    await expect(undoCategoryChanges(db, changes)).rejects.toThrow(
      /classification a changé/,
    );
    expect((await db.transactions.get("1"))?.category).toBe("Télécom");
  });
});
