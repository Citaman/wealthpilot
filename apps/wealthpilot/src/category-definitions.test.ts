import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WealthDatabase, validateBackup } from "./store";
import { emptySnapshot, type Snapshot } from "./types";
import { fingerprint } from "./importer";
import {
  applyCategoryDefinitionPlan,
  categoryCatalog,
  prepareCategoryChange,
} from "./category-definitions";
let db: WealthDatabase;
beforeEach(() => {
  db = new WealthDatabase("definitions-test-" + crypto.randomUUID());
});
afterEach(async () => {
  await db.delete();
});
async function seed() {
  const s: Snapshot = structuredClone(emptySnapshot);
  s.accounts = [{ id: "A" }];
  s.preferences.categoryDefinitions = [
    { id: "food", name: "Courses", icon: "food", color: "#203f64" },
    { id: "shop", name: "Shopping" },
    { id: "f-child", parentId: "food", name: "Quotidien" },
    { id: "s-child", parentId: "shop", name: "Quotidien" },
  ];
  s.transactions = ["Courses", "Shopping"].map((category, i) => ({
    id: "t" + i,
    batchId: "b",
    date: "2026-10-04",
    amount: -1234,
    account: "A",
    merchant: "Merchant",
    label: "BRUT",
    category,
    subcategory: "Quotidien",
    internal: false,
    fingerprint: "t" + i,
    raw: { source: "stable" },
    note: "Ma correction",
    reviewed: true,
  }));
  s.transactions = s.transactions.map((t) => ({
    ...t,
    fingerprint: fingerprint(t),
  }));
  s.batches = [
    {
      id: "b",
      name: "Fixture",
      hash: "fixture-hash",
      count: 2,
      minDate: "2026-10-04",
      maxDate: "2026-10-04",
      createdAt: "2026-10-04T12:00:00Z",
    },
  ];
  s.budgets = [
    {
      id: "b1",
      category: "Courses",
      account: "A",
      month: "2026-10",
      amount: 10000,
    },
    {
      id: "b2",
      category: "Shopping",
      account: "A",
      month: "2026-10",
      amount: 20000,
    },
    {
      id: "b3",
      category: "Courses",
      account: "A",
      month: "2026-11",
      amount: 30000,
    },
  ];
  s.dues = [
    {
      id: "d",
      category: "Courses",
      date: "2026-10-08",
      amount: -1000,
      account: "A",
      label: "Course prévue",
    },
  ];
  s.preferences.weeklyPlans = [
    {
      start: "2026-10-05",
      account: "A",
      limits: { Courses: 5000, Shopping: 4000 },
      reserve: 1000,
      reduction: 0,
    },
  ];
  s.preferences.categoryRules = [
    {
      id: "r",
      name: "Ma règle",
      pattern: "merchant",
      direction: "expense",
      category: "Courses",
      subcategory: "Quotidien",
      enabled: true,
      priority: 0,
    },
  ];
  await db.accounts.bulkPut(s.accounts);
  await db.batches.bulkPut(s.batches);
  await db.transactions.bulkPut(s.transactions);
  await db.budgets.bulkPut(s.budgets);
  await db.dues.bulkPut(s.dues);
  await db.preferences.put(s.preferences);
  return s;
}
describe("Arborescence — identités, aperçu et mutation atomique", () => {
  it("associe les données historiques puis renomme sans modifier les faits bancaires", async () => {
    const s = await seed();
    const registration = prepareCategoryChange(s, { kind: "register" });
    await applyCategoryDefinitionPlan(db, registration);
    const current = await db.snapshot();
    expect(current.transactions[0].categoryId).toBe("food");
    const change = prepareCategoryChange(current, {
      kind: "save",
      definition: {
        ...current.preferences.categoryDefinitions![0],
        name: "Alimentation",
      },
    });
    await applyCategoryDefinitionPlan(db, change);
    const after = await db.snapshot();
    expect(after.transactions[0]).toMatchObject({
      categoryId: "food",
      category: "Alimentation",
      amount: -1234,
      label: "BRUT",
      raw: { source: "stable" },
      reviewed: true,
      note: "Ma correction",
    });
    expect(after.dues[0].category).toBe("Alimentation");
    expect(after.preferences.weeklyPlans![0].limits.Alimentation).toBe(5000);
    expect(after.preferences.categoryRules![0].category).toBe("Alimentation");
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: after }),
    ).not.toThrow();
    await applyCategoryDefinitionPlan(db, change, true);
    expect((await db.transactions.get("t0"))?.category).toBe("Courses");
  });
  it("fusionne seulement budgets de mêmes mois/comptes et résout les enfants homonymes", async () => {
    const s = await seed();
    const plan = prepareCategoryChange(s, {
      kind: "merge",
      source: "food",
      target: "shop",
    });
    expect(plan.mergedBudgets).toBe(1);
    await applyCategoryDefinitionPlan(db, plan);
    const after = await db.snapshot();
    expect(after.budgets).toHaveLength(2);
    expect(after.budgets.find((b) => b.month === "2026-10")?.amount).toBe(
      30000,
    );
    expect(after.budgets.find((b) => b.month === "2026-11")?.amount).toBe(
      30000,
    );
    expect(
      after.transactions.every(
        (t) => t.categoryId === "shop" && t.subcategoryId === "s-child",
      ),
    ).toBe(true);
    expect(after.preferences.weeklyPlans![0].limits).toEqual({
      Shopping: 9000,
    });
    expect(
      after.preferences.categoryDefinitions?.find((d) => d.id === "food")
        ?.archived,
    ).toBe(true);
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: after }),
    ).not.toThrow();
    await applyCategoryDefinitionPlan(db, plan, true);
    expect(await db.budgets.count()).toBe(3);
    expect((await db.transactions.get("t0"))?.category).toBe("Courses");
  });
  it("archive sans supprimer les opérations ni leurs références", async () => {
    const s = await seed();
    await applyCategoryDefinitionPlan(
      db,
      prepareCategoryChange(s, { kind: "archive", id: "food", archived: true }),
    );
    const after = await db.snapshot();
    expect(after.transactions).toHaveLength(2);
    expect(after.transactions[0].categoryId).toBe("food");
    expect(
      after.preferences.categoryDefinitions?.find((d) => d.id === "f-child")
        ?.archived,
    ).toBe(true);
    expect(after.budgets.reduce((sum, b) => sum + b.amount, 0)).toBe(60000);
  });
  it("bloque toute la mutation si un budget ou une correction manuelle change", async () => {
    const s = await seed();
    const plan = prepareCategoryChange(s, {
      kind: "merge",
      source: "food",
      target: "shop",
    });
    await db.budgets.update("b1", { amount: 12000 });
    await expect(applyCategoryDefinitionPlan(db, plan)).rejects.toThrow(
      /données ont changé/,
    );
    expect((await db.transactions.get("t0"))?.category).toBe("Courses");
    expect(
      (await db.preferences.get("main"))?.categoryDefinitions?.find(
        (d) => d.id === "food",
      )?.archived,
    ).toBeUndefined();
  });
  it("bloque annulation concurrente mais conserve les préférences sans lien", async () => {
    const s = await seed();
    const plan = prepareCategoryChange(s, { kind: "register" });
    await applyCategoryDefinitionPlan(db, plan);
    const p = (await db.preferences.get("main"))!;
    await db.preferences.put({ ...p, safety: 9999 });
    await applyCategoryDefinitionPlan(db, plan, true);
    expect((await db.preferences.get("main"))?.safety).toBe(9999);
    const next = prepareCategoryChange(await db.snapshot(), {
      kind: "register",
    });
    await applyCategoryDefinitionPlan(db, next);
    await db.transactions.update("t0", { note: "Nouvelle note" });
    await expect(applyCategoryDefinitionPlan(db, next, true)).rejects.toThrow(
      /données ont changé/,
    );
    expect((await db.transactions.get("t0"))?.note).toBe("Nouvelle note");
  });
  it("interdit doublons de nom, cycles et fusion entre niveaux", async () => {
    const s = await seed();
    expect(() =>
      prepareCategoryChange(s, {
        kind: "save",
        definition: { id: "new", name: "courses" },
      }),
    ).toThrow(/existe/);
    expect(() =>
      prepareCategoryChange(s, {
        kind: "save",
        definition: { id: "new", name: "Petit enfant", parentId: "f-child" },
      }),
    ).toThrow(/parente/);
    expect(() =>
      prepareCategoryChange(s, {
        kind: "merge",
        source: "food",
        target: "f-child",
      }),
    ).toThrow(/niveau/);
    expect(categoryCatalog(s)).toHaveLength(4);
  });
});
