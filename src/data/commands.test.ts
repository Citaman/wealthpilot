import { beforeEach, expect, it } from "vitest";
import type { Due, Transaction } from "../domain/types";
import {
  adjustOccurrence,
  ConflictError,
  ignoreOccurrence,
  patchPreferences,
  restoreOccurrence,
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

it("commandes annulables : préférences, opération éditée, ajustement d’occurrence restaurés exactement", async () => {
  // ne touche que les clés produites, conserve le legacy et s’annule exactement
  {
    await resetDatabase();
    await db.accounts.bulkPut([{ id: "A" }, { id: "B" }]);
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
  }
  // ne modifie que les champs éditables et restaure exactement
  {
    await resetDatabase();
    await db.accounts.bulkPut([{ id: "A" }, { id: "B" }]);
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
  }
  // ajuste une occurrence, la modifie encore, puis annule exactement
  {
    await resetDatabase();
    await db.accounts.bulkPut([{ id: "A" }, { id: "B" }]);
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
  }
});

it("concurrence : deux ajustements de la même occurrence ne créent qu’une charge, un ajustement déjà fait est refusé (ConflictError)", async () => {
  // deux ajustements concurrents de la même occurrence estimée ne créent qu’une charge
  {
    await resetDatabase();
    await db.accounts.bulkPut([{ id: "A" }, { id: "B" }]);
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
  }
  // refuse un ajustement déjà fait dans un autre onglet ou une occurrence ignorée
  {
    await resetDatabase();
    await db.accounts.bulkPut([{ id: "A" }, { id: "B" }]);
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
  }
});
