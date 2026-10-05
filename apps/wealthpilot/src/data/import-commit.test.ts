import { beforeEach, describe, expect, it } from "vitest";
import { balanceAt, coverageStatus } from "../domain/balances";
import { parseBackup } from "./backup";
import { updateTransactions } from "./commands";
import { db, readSnapshot } from "./db";
import {
  commitImport,
  StaleError,
  undoBlockers,
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

describe("Import atomique, provenance et annulation", () => {
  it("persiste ancre observée, identité bancaire et couverture complète", async () => {
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
  });

  it("exige une décision explicite sur les soldes, sans compte créé à moitié", async () => {
    await expect(
      ingest("h", source(), { checkpointDecisions: {} }),
    ).rejects.toThrow(/explicitement/);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });

  it("un même fichier importé deux fois en parallèle ne crée qu’un lot ; vide et doublon refusés", async () => {
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
  });

  it("annule en libérant le rapprochement d’échéance et garde le compte", async () => {
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
  });

  it("supprime le compte créé par le lot quand plus rien n’y fait référence", async () => {
    const batch = await importText("date;amount;libelle\n2026-10-02;-10;Courses");
    expect(await db.accounts.count()).toBe(1);
    await undoImport(batch.id);
    expect(await db.accounts.count()).toBe(0);
  });

  it("garde les opérations partagées et met à jour le lot qui les reprend", async () => {
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
  });

  it("bloque l’annulation seulement si une opération réellement supprimée a été corrigée", async () => {
    const original = await ingest();
    const overlap = await importText(source(), {
      name: "overlap",
      selected: new Set(),
      ...accept,
    });
    const [shared] = await db.transactions.toArray();
    await updateTransactions([shared.id], { category: "Corrigée" });
    expect(await undoBlockers(original.id)).toEqual([]);
    await undoImport(original.id);
    expect((await db.transactions.get(shared.id))?.category).toBe("Corrigée");
    expect(await undoBlockers(overlap.id)).toEqual([
      await db.transactions.get(shared.id),
    ]);
    await expect(undoImport(overlap.id)).rejects.toThrow(/corrections/);
    expect(await db.transactions.count()).toBe(2);
    expect(await db.batches.count()).toBe(1);
  });

  it("préserve l’identité bancaire au lieu de créer un compte renommé", async () => {
    await ingest();
    const preview = await previewText(source(), { "": "Renamed" }, "renamed");
    expect(preview.errors.join()).toMatch(/reconnu par son numéro/);
    await expect(
      commitImport(preview, { checkpointDecisions: { Courant: "accept" } }),
    ).rejects.toThrow();
    expect(await db.accounts.count()).toBe(1);
  });

  it("« conserver » garde l’observation précédente et archive la source contradictoire", async () => {
    await ingest();
    await importText(source("900.00"), {
      name: "other",
      selected: new Set(),
      checkpointDecisions: { Courant: "keep" },
    });
    const a = (await db.accounts.get("Courant"))!;
    expect(a.checkpoint?.amount).toBe(100000);
    expect(a.checkpoints?.at(-1)).toMatchObject({
      amount: 90000,
      accepted: false,
    });
    expect(balanceAt(a, await db.transactions.toArray(), "2026-10-02")).toBe(
      100000,
    );
    expect(await db.transactions.count()).toBe(2);
  });

  it("restaure l’ancre précédente à l’annulation sans effacer une correction manuelle", async () => {
    await db.accounts.add({
      id: "Courant",
      checkpoint: { date: "2026-09-30", amount: 103000 },
    });
    const batch = await ingest();
    await undoImport(batch.id);
    expect((await db.accounts.get("Courant"))?.checkpoint).toEqual({
      date: "2026-09-30",
      amount: 103000,
    });
    expect((await db.accounts.get("Courant"))?.coverage).toEqual([]);
    const batch2 = await ingest("two");
    await db.accounts.update("Courant", {
      checkpoint: { date: "2026-10-03", amount: 98000 },
    });
    await undoImport(batch2.id);
    expect((await db.accounts.get("Courant"))?.checkpoint).toEqual({
      date: "2026-10-03",
      amount: 98000,
    });
  });

  it("aperçu périmé : un solde modifié bloque, une recatégorisation non", async () => {
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
  });

  it("marque incomplète une couverture importée partiellement", async () => {
    await importText(source(), {
      name: "partial",
      selected: new Set([4]),
      ...accept,
    });
    const a = (await db.accounts.get("Courant"))!;
    expect(a.coverage?.[0].complete).toBe(false);
    expect(coverageStatus(a, "2026-10-01")).toBe("incomplete");
  });

  it("ne promeut jamais un solde reconstruit et garde la priorité de l’observation", async () => {
    const csv =
      "account,date,amount,libelle,daily_balance\nCourant,2026-10-02,-10,A,100";
    await expect(
      importText(csv, { name: "d", choice: {}, ...accept }),
    ).rejects.toThrow(/dérivé/);
    await importText(csv, {
      name: "d",
      choice: {},
      checkpointDecisions: { Courant: "derived" },
    });
    const a = (await db.accounts.get("Courant"))!;
    expect(a.checkpoint?.status).toBe("derived");
    expect(coverageStatus(a, "2026-10-02")).toBe("derived");
  });

  it("répartit un fichier multicomptes vers les comptes choisis", async () => {
    const csv =
      "date;account;amount;libelle\n2026-10-02;Perso;-1;A\n2026-10-02;Joint;-2;B";
    const preview = await previewText(csv, {
      Perso: "Courant",
      Joint: "Commun",
    });
    expect(preview.newAccounts).toEqual(["Courant", "Commun"]);
    await commitImport(preview);
    expect((await db.accounts.toArray()).map((a) => a.id).sort()).toEqual([
      "Commun",
      "Courant",
    ]);
    expect(
      (await db.transactions.toArray()).map((t) => t.account).sort(),
    ).toEqual(["Commun", "Courant"]);
  });
});
