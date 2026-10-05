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

it("sauvegarde : aller-retour complet, refus d’une sauvegarde corrompue, ancienne application (fixture legacy), annulation d’un lot restauré", async () => {
  // exporte, valide et restaure toutes les données, puis refuse une sauvegarde corrompue
  {
    await resetDatabase();
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
  }
  // restaure une sauvegarde de l’ancienne application avec tous ses champs legacy
  {
    await resetDatabase();
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
  }
  // annuler un lot restauré dont une opération corrigée est partagée n’est pas bloqué
  {
    await resetDatabase();
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
  }
});

it("export CSV : BOM, point-virgule, montants français, formules neutralisées, réimport idempotent", async () => {
  // BOM, point-virgule, montants français, formules neutralisées et réimport idempotent
  {
    await resetDatabase();
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
  }
});
