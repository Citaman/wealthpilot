import { beforeEach, expect, it } from "vitest";
import { balanceAt, coverageStatus } from "../domain/balances";
import { parseBackup } from "./backup";
import { updateTransactions } from "./commands";
import { db, readSnapshot } from "./db";
import {
  commitImport,
  StaleError,
  undoImport,
  type CommitOptions,
} from "./importer/commit";
import {
  importText,
  previewText,
  resetDatabase,
  sgFixture,
} from "./test-utils";

const source = (amount = "1000.00") =>
  sgFixture(
    amount,
    "02/10/2026;CARTE;CARTE A;-10,00;EUR\n01/10/2026;CARTE;CARTE B;-20,00;EUR",
  );
const accept = { checkpointDecisions: { Courant: "accept" as const } };
const ingest = (
  name = "one",
  text = source(),
  decisions: CommitOptions = accept,
) => importText(text, { name, ...decisions });
const backupRoundtrip = async () =>
  parseBackup(
    JSON.stringify({
      format: "wealthpilot-next",
      version: 1,
      data: await readSnapshot(),
    }),
  );

beforeEach(resetDatabase);

it("import atomique : ancre et couverture persistées, même fichier deux fois en parallèle, annulation (échéance libérée, opérations partagées gardées, compte créé supprimé)", async () => {
  // persiste ancre observée, identité bancaire et couverture complète
  {
    await resetDatabase();
    const batch = await ingest();
    const a = (await db.accounts.get("Courant"))!;
    expect(a.bankAccountId).toBe("00012345678");
    expect(a.checkpoint).toMatchObject({
      date: "2026-10-02",
      amount: 100000,
      status: "observed",
      sourceHash: "one",
      batchId: batch.id,
    });
    expect(a.coverage?.[0]).toMatchObject({
      from: "2026-09-01",
      through: "2026-10-02",
      complete: true,
    });
    const transactions = await db.transactions.toArray();
    expect(transactions.every((t) => t.importedState)).toBe(true);
    expect(balanceAt(a, transactions, "2026-09-30")).toBe(103000);
    expect(balanceAt(a, transactions, "2026-10-01")).toBe(101000);
    expect(balanceAt(a, transactions, "2026-10-02")).toBe(100000);
    expect(coverageStatus(a, "2026-10-03")).toBe("incomplete");
    expect(batch.metadata?.accounts[0].coverageThrough).toBe("2026-10-04");
    expect(await backupRoundtrip()).toEqual(await readSnapshot());
  }
  // un même fichier importé deux fois en parallèle ne crée qu’un lot ; vide et doublon refusés
  {
    await resetDatabase();
    const preview = await previewText(
      "date;amount;libelle\n2026-10-02;-10;Courses",
      undefined,
      "hash",
    );
    const results = await Promise.allSettled([
      commitImport(preview),
      commitImport(preview),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    db.close();
    await db.open();
    const imported = await readSnapshot();
    expect(imported.transactions).toHaveLength(1);
    expect(imported.accounts).toEqual([{ id: "Courant" }]);
    await expect(commitImport(preview)).rejects.toThrow(/déjà/);
    const empty = await previewText(
      "date;amount;libelle\n2026-10-02;-10;Courses",
      undefined,
      "other",
    );
    await expect(commitImport(empty, { selected: new Set() })).rejects.toThrow(
      /Aucune/,
    );
    expect(await readSnapshot()).toEqual(imported);
  }
  // annule en libérant le rapprochement d’échéance et garde le compte
  {
    await resetDatabase();
    const batch = await importText(
      "date;amount;libelle\n2026-10-02;-10;Courses",
    );
    const t = (await db.transactions.toArray())[0];
    await db.dues.add({
      id: "due",
      label: "Facture",
      date: t.date,
      account: t.account,
      amount: t.amount,
      transactionId: t.id,
    });
    await undoImport(batch.id);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.batches.count()).toBe(0);
    expect((await db.dues.get("due"))?.transactionId).toBeUndefined();
    expect(await db.accounts.count()).toBe(1);
  }
  // supprime le compte créé par le lot quand plus rien n’y fait référence
  {
    await resetDatabase();
    const batch = await importText(
      "date;amount;libelle\n2026-10-02;-10;Courses",
    );
    expect(await db.accounts.count()).toBe(1);
    await undoImport(batch.id);
    expect(await db.accounts.count()).toBe(0);
  }
  // garde les opérations partagées et met à jour le lot qui les reprend
  {
    await resetDatabase();
    const original = await ingest();
    const overlap = await importText(source(), {
      name: "overlap",
      selected: new Set(),
      ...accept,
    });
    expect(overlap.count).toBe(0);
    expect(overlap.transactionIds).toHaveLength(2);
    await undoImport(original.id);
    expect(await db.transactions.count()).toBe(2);
    expect(
      (await db.transactions.toArray()).every((t) => t.batchId === overlap.id),
    ).toBe(true);
    expect(await db.batches.get(overlap.id)).toMatchObject({
      count: 2,
      minDate: "2026-10-01",
      maxDate: "2026-10-02",
    });
    expect((await db.accounts.get("Courant"))?.checkpoint?.sourceHash).toBe(
      "overlap",
    );
    await expect(backupRoundtrip()).resolves.toBeTruthy();
    await undoImport(overlap.id);
    expect(await db.transactions.count()).toBe(0);
  }
});

it("aperçu périmé : un solde modifié bloque, une recatégorisation non", async () => {
  // aperçu périmé : un solde modifié bloque, une recatégorisation non
  {
    await resetDatabase();
    await ingest();
    const preview = await previewText(source(), undefined, "other");
    const [t] = await db.transactions.toArray();
    await updateTransactions([t.id], { category: "Courses" });
    const edited = await previewText(source(), undefined, "other");
    expect(edited.token).toBe(preview.token);
    await db.accounts.update("Courant", {
      checkpoint: { date: "2026-10-02", amount: 99999 },
    });
    await expect(commitImport(preview, accept)).rejects.toBeInstanceOf(
      StaleError,
    );
    expect(await db.batches.count()).toBe(1);
  }
});
