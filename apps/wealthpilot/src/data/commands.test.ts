import { beforeEach, describe, expect, it } from "vitest";
import type { Due, Transaction } from "../domain/types";
import { checkpointForDate } from "../domain/balances";
import {
  adjustOccurrence,
  ConflictError,
  confirmRecurrence,
  deleteDue,
  dismissRecurrence,
  ignoreOccurrence,
  patchPreferences,
  renameAccount,
  reorderEnvelopes,
  restoreOccurrence,
  saveDashboard,
  saveDue,
  saveWeekLimit,
  setBudget,
  setCheckpoint,
  setSafety,
  updateTransactions,
  type TransactionPatch,
} from "./commands";
import { db, readPreferences } from "./db";
import { resetDatabase } from "./test-utils";

const tx = (id: string, amount = -1000): Transaction => ({
  id,
  batchId: "b",
  date: "2026-10-02",
  account: "A",
  amount,
  merchant: "Lidl",
  label: "CARTE LIDL",
  category: "Courses",
  internal: false,
  fingerprint: "",
  raw: {},
});
const estimate: Due = {
  id: 'estimate:["A","assurance",-1]:2026-10-12',
  label: "Assurance",
  amount: -1000,
  date: "2026-10-12",
  account: "A",
  estimated: true,
  confidence: 80,
  recurrenceKey: '["A","assurance",-1]',
};

beforeEach(async () => {
  await resetDatabase();
  await db.accounts.bulkPut([{ id: "A" }, { id: "B" }]);
});

describe("Préférences", () => {
  it("ne touche que les clés produites, conserve le legacy et s’annule exactement", async () => {
    await db.preferences.put({
      ...(await readPreferences()),
      board: { views: [{ id: "legacy" }] },
      dockPages: ["week", "goals"],
      safety: 5000,
    });
    const undo = await patchPreferences(() => ({
      safety: 9000,
      budgetOrder: ["Courses"],
    }));
    expect(await db.preferences.get("main")).toMatchObject({
      safety: 9000,
      budgetOrder: ["Courses"],
      board: { views: [{ id: "legacy" }] },
      dockPages: ["week", "goals"],
    });
    await undo();
    const restored = (await db.preferences.get("main"))!;
    expect(restored.safety).toBe(5000);
    expect("budgetOrder" in restored).toBe(false);
  });

  it("écrit les champs requis même sans ligne existante", async () => {
    await setSafety(60000);
    expect(await db.preferences.get("main")).toMatchObject({
      id: "main",
      safety: 60000,
      essentials: 0,
      weekly: null,
      goal: null,
      budgetView: "list",
    });
    await expect(setSafety(-1)).rejects.toThrow(RangeError);
  });

  it("dédoublonne ordres, récurrences ignorées et confirmées", async () => {
    await reorderEnvelopes(["Courses", "Loyer", "Courses"]);
    await dismissRecurrence("k1");
    await dismissRecurrence("k1");
    await dismissRecurrence("k2");
    const rule = {
      id: "r1",
      name: "Salaire",
      account: "A",
      amount: 200000,
      category: "Revenus",
      frequency: "monthly" as const,
      next: "2026-10-25",
      sourceKey: "k1",
    };
    await confirmRecurrence(rule);
    await confirmRecurrence({ ...rule, id: "r2", amount: 210000 });
    const p = await readPreferences();
    expect(p.budgetOrder).toEqual(["Courses", "Loyer"]);
    expect(p.dismissedRecurrences).toEqual(["k2"]);
    expect(p.recurrenceRules).toEqual([{ ...rule, id: "r2", amount: 210000 }]);
  });

  it("alias, plan de la semaine, réserve et disposition", async () => {
    await renameAccount("A", "  Compte de Sam ");
    await saveWeekLimit("", "2026-10-05", "Courses", 15000);
    const undo = await saveWeekLimit("", "2026-10-05", "Sorties", 5000);
    await saveWeekLimit("A", "2026-10-05", "Courses", 1000);
    await saveDashboard({
      version: 2,
      cards: [{ id: "c1", type: "balance", width: 8 }],
    });
    let p = await readPreferences();
    expect(p.accountAliases).toEqual({ A: "Compte de Sam" });
    expect(p.weeklyPlans).toEqual([
      {
        start: "2026-10-05",
        account: "",
        limits: { Courses: 15000, Sorties: 5000 },
        reduction: 0,
        reserve: 0,
      },
      {
        start: "2026-10-05",
        account: "A",
        limits: { Courses: 1000 },
        reduction: 0,
        reserve: 0,
      },
    ]);
    expect(p.dashboard?.cards[0].type).toBe("balance");
    await undo();
    await saveWeekLimit("", "2026-10-05", "Courses", null);
    await renameAccount("A", "");
    p = await readPreferences();
    expect(p.weeklyPlans?.[0]).toEqual({
      start: "2026-10-05",
      account: "A",
      limits: { Courses: 1000 },
      reduction: 0,
      reserve: 0,
    });
    expect(p.weeklyPlans?.[1].limits).toEqual({});
    expect(p.accountAliases).toEqual({});
    await expect(saveWeekLimit("", "2026-10-06", "Courses", 1)).rejects.toThrow(
      /lundi/,
    );
  });
});

describe("Opérations et enveloppes", () => {
  it("ne modifie que les champs éditables et restaure exactement", async () => {
    await db.transactions.add(tx("t1"));
    const patch = {
      category: "Restaurants",
      note: "midi",
      amount: 5,
    } as TransactionPatch;
    const undo = await updateTransactions(["t1"], patch);
    expect(await db.transactions.get("t1")).toMatchObject({
      category: "Restaurants",
      note: "midi",
      amount: -1000,
    });
    await undo();
    expect(await db.transactions.get("t1")).toEqual(tx("t1"));
    await expect(
      updateTransactions(["missing"], { category: "X" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("crée, met à jour et supprime une enveloppe par (mois, catégorie, compte)", async () => {
    const scope = { month: "2026-10", category: "Courses" };
    const created = await setBudget(scope, 30000);
    await setBudget({ ...scope, account: "A" }, 10000);
    const updated = await setBudget(scope, 35000);
    expect(await db.budgets.count()).toBe(2);
    expect((await db.budgets.toArray()).find((b) => !b.account)?.amount).toBe(
      35000,
    );
    await updated();
    expect((await db.budgets.toArray()).find((b) => !b.account)?.amount).toBe(
      30000,
    );
    const removed = await setBudget(scope, null);
    expect(await db.budgets.count()).toBe(1);
    await removed();
    await created();
    expect((await db.budgets.toArray()).map((b) => b.account)).toEqual(["A"]);
  });
});

describe("Échéances et occurrences", () => {
  it("deux ajustements concurrents de la même occurrence estimée ne créent qu’une charge", async () => {
    const results = await Promise.allSettled([
      adjustOccurrence(estimate, { amount: -1200 }),
      adjustOccurrence(estimate, { amount: -1300 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
    expect(rejected.reason.message).toBe(
      "Cette occurrence a déjà été ajustée ailleurs. Rouvrez le calendrier.",
    );
    expect(await db.dues.count()).toBe(1);
  });

  it("refuse un ajustement déjà fait dans un autre onglet ou une occurrence ignorée", async () => {
    await db.dues.put({
      id: "other-tab",
      originOccurrenceId: estimate.id,
      label: "Ailleurs",
      date: "2026-10-12",
      account: "A",
      amount: -1234,
    });
    await expect(adjustOccurrence(estimate, { amount: -1 })).rejects.toThrow(
      /déjà été ajustée ailleurs/,
    );
    await db.dues.clear();
    await ignoreOccurrence(estimate.id);
    await expect(adjustOccurrence(estimate, { amount: -1 })).rejects.toThrow(
      /ignorée/,
    );
    expect(await db.dues.count()).toBe(0);
  });

  it("ajuste une occurrence, la modifie encore, puis annule exactement", async () => {
    const undo = await adjustOccurrence(estimate, {
      amount: -1500,
      date: "2026-10-14",
    });
    const [due] = await db.dues.toArray();
    expect(due).toMatchObject({
      label: "Assurance",
      amount: -1500,
      date: "2026-10-14",
      originOccurrenceId: estimate.id,
    });
    expect(due.id.startsWith("estimate:")).toBe(false);
    expect(due).not.toHaveProperty("estimated");
    expect((await readPreferences()).ignoredOccurrences).toEqual([estimate.id]);
    await adjustOccurrence(due, { amount: -1600 });
    expect((await db.dues.get(due.id))?.amount).toBe(-1600);
    await expect(restoreOccurrence(estimate.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
    await undo();
    expect(await db.dues.count()).toBe(0);
    expect((await readPreferences()).ignoredOccurrences).toEqual([]);
  });

  it("un rapprochement est unique et cohérent avec l’opération", async () => {
    await db.transactions.add(tx("t1"));
    const due = {
      id: "d1",
      label: "Lidl",
      amount: -1000,
      date: "2026-10-02",
      account: "A",
      transactionId: "t1",
    };
    await saveDue(due);
    await expect(saveDue({ ...due, id: "d2" })).rejects.toThrow(
      /déjà utilisée/,
    );
    await expect(saveDue({ ...due, id: "d3", account: "B" })).rejects.toThrow(
      /incompatible/,
    );
    await expect(saveDue({ ...due, id: "d4", account: "Z" })).rejects.toThrow(
      /Compte inconnu/,
    );
    const undo = await deleteDue("d1");
    expect(await db.dues.count()).toBe(0);
    await undo();
    expect(await db.dues.get("d1")).toEqual(due);
  });

  it("ignorer puis réactiver une occurrence", async () => {
    const undo = await ignoreOccurrence("x");
    await ignoreOccurrence("x");
    expect((await readPreferences()).ignoredOccurrences).toEqual(["x"]);
    await restoreOccurrence("x");
    expect((await readPreferences()).ignoredOccurrences).toEqual([]);
    await ignoreOccurrence("y");
    await undo();
    expect((await readPreferences()).ignoredOccurrences).toEqual(["y"]);
  });
});

describe("Solde observé manuel", () => {
  it("dédoublonne par date, garde les soldes importés et gagne l’égalité de date", async () => {
    const imported = {
      date: "2026-10-02",
      amount: 100000,
      status: "observed" as const,
      sourceHash: "h",
      batchId: "b",
      accepted: true,
    };
    await db.accounts.put({
      id: "A",
      checkpoint: imported,
      checkpoints: [imported],
    });
    await setCheckpoint("A", { date: "2026-10-02", amount: 99000 });
    const undo = await setCheckpoint("A", {
      date: "2026-10-02",
      amount: 98000,
    });
    const a = (await db.accounts.get("A"))!;
    expect(a.checkpoints).toEqual([imported]);
    expect(a.checkpoint).toEqual({
      date: "2026-10-02",
      amount: 98000,
      status: "observed",
      accepted: true,
    });
    expect(checkpointForDate(a, "2026-10-02")?.amount).toBe(98000);
    await setCheckpoint("A", { date: "2026-10-04", amount: 97000 });
    const later = (await db.accounts.get("A"))!;
    expect(later.checkpoints?.map((c) => c.amount)).toEqual([100000, 98000]);
    expect(checkpointForDate(later, "2026-10-02")?.amount).toBe(98000);
    await undo();
    expect((await db.accounts.get("A"))?.checkpoint?.amount).toBe(99000);
  });
});
