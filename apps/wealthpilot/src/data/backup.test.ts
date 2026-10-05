import { beforeEach, describe, expect, it } from "vitest";
import type { Snapshot } from "../domain/types";
import {
  backupInventory,
  exportBackup,
  exportTransactionsCsv,
  parseBackup,
  restoreBackup,
} from "./backup";
import { db, readSnapshot } from "./db";
import { undoBlockers, undoImport } from "./importer/commit";
import legacy from "./fixtures/legacy-backup.json";
import {
  importText,
  previewText,
  resetDatabase,
  sgFixture,
} from "./test-utils";

const envelope = (data: unknown) =>
  JSON.stringify({ format: "wealthpilot-next", version: 1, data });
const legacyJson = JSON.stringify(legacy);
const legacySnapshot = () =>
  structuredClone(legacy.data) as unknown as Snapshot;

beforeEach(resetDatabase);

describe("Sauvegardes", () => {
  it("exporte, valide et restaure toutes les données, puis refuse une sauvegarde corrompue", async () => {
    await importText(sgFixture(), {
      checkpointDecisions: { Courant: "accept" },
    });
    await db.budgets.put({
      id: "b",
      category: "Courses",
      amount: 15000,
      month: "2026-10",
    });
    const before = await readSnapshot();
    const json = await exportBackup();
    await resetDatabase();
    await restoreBackup(parseBackup(json));
    db.close();
    await db.open();
    expect(await readSnapshot()).toEqual(before);
    const corrupted = JSON.parse(json);
    corrupted.data.transactions[0].account = "absent";
    expect(() => parseBackup(JSON.stringify(corrupted))).toThrow(/opération/);
    expect(() => parseBackup("{")).toThrow(/JSON/);
    expect(() => parseBackup(envelope(undefined))).toThrow(/format/);
    expect(await readSnapshot()).toEqual(before);
  });

  it("restaure une sauvegarde de l’ancienne application avec tous ses champs legacy", async () => {
    const restored = parseBackup(legacyJson);
    expect(restored).toEqual(legacy.data);
    await restoreBackup(restored);
    const after = await readSnapshot();
    expect(after.preferences).toEqual(legacy.data.preferences);
    expect(after.preferences.board).toMatchObject({
      views: [{ name: "Mon dashboard" }, { name: "Commun" }],
    });
    expect(after.preferences.dockPages).toContain("previsions");
    expect(JSON.parse(await exportBackup()).data).toEqual(legacy.data);
    expect(backupInventory(restored)).toEqual({
      transactions: 5,
      accounts: 2,
      batches: 3,
      budgets: 2,
      dues: 3,
      from: "2026-09-25",
      through: "2026-10-02",
    });
  });

  it("une valeur legacy malformée ne bloque jamais la restauration", () => {
    const s = legacySnapshot();
    Object.assign(s.preferences, {
      board: { views: "cassé" },
      widgetViews: { inconnu: 42 },
      tones: ["x"],
      sizes: null,
      goal: { name: "" },
      extraGoals: "?",
      cycleStartDay: 99,
      dockPages: ["retired", "retired"],
      householdPlan: { members: [] },
      scenarios: [{}],
      budgetLimit: 7,
      widgets: ["supprimé"],
      budgetView: "grid",
      unknownFutureKey: { nested: [1, 2] },
    });
    expect(parseBackup(envelope(s)).preferences).toEqual(s.preferences);
  });

  it("annuler un lot restauré dont une opération corrigée est partagée n’est pas bloqué", async () => {
    await restoreBackup(parseBackup(legacyJson));
    const original = legacy.data.batches.find(
      (b) => b.name === "releve-sg.csv",
    )!;
    const reexport = legacy.data.batches.find(
      (b) => b.name === "releve-sg-bis.csv",
    )!;
    expect(await undoBlockers(original.id)).toEqual([]);
    await undoImport(original.id);
    expect(
      await db.transactions.where("batchId").equals(reexport.id).count(),
    ).toBe(3);
    expect(await db.batches.get(reexport.id)).toMatchObject({ count: 3 });
    expect(
      (await db.transactions.filter((t) => t.note === "corrigé").first())
        ?.category,
    ).toBe("Courses");
  });

  it("valide portées, provenance, plans de la semaine et ascendance des catégories", () => {
    const s = legacySnapshot();
    const ok = () => parseBackup(envelope(s));
    expect(ok).not.toThrow();
    s.accounts[0].coverage = [
      { ...s.accounts[1].coverage![0], batchId: "missing" },
    ];
    expect(ok).toThrow(/compte/);
    Object.assign(s, legacySnapshot());
    s.preferences.weeklyPlans![0].start = "2026-10-06";
    expect(ok).toThrow(/semaine/);
    Object.assign(s, legacySnapshot());
    s.budgets.push({ ...s.budgets[0], id: "dup" });
    expect(ok).toThrow(/enveloppes/);
    Object.assign(s, legacySnapshot());
    const edited = s.transactions.find((t) => t.categoryId)!;
    edited.categoryId = "home";
    expect(ok).toThrow(/catégorie/);
    Object.assign(s, legacySnapshot());
    s.preferences.categoryDefinitions![0].parentId = "groceries";
    expect(ok).toThrow(/parente/);
    Object.assign(s, legacySnapshot());
    s.preferences.categoryDefinitions!.push({
      id: "again",
      name: " alimentation ",
    });
    expect(ok).toThrow(/catégories en double/);
    Object.assign(s, legacySnapshot());
    s.transactions[0].amount += 1;
    expect(ok).toThrow(/opération/);
  });
});

describe("Export CSV des opérations", () => {
  it("BOM, point-virgule, montants français, formules neutralisées et réimport idempotent", async () => {
    await importText(
      "date;amount;libelle\n2026-10-02;-1234,5;=SOMME(A1)\n2026-10-03;12;Remboursement",
      {},
    );
    const rows = await db.transactions.toArray();
    const csv = exportTransactionsCsv(rows, { Courant: "Compte de Sam" });
    expect(csv.startsWith("\uFEFFdate;account;account_name;amount;")).toBe(
      true,
    );
    expect(csv).toContain(";-1234,50;");
    expect(csv).toContain("'=SOMME(A1)");
    expect(csv).toContain(";Compte de Sam;");
    const again = await previewText(
      exportTransactionsCsv(rows.filter((t) => t.amount > 0)),
      {},
      "export.csv",
    );
    expect(again.counts).toEqual({ new: 0, duplicate: 1, invalid: 0 });
  });
});
