import type {
  Account,
  Batch,
  ImportAccountMetadata,
  Transaction,
} from "../../domain/types";
import { checkpointHistory, legacyAnchor } from "../checkpoints";
import { db } from "../db";
import { metadataAccountId } from "./mapping";
import {
  importIdentity,
  previewToken,
  transactionState,
  type Preview,
} from "./preview";

export class ImportError extends Error {
  name = "ImportError";
}

/** The database changed since the preview: rebuild it, nothing was written. */
export class StaleError extends Error {
  name = "StaleError";
}

export type CheckpointDecision = "accept" | "keep" | "derived";

export interface CommitOptions {
  /** Row indexes to import; defaults to every new row. */
  selected?: ReadonlySet<number>;
  /** Keyed by destination account; required for every account receiving balances. */
  checkpointDecisions?: Record<string, CheckpointDecision>;
}

function withImportedBalances(
  account: Account,
  entry: ImportAccountMetadata,
  decision: CheckpointDecision | undefined,
  batch: Pick<Batch, "id" | "hash">,
  complete: boolean,
): Account {
  if (
    entry.bankAccountId &&
    account.bankAccountId &&
    entry.bankAccountId !== account.bankAccountId
  )
    throw new ImportError(
      "Cet identifiant bancaire ne correspond pas au compte choisi.",
    );
  if (entry.checkpoints.length && !decision)
    throw new ImportError(
      "Vérifiez explicitement les soldes importés : accepter, conserver ou utiliser la reconstruction.",
    );
  if (
    decision === "accept" &&
    entry.checkpoints.some((c) => c.status === "derived")
  )
    throw new ImportError(
      "Un solde dérivé n’est pas une observation bancaire. Choisissez explicitement la reconstruction.",
    );
  // A rejected source is kept (accepted: false) for audit and reversible undo.
  const checkpoints = [
    ...checkpointHistory(account),
    ...entry.checkpoints.map((c) => ({
      ...c,
      sourceHash: batch.hash,
      batchId: batch.id,
      accepted: decision !== "keep",
    })),
  ];
  const anchor = legacyAnchor(checkpoints);
  const next: Account = {
    ...account,
    bankAccountId: entry.bankAccountId ?? account.bankAccountId,
    checkpoints,
    ...(anchor ? { checkpoint: anchor } : {}),
  };
  if (!entry.coverageFrom || !entry.coverageThrough) return next;
  // Coverage is only verified up to the observed balance, not the export date.
  const observedThrough = entry.checkpoints
    .filter((c) => c.status === "observed")
    .map((c) => c.date)
    .sort()
    .at(-1);
  const through =
    observedThrough && observedThrough < entry.coverageThrough
      ? observedThrough
      : entry.coverageThrough;
  if (through < entry.coverageFrom) return next;
  return {
    ...next,
    coverage: [
      ...(account.coverage ?? []),
      {
        from: entry.coverageFrom,
        through,
        sourceHash: batch.hash,
        batchId: batch.id,
        complete,
      },
    ],
  };
}

/** Writes accounts, balances, transactions and the batch atomically. */
export function commitImport(
  preview: Preview,
  options: CommitOptions = {},
): Promise<Batch> {
  const selected =
    options.selected ??
    new Set(preview.rows.filter((r) => r.status === "new").map((r) => r.index));
  const { metadata, file } = preview;
  return db.transaction(
    "rw",
    db.transactions,
    db.accounts,
    db.batches,
    async () => {
      if (await db.batches.where("hash").equals(file.hash).count())
        throw new ImportError("Ce fichier a déjà été importé.");
      const existing = await db.transactions.toArray();
      const priorAccounts = await db.accounts.toArray();
      if (previewToken(existing, priorAccounts) !== preview.token)
        throw new StaleError(
          "Les données ont changé depuis l’aperçu : il a été recalculé.",
        );
      if (preview.errors.length) throw new ImportError(preview.errors[0]);
      const rows = preview.rows.filter((r) => r.tx && selected.has(r.index));
      if (!rows.length && !metadata.accounts.length)
        throw new ImportError("Aucune opération sélectionnée.");
      const dates = (rows.length ? rows : preview.rows.filter((r) => r.tx))
        .map((r) => r.tx!.date)
        .sort();
      const checkpointDates = metadata.accounts
        .flatMap((a) => a.checkpoints.map((c) => c.date))
        .sort();
      const batch: Batch = {
        id: crypto.randomUUID(),
        name: file.name,
        hash: file.hash,
        createdAt: new Date().toISOString(),
        count: rows.length,
        minDate: dates[0] ?? checkpointDates[0],
        maxDate: dates.at(-1) ?? checkpointDates.at(-1)!,
        metadata,
      };
      if (!batch.minDate) throw new ImportError("Aucune date bancaire valide.");
      for (const account of new Set(rows.map((r) => r.tx!.account)))
        if (!(await db.accounts.get(account)))
          await db.accounts.add({ id: account });
      const complete = preview.rows.every(
        (r) => r.tx && (r.status === "duplicate" || selected.has(r.index)),
      );
      for (const entry of metadata.accounts) {
        const accountId = metadataAccountId(entry, "", priorAccounts);
        if (
          metadata.profile === "sg" &&
          rows.some((r) => r.tx!.account !== accountId)
        )
          throw new ImportError(
            "Ce relevé appartient à un autre compte bancaire déjà identifié. Vérifiez le compte sélectionné.",
          );
        const account = (await db.accounts.get(accountId)) ?? { id: accountId };
        const decision = options.checkpointDecisions?.[accountId];
        await db.accounts.put(
          withImportedBalances(account, entry, decision, batch, complete),
        );
      }
      const incoming: Transaction[] = rows.map((r) => ({
        ...r.tx!,
        importedState: transactionState(r.tx!),
        id: crypto.randomUUID(),
        batchId: batch.id,
      }));
      // Unselected duplicates are shared: undoing their original batch keeps them.
      const byIdentity = new Map<string, Transaction[]>();
      for (const t of existing) {
        const key = importIdentity(t);
        byIdentity.set(key, [...(byIdentity.get(key) ?? []), t]);
      }
      const sharedIds: string[] = [];
      for (const r of preview.rows) {
        if (r.status !== "duplicate") continue;
        const previous = byIdentity.get(importIdentity(r.tx!))?.pop();
        if (previous && !selected.has(r.index)) sharedIds.push(previous.id);
      }
      batch.transactionIds = [...incoming.map((t) => t.id), ...sharedIds];
      await db.transactions.bulkAdd(incoming);
      await db.batches.add(batch);
      return batch;
    },
  );
}

const edited = (t: Transaction) =>
  t.importedState !== undefined && t.importedState !== transactionState(t);

async function undoPlan(batchId: string) {
  const rows = await db.transactions.where("batchId").equals(batchId).toArray();
  const owners = new Map<string, Batch>();
  for (const batch of await db.batches.toArray())
    if (batch.id !== batchId)
      for (const id of batch.transactionIds ?? []) owners.set(id, batch);
  const deleted = rows.filter((t) => !owners.has(t.id));
  return { owners, deleted, reassigned: rows.filter((t) => owners.has(t.id)) };
}

/** Hand-edited rows that undoing this batch would delete. */
export function undoBlockers(batchId: string): Promise<Transaction[]> {
  return db.transaction("r", db.transactions, db.batches, async () =>
    (await undoPlan(batchId)).deleted.filter(edited),
  );
}

export function undoImport(batchId: string): Promise<void> {
  return db.transaction(
    "rw",
    [db.transactions, db.batches, db.dues, db.accounts, db.budgets],
    async () => {
      const { owners, deleted, reassigned } = await undoPlan(batchId);
      const touched = new Set(deleted.map((t) => t.account));
      const blockers = deleted.filter(edited);
      if (blockers.length)
        throw new ImportError(
          `Ce lot contient ${blockers.length} opération(s) avec des corrections manuelles : son annulation les effacerait.`,
        );
      const ids = new Set(deleted.map((t) => t.id));
      await db.dues
        .filter((d) => !!d.transactionId && ids.has(d.transactionId))
        .modify((d) => {
          delete d.transactionId;
        });
      await db.transactions.bulkDelete([...ids]);
      const gained = new Map<Batch, Transaction[]>();
      for (const t of reassigned)
        gained.set(owners.get(t.id)!, [
          ...(gained.get(owners.get(t.id)!) ?? []),
          t,
        ]);
      for (const [owner, moved] of gained) {
        await db.transactions.bulkUpdate(
          moved.map((t) => ({ key: t.id, changes: { batchId: owner.id } })),
        );
        const dates = moved.map((t) => t.date).sort();
        await db.batches.put({
          ...owner,
          count: owner.count + moved.length,
          minDate: dates[0] < owner.minDate ? dates[0] : owner.minDate,
          maxDate:
            dates.at(-1)! > owner.maxDate ? dates.at(-1)! : owner.maxDate,
        });
      }
      for (const account of await db.accounts.toArray()) {
        if (account.checkpoints?.some((c) => c.batchId === batchId))
          touched.add(account.id);
        if (
          !account.checkpoints?.some((c) => c.batchId === batchId) &&
          !account.coverage?.some((c) => c.batchId === batchId)
        )
          continue;
        const checkpoints =
          account.checkpoints?.filter((c) => c.batchId !== batchId) ?? [];
        await db.accounts.put({
          ...account,
          checkpoint:
            account.checkpoint?.batchId === batchId
              ? legacyAnchor(checkpoints)
              : account.checkpoint,
          checkpoints,
          coverage: account.coverage?.filter((c) => c.batchId !== batchId),
        });
      }
      await db.batches.delete(batchId);
      // An account the batch brought in disappears with it once nothing refers to it.
      for (const id of touched) {
        const account = await db.accounts.get(id);
        const used =
          !account ||
          account.checkpoint ||
          account.checkpoints?.length ||
          account.coverage?.length ||
          (await db.transactions.where("account").equals(id).count()) ||
          (await db.dues.where("account").equals(id).count()) ||
          (await db.budgets.filter((b) => b.account === id).count());
        if (!used) await db.accounts.delete(id);
      }
    },
  );
}
