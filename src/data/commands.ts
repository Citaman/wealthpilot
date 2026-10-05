import { isIsoDate, weekday } from "../domain/dates";
import type {
  Budget,
  Cents,
  DashboardLayout,
  Due,
  IsoDate,
  Preferences,
  RecurrenceRule,
  Transaction,
  WeeklyPlan,
} from "../domain/types";
import { checkpointHistory } from "./checkpoints";
import { db, readPreferences } from "./db";

export type Undo = () => Promise<void>;

/** A concurrent write (other tab, double click) already changed this data. */
export class ConflictError extends Error {
  name = "ConflictError";
}

function assertCents(value: Cents, allowNegative = false) {
  if (
    !Number.isSafeInteger(value) ||
    Math.abs(value) > 1e12 ||
    (!allowNegative && value < 0)
  )
    throw new RangeError("Montant invalide.");
}

const unique = <T>(values: T[]) => [...new Set(values)];

/** Read-modify-put of the preferences row; only the returned keys change. `undefined` removes a key. */
export function patchPreferences(
  fn: (current: Preferences) => Partial<Preferences>,
): Promise<Undo> {
  return db.transaction("rw", db.preferences, async () => {
    const current = await readPreferences();
    const patch = fn(current);
    const previous = Object.fromEntries(
      Object.keys(patch).map((key) => [key, current[key]]),
    );
    const next: Preferences = { ...current, ...patch };
    for (const [key, value] of Object.entries(patch))
      if (value === undefined) delete next[key];
    await db.preferences.put(next);
    return async () => {
      await patchPreferences(() => previous);
    };
  });
}

export const editableFields = [
  "merchantName",
  "category",
  "subcategory",
  "categoryId",
  "subcategoryId",
  "note",
  "internal",
] as const;
export type TransactionPatch = Partial<
  Pick<Transaction, (typeof editableFields)[number]>
>;

/** Account, date, amount and label are part of the fingerprint and never change. */
export function updateTransactions(
  ids: string[],
  patch: TransactionPatch,
): Promise<Undo> {
  const keys = editableFields.filter((key) => key in patch);
  const pick = (t: TransactionPatch): TransactionPatch =>
    Object.fromEntries(keys.map((key) => [key, t[key]]));
  const changes = pick(patch);
  return db.transaction("rw", db.transactions, async () => {
    const rows = await db.transactions.bulkGet(ids);
    if (rows.some((t) => !t))
      throw new ConflictError(
        "Une opération n’existe plus. Rechargez la liste.",
      );
    const previous = rows.map((t) => ({
      key: t!.id,
      changes: pick(t!),
    }));
    await db.transactions.bulkUpdate(ids.map((key) => ({ key, changes })));
    return async () => {
      await db.transactions.bulkUpdate(previous);
    };
  });
}

/** Creates, updates or (with `null`) deletes the envelope of a (month, category, account) tuple. */
export async function setBudget(
  scope: { month: string; category: string; account?: string },
  amount: Cents | null,
): Promise<Undo> {
  if (amount !== null) assertCents(amount);
  const account = scope.account || undefined;
  return db.transaction("rw", db.budgets, async () => {
    const previous = await db.budgets
      .where("month")
      .equals(scope.month)
      .filter((b) => b.category === scope.category && b.account === account)
      .first();
    const next: Budget | undefined =
      amount === null
        ? undefined
        : {
            ...(previous ?? {
              id: crypto.randomUUID(),
              month: scope.month,
              category: scope.category,
            }),
            ...(account ? { account } : {}),
            amount,
          };
    if (next) await db.budgets.put(next);
    else if (previous) await db.budgets.delete(previous.id);
    return async () => {
      if (previous) await db.budgets.put(previous);
      else if (next) await db.budgets.delete(next.id);
    };
  });
}

export const reorderEnvelopes = (order: string[]) =>
  patchPreferences(() => ({ budgetOrder: unique(order) }));

async function writeDue(due: Due): Promise<Undo> {
  const { label, amount, date, account, transactionId, originOccurrenceId } =
    due;
  if (!label.trim() || label.length > 120 || !isIsoDate(date) || !amount)
    throw new RangeError("Échéance invalide.");
  assertCents(amount, true);
  if (due.id.startsWith("estimate:"))
    throw new RangeError("Une occurrence estimée n’est pas enregistrable.");
  if (!(await db.accounts.get(account)))
    throw new ConflictError("Compte inconnu.");
  const previous = await db.dues.get(due.id);
  const others = (await db.dues.toArray()).filter((d) => d.id !== due.id);
  if (transactionId) {
    const t = await db.transactions.get(transactionId);
    if (
      !t ||
      t.account !== account ||
      Math.sign(t.amount) !== Math.sign(amount) ||
      others.some((d) => d.transactionId === transactionId)
    )
      throw new ConflictError(
        "Opération de rapprochement incompatible ou déjà utilisée.",
      );
  }
  let restorePreferences: (() => Promise<unknown>) | undefined;
  if (
    originOccurrenceId &&
    previous?.originOccurrenceId !== originOccurrenceId
  ) {
    const { ignoredOccurrences = [] } = await readPreferences();
    if (others.some((d) => d.originOccurrenceId === originOccurrenceId))
      throw new ConflictError(
        "Cette occurrence a déjà été ajustée ailleurs. Rouvrez le calendrier.",
      );
    if (ignoredOccurrences.includes(originOccurrenceId))
      throw new ConflictError(
        "Cette occurrence a été ignorée. Réactivez-la avant de l’ajuster.",
      );
    // Legacy contract: an adjusted occurrence is also listed as ignored.
    await patchPreferences(() => ({
      ignoredOccurrences: [...ignoredOccurrences, originOccurrenceId],
    }));
    restorePreferences = () => unignore(originOccurrenceId);
  }
  await db.dues.put(due);
  return () =>
    db.transaction("rw", db.dues, db.preferences, async () => {
      if (previous) await db.dues.put(previous);
      else await db.dues.delete(due.id);
      await restorePreferences?.();
    });
}

/** Uniqueness of `originOccurrenceId` and `transactionId` is checked inside the write transaction. */
export const saveDue = (due: Due) =>
  db.transaction(
    "rw",
    db.dues,
    db.accounts,
    db.transactions,
    db.preferences,
    () => writeDue(due),
  );

export function deleteDue(id: string): Promise<Undo> {
  return db.transaction("rw", db.dues, async () => {
    const previous = await db.dues.get(id);
    await db.dues.delete(id);
    return async () => {
      if (previous) await db.dues.put(previous);
    };
  });
}

/** Persists an estimated occurrence with new values, or updates an already persisted due. */
export function adjustOccurrence(
  occurrence: Due,
  change: { amount?: Cents; date?: IsoDate },
): Promise<Undo> {
  if (!occurrence.estimated) return saveDue({ ...occurrence, ...change });
  const { estimated, confidence, recurrenceConfirmed, ...rest } = occurrence;
  return saveDue({
    ...rest,
    ...change,
    id: crypto.randomUUID(),
    originOccurrenceId: occurrence.id,
  });
}

const unignore = (id: string) =>
  patchPreferences((p) => ({
    ignoredOccurrences: (p.ignoredOccurrences ?? []).filter((v) => v !== id),
  }));

export async function ignoreOccurrence(id: string): Promise<Undo> {
  let added = false;
  await patchPreferences((p) => {
    added = !p.ignoredOccurrences?.includes(id);
    return {
      ignoredOccurrences: unique([...(p.ignoredOccurrences ?? []), id]),
    };
  });
  return async () => {
    if (added) await unignore(id);
  };
}

export function restoreOccurrence(id: string): Promise<Undo> {
  return db.transaction("rw", db.dues, db.preferences, async () => {
    if (await db.dues.filter((d) => d.originOccurrenceId === id).count())
      throw new ConflictError(
        "Cette occurrence a été ajustée : supprimez l’échéance ajustée pour revenir à l’estimation.",
      );
    await unignore(id);
    return () => ignoreOccurrence(id).then(() => {});
  });
}

export const confirmRecurrence = (rule: RecurrenceRule) =>
  patchPreferences((p) => ({
    recurrenceRules: [
      ...(p.recurrenceRules ?? []).filter(
        (r) =>
          r.id !== rule.id &&
          (!rule.sourceKey || r.sourceKey !== rule.sourceKey),
      ),
      rule,
    ],
    dismissedRecurrences: (p.dismissedRecurrences ?? []).filter(
      (k) => k !== rule.sourceKey,
    ),
  }));

export const dismissRecurrence = (key: string) =>
  patchPreferences((p) => ({
    dismissedRecurrences: unique([...(p.dismissedRecurrences ?? []), key]),
  }));

/**
 * Manual observed balance. A previous manual value on the same date is replaced;
 * the legacy `checkpoint` holds it so it wins date ties against imported balances.
 */
export async function setCheckpoint(
  accountId: string,
  observed: { date: IsoDate; amount: Cents },
): Promise<Undo> {
  assertCents(observed.amount, true);
  if (!isIsoDate(observed.date)) throw new RangeError("Date invalide.");
  return db.transaction("rw", db.accounts, async () => {
    const previous = await db.accounts.get(accountId);
    if (!previous) throw new ConflictError("Compte inconnu.");
    const manual = (c: { batchId?: string; sourceHash?: string }) =>
      !c.batchId && !c.sourceHash;
    await db.accounts.put({
      ...previous,
      checkpoints: checkpointHistory(previous).filter(
        (c) => !(manual(c) && c.date === observed.date),
      ),
      checkpoint: { ...observed, status: "observed", accepted: true },
    });
    return async () => {
      await db.accounts.put(previous);
    };
  });
}

/** Display alias; the id stays untouched because fingerprints include it. Empty alias removes it. */
export const renameAccount = (accountId: string, alias: string) =>
  patchPreferences((p) => {
    const { [accountId]: _, ...aliases } = p.accountAliases ?? {};
    return {
      accountAliases: alias.trim()
        ? { ...aliases, [accountId]: alias.trim() }
        : aliases,
    };
  });

/** Undo restores only this category of this plan, not edits made meanwhile. */
export async function saveWeekLimit(
  account: string,
  weekStart: IsoDate,
  category: string,
  amount: Cents | null,
): Promise<Undo> {
  if (weekday(weekStart) !== 0)
    throw new RangeError("Une semaine commence un lundi.");
  if (amount !== null) assertCents(amount);
  let previous: Cents | null = null;
  await patchPreferences((p) => {
    const plans = p.weeklyPlans ?? [];
    const same = (w: WeeklyPlan) =>
      w.start === weekStart && w.account === account;
    const plan = plans.find(same) ?? {
      start: weekStart,
      account,
      limits: {},
      reduction: 0,
      reserve: 0,
    };
    const { [category]: old, ...limits } = plan.limits;
    previous = old ?? null;
    if (amount !== null) limits[category] = amount;
    // A plan without limits and adjustments would read as a confirmed plan.
    const empty =
      !Object.keys(limits).length && !plan.reduction && !plan.reserve;
    const others = plans.filter((w) => !same(w));
    return {
      weeklyPlans: empty ? others : [...others, { ...plan, limits }],
    };
  });
  return async () => {
    await saveWeekLimit(account, weekStart, category, previous);
  };
}

export async function setSafety(amount: Cents): Promise<Undo> {
  assertCents(amount);
  return patchPreferences(() => ({ safety: amount }));
}

export const saveDashboard = (layout: DashboardLayout) =>
  patchPreferences(() => ({ dashboard: layout }));
