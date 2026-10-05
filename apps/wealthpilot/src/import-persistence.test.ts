import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WealthDatabase, importReviewToken, validateBackup } from "./store";
import { parseCSV, detectMapping, previewImport } from "./importer";
import { balanceAt, selectDashboard } from "./domain";
import { balanceCoverage } from "./coverage";
import { migrateBoard } from "./layout";
import type { Account } from "./types";
let db: WealthDatabase;
const source = (amount = "1000.00") =>
  `00012345678;01/09/2026;04/10/2026;2;02/10/2026;${amount} EUR\n\nDate de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise\n02/10/2026;CARTE;CARTE A;-10,00;EUR\n01/10/2026;CARTE;CARTE B;-20,00;EUR`;
function input(text = source()) {
  const file = parseCSV(text);
  const candidates = previewImport(
    file,
    detectMapping(file.fields),
    "Courant",
    [],
  );
  return { file, candidates };
}
async function ingest(hash = "one", text = source()) {
  const { file, candidates } = input(text);
  return db.importBatch(
    hash,
    hash,
    candidates,
    new Set(candidates.map((c) => c.row)),
    undefined,
    {
      metadata: file.metadata,
      fallbackAccount: "Courant",
      checkpointDecisions: { Courant: "accept" },
    },
  );
}
beforeEach(() => {
  db = new WealthDatabase("metadata-test-" + crypto.randomUUID());
});
afterEach(async () => {
  await db.delete();
});
describe("Atomic observations, provenance and reversible imports", () => {
  it("rejects restored board sources pointing to missing accounts", async () => {
    await ingest();
    const s = await db.snapshot();
    s.preferences.board = migrateBoard(s.preferences);
    s.preferences.board.views[0].instances[0].source = {
      kind: "account",
      account: "Missing",
    };
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).toThrow();
    s.preferences.board.views[0].instances[0].source.account = "Courant";
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).not.toThrow();
  });
  it("validates stable category ancestry and protects recategorized imported facts", async () => {
    const batch = await ingest();
    const s = await db.snapshot();
    s.preferences.categoryDefinitions = [
      { id: "food", name: "Alimentation", icon: "none", color: "#abcd12" },
      { id: "groceries", name: "Courses", parentId: "food" },
      { id: "home", name: "Logement" },
    ];
    s.transactions[0].categoryId = "food";
    s.transactions[0].subcategoryId = "groceries";
    const validate = () =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s });
    expect(validate).not.toThrow();
    s.transactions[0].categoryId = "home";
    expect(validate).toThrow();
    s.transactions[0].categoryId = "food";
    s.preferences.categoryDefinitions[0].parentId = "groceries";
    expect(validate).toThrow();
    delete s.preferences.categoryDefinitions[0].parentId;
    s.preferences.categoryDefinitions.push({
      id: "duplicate",
      name: " alimentation ",
    });
    expect(validate).toThrow();
    s.preferences.categoryDefinitions.pop();
    await db.transactions.put(s.transactions[0]);
    await expect(db.undoBatch(batch.id)).rejects.toThrow();
    expect(await db.transactions.count()).toBe(2);
  });
  it("uses each accepted observation on its date regardless of chart window", async () => {
    await ingest();
    const s = await db.snapshot();
    s.accounts[0].checkpoints!.push({
      date: "2026-09-01",
      amount: 90000,
      status: "observed",
    });
    const long = selectDashboard(
      s,
      "2026-10",
      "Courant",
      "2026-10-04",
      "2026-08",
    );
    const short = selectDashboard(
      s,
      "2026-10",
      "Courant",
      "2026-10-04",
      "2026-10",
    );
    for (const p of short.points.filter((p) => p.date <= "2026-10-04")) {
      expect(p.value).toBe(long.points.find((q) => q.date === p.date)?.value);
      expect(p.value).toBe(balanceAt(s.accounts[0], s.transactions, p.date));
    }
    expect(long.points.find((p) => p.date === "2026-10-02")?.value).toBe(
      100000,
    );
  });
  it("keeps shared facts when the original import is removed", async () => {
    const original = await ingest();
    const { file } = input();
    const rows = previewImport(
      file,
      detectMapping(file.fields),
      "Courant",
      await db.transactions.toArray(),
    );
    const overlap = await db.importBatch(
      "overlap",
      "overlap",
      rows,
      new Set(),
      undefined,
      {
        metadata: file.metadata,
        fallbackAccount: "Courant",
        checkpointDecisions: { Courant: "accept" },
      },
    );
    await db.undoBatch(original.id);
    expect(await db.transactions.count()).toBe(2);
    expect(
      (await db.transactions.toArray()).every((t) => t.batchId === overlap.id),
    ).toBe(true);
    expect((await db.accounts.get("Courant"))?.checkpoint?.sourceHash).toBe(
      "overlap",
    );
    expect(() =>
      validateBackup({
        format: "wealthpilot-next",
        version: 1,
        data: undefined,
      }),
    ).toThrow();
    const snapshot = await db.snapshot();
    expect(() =>
      validateBackup({
        format: "wealthpilot-next",
        version: 1,
        data: snapshot,
      }),
    ).not.toThrow();
    await db.undoBatch(overlap.id);
    expect(await db.transactions.count()).toBe(0);
  });
  it("persists observed anchor, source bank identity and complete coverage", async () => {
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
    expect(balanceAt(a, transactions, "2026-09-30")).toBe(103000);
    expect(balanceAt(a, transactions, "2026-10-01")).toBe(101000);
    expect(balanceAt(a, transactions, "2026-10-02")).toBe(100000);
    expect(balanceCoverage(a, "2026-10-03")).toBe("incomplete");
    expect(batch.metadata?.accounts[0].coverageThrough).toBe("2026-10-04");
    const snapshot = await db.snapshot();
    expect(
      validateBackup({
        format: "wealthpilot-next",
        version: 1,
        data: snapshot,
      }),
    ).toEqual(snapshot);
  });
  it("requires explicit observation review, with no partially created account", async () => {
    const { file, candidates } = input();
    await expect(
      db.importBatch("test", "h", candidates, new Set([4, 5]), undefined, {
        metadata: file.metadata,
        fallbackAccount: "Courant",
      }),
    ).rejects.toThrow(/explicitement/);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
  });
  it("preserves bank identity instead of silently creating a renamed account", async () => {
    await ingest();
    const { file } = input();
    const candidates = previewImport(
      file,
      detectMapping(file.fields),
      "Renamed",
      [],
    );
    await expect(
      db.importBatch(
        "renamed",
        "newhash",
        candidates,
        new Set([4, 5]),
        undefined,
        {
          metadata: file.metadata,
          fallbackAccount: "Renamed",
          checkpointDecisions: { Courant: "accept" },
        },
      ),
    ).rejects.toThrow(/autre compte/);
    expect(await db.accounts.count()).toBe(1);
  });
  it("keep decision preserves previous observation and archives conflicting source", async () => {
    await ingest();
    const { file } = input(source("900.00"));
    const candidates = previewImport(
      file,
      detectMapping(file.fields),
      "Courant",
      await db.transactions.toArray(),
    );
    await db.importBatch("other", "other", candidates, new Set(), undefined, {
      metadata: file.metadata,
      fallbackAccount: "Courant",
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
  it("restores prior anchor on undo without deleting unrelated manual corrections", async () => {
    await db.accounts.add({
      id: "Courant",
      checkpoint: { date: "2026-09-30", amount: 103000 },
    });
    const batch = await ingest();
    await db.undoBatch(batch.id);
    expect((await db.accounts.get("Courant"))?.checkpoint).toEqual({
      date: "2026-09-30",
      amount: 103000,
    });
    expect((await db.accounts.get("Courant"))?.coverage).toEqual([]);
    const batch2 = await ingest("two");
    await db.accounts.update("Courant", {
      checkpoint: { date: "2026-10-03", amount: 98000 },
    });
    await db.undoBatch(batch2.id);
    expect((await db.accounts.get("Courant"))?.checkpoint).toEqual({
      date: "2026-10-03",
      amount: 98000,
    });
  });
  it("does not erase corrected transactions during batch undo", async () => {
    const batch = await ingest();
    const tx = (await db.transactions.toArray())[0];
    await db.transactions.update(tx.id, { category: "Corrected" });
    await expect(db.undoBatch(batch.id)).rejects.toThrow(/corrections/);
    expect(await db.transactions.count()).toBe(2);
    expect(await db.batches.count()).toBe(1);
  });
  it("rejects stale review even when row count has not changed", async () => {
    await ingest();
    const snapshot = await db.snapshot();
    const token = importReviewToken(snapshot.transactions, snapshot.accounts);
    await db.accounts.update("Courant", {
      checkpoint: { date: "2026-10-02", amount: 99999 },
    });
    const { file, candidates } = input();
    await expect(
      db.importBatch("other", "other", candidates, new Set(), 2, {
        metadata: file.metadata,
        fallbackAccount: "Courant",
        checkpointDecisions: { Courant: "accept" },
        reviewedState: token,
      }),
    ).rejects.toThrow(/changé/);
  });
  it("marks selectively imported coverage incomplete", async () => {
    const { file, candidates } = input();
    await db.importBatch(
      "partial",
      "partial",
      candidates,
      new Set([4]),
      undefined,
      {
        metadata: file.metadata,
        fallbackAccount: "Courant",
        checkpointDecisions: { Courant: "accept" },
      },
    );
    const a = (await db.accounts.get("Courant"))!;
    expect(a.coverage?.[0].complete).toBe(false);
    expect(balanceCoverage(a, "2026-10-01")).toBe("incomplete");
  });
  it("never silently upgrades derived balances and keeps observed anchor priority", async () => {
    const { file, candidates } = input(
      "account,date,amount,libelle,daily_balance\nCourant,2026-10-02,-10,A,100",
    );
    await expect(
      db.importBatch("derived", "d", candidates, new Set([2]), undefined, {
        metadata: file.metadata,
        checkpointDecisions: { Courant: "accept" },
      }),
    ).rejects.toThrow(/dérivé/);
    await db.importBatch("derived", "d", candidates, new Set([2]), undefined, {
      metadata: file.metadata,
      checkpointDecisions: { Courant: "derived" },
    });
    const a = (await db.accounts.get("Courant"))!;
    expect(a.checkpoint?.status).toBe("derived");
    expect(balanceCoverage(a, "2026-10-02")).toBe("derived");
  });
  it("validates new backup scopes, provenance references and weekly plans", async () => {
    await ingest();
    const s = await db.snapshot();
    s.preferences.weeklyPlans = [
      {
        start: "2026-10-05",
        account: "",
        limits: { Food: 10000 },
        reduction: 10,
        reserve: 20000,
      },
    ];
    s.budgets = [
      { id: "one", month: "2026-10", category: "Food", amount: 10000 },
      {
        id: "two",
        month: "2026-10",
        category: "Food",
        amount: 10000,
        account: "Courant",
      },
    ];
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).not.toThrow();
    s.accounts[0].coverage![0].batchId = "missing";
    expect(() =>
      validateBackup({ format: "wealthpilot-next", version: 1, data: s }),
    ).toThrow();
  });
  it("coverage holes stay explicit; historical value is independent of a chart window", () => {
    const a: Account = {
      id: "A",
      checkpoint: { date: "2026-10-02", amount: 1000 },
      coverage: [
        {
          from: "2026-09-01",
          through: "2026-09-10",
          complete: true,
          batchId: "b",
          sourceHash: "h",
        },
        {
          from: "2026-09-20",
          through: "2026-10-02",
          complete: true,
          batchId: "b2",
          sourceHash: "h2",
        },
      ],
    };
    expect(balanceCoverage(a, "2026-09-05")).toBe("incomplete");
    expect(balanceCoverage(a, "2026-09-25")).toBe("covered");
    expect(balanceCoverage(a, "2026-10-02")).toBe("observed");
    expect(balanceAt(a, [], "2026-09-25")).toBe(1000);
  });
});
