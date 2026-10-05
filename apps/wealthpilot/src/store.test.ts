import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { WealthDatabase, validateBackup, restoreBackup } from "./store";
import { parseCSV, detectMapping, previewImport, exportCSV } from "./importer";
import { widgetNames, type WidgetId } from "./types";
let database: WealthDatabase;
const candidates = () => {
  const file = parseCSV("date;amount;libelle\n2026-10-02;-10;Courses");
  return previewImport(file, detectMapping(file.fields), "Courant", []);
};
beforeEach(() => {
  database = new WealthDatabase("WealthPilotTest-" + crypto.randomUUID());
});
afterEach(async () => {
  await database.delete();
});
describe("Parcours de persistance et récupération", () => {
  it("importe avec concurrence, rouvre, refuse le doublon et annule en restaurant le rapprochement", async () => {
    const results = await Promise.allSettled([
      database.importBatch("a", "hash", candidates(), new Set([2])),
      database.importBatch("b", "hash", candidates(), new Set([2])),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    database.close();
    await database.open();
    const imported = await database.snapshot();
    expect(imported.transactions).toHaveLength(1);
    expect(imported.batches).toHaveLength(1);
    expect(imported.accounts[0]).toMatchObject({ id: "Courant" });
    expect(imported.accounts[0].checkpoint).toBeUndefined();
    await expect(
      database.importBatch("copy", "hash", candidates(), new Set([2])),
    ).rejects.toThrow(/déjà/);
    await expect(
      database.importBatch("empty", "empty-hash", candidates(), new Set()),
    ).rejects.toThrow();
    expect(await database.snapshot()).toEqual(imported);
    const transaction = imported.transactions[0];
    await database.dues.add({
      id: "due",
      label: "Facture",
      date: transaction.date,
      account: transaction.account,
      amount: transaction.amount,
      transactionId: transaction.id,
    });
    await database.undoBatch(imported.batches[0].id);
    const undone = await database.snapshot();
    expect(undone.transactions).toHaveLength(0);
    expect(undone.batches).toHaveLength(0);
    expect(undone.dues[0].transactionId).toBeUndefined();
    expect(undone.accounts).toHaveLength(1);
  });
  it("exporte, valide et restaure toutes les données, puis refuse une sauvegarde corrompue sans suppression", async () => {
    await database.importBatch("test", "hash", candidates(), new Set([2]));
    const prefs = (await database.snapshot()).preferences;
    await database.preferences.put({
      ...prefs,
      widgets: Object.keys(widgetNames) as WidgetId[],
      sizes: { balance: "tiny", goals: "xlarge" },
      extraGoals: [
        { name: "Maison", target: 300000, saved: 20000, monthly: 5000 },
      ],
      dismissedRecurrences: ["recurrence-demo"],
      setupDone: true,
    });
    await database.budgets.put({
      id: "b",
      category: "Courses",
      amount: 15000,
      month: "2026-10",
    });
    const before = await database.snapshot(),
      envelope = { format: "wealthpilot-next", version: 1, data: before };
    const valid = validateBackup(JSON.parse(JSON.stringify(envelope)));
    await restoreBackup(valid, database);
    database.close();
    await database.open();
    expect(await database.snapshot()).toEqual(before);
    const file = parseCSV(exportCSV(before.transactions));
    expect(
      previewImport(
        file,
        detectMapping(file.fields),
        "Courant",
        before.transactions,
      ).every((r) => r.duplicate && !r.error),
    ).toBe(true);
    const corrupted = structuredClone(envelope);
    corrupted.data.transactions[0].account = "absent";
    expect(() => validateBackup(corrupted)).toThrow();
    expect(await database.snapshot()).toEqual(before);
  });
});
