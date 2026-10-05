import Dexie, { type Table } from "dexie";
import type {
  Account,
  Batch,
  Budget,
  Due,
  Preferences,
  Snapshot,
  Transaction,
  ImportMetadata,
  BalanceCheckpoint,
} from "./types";
import { defaultPreferences, widgetNames } from "./types";
import { sizesFor } from "./intelligence";
import type { Candidate } from "./importer";
import { fingerprint, importIdentity, metadataAccountId } from "./importer";
import { parseDate } from "./domain";
import { validateBoardState } from "./layout";
import { isGoalIconKey } from "./goal-icon-keys";
import { dockPageIds } from "./navigation";
import { visualizationIds } from "./visualizationRegistry";
import { isCardPaletteId } from "./cardPalettes";
export interface ImportOptions {
  metadata?: ImportMetadata;
  fallbackAccount?: string;
  /** Explicit per-account review; derived balances require their own choice. */
  checkpointDecisions?: Record<string, "accept" | "keep" | "derived">;
  reviewedState?: string;
}
export function importReviewToken(
  transactions: Transaction[],
  accounts: Account[],
): string {
  return JSON.stringify([
    transactions.slice().sort((a, b) => a.id.localeCompare(b.id)),
    accounts.slice().sort((a, b) => a.id.localeCompare(b.id)),
  ]);
}
function transactionState(t: Omit<Transaction, "id" | "batchId">): string {
  return JSON.stringify([
    t.date,
    t.account,
    t.amount,
    t.label,
    t.merchant,
    t.category,
    t.internal,
    t.merchantName,
    t.subcategory,
    t.note,
    t.reviewed,
    ...(t.categoryId !== undefined || t.subcategoryId !== undefined
      ? [t.categoryId, t.subcategoryId]
      : []),
  ]);
}
export class WealthDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  accounts!: Table<Account, string>;
  batches!: Table<Batch, string>;
  budgets!: Table<Budget, string>;
  dues!: Table<Due, string>;
  preferences!: Table<Preferences, string>;
  constructor(name = "WealthPilotNext_v1") {
    super(name);
    this.version(1).stores({
      transactions: "id,batchId,date,account,category,fingerprint",
      accounts: "id",
      batches: "id,&hash,createdAt",
      budgets: "id,month",
      dues: "id,date,account",
      preferences: "id",
    });
  }
  async snapshot(): Promise<Snapshot> {
    return this.transaction("r", this.tables, async () => {
      const [transactions, accounts, batches, budgets, dues, preferences] =
        await Promise.all([
          this.transactions.toArray(),
          this.accounts.toArray(),
          this.batches.toArray(),
          this.budgets.toArray(),
          this.dues.toArray(),
          this.preferences.get("main"),
        ]);
      return {
        transactions,
        accounts,
        batches,
        budgets,
        dues,
        preferences: preferences ?? structuredClone(defaultPreferences),
      };
    });
  }
  async importBatch(
    name: string,
    hash: string,
    candidates: Candidate[],
    selected: Set<number>,
    reviewedCount?: number,
    options: ImportOptions = {},
  ) {
    return this.transaction(
      "rw",
      this.transactions,
      this.accounts,
      this.batches,
      async () => {
        if (await this.batches.where("hash").equals(hash).count())
          throw new Error("Ce fichier a déjà été importé.");
        if (
          reviewedCount !== undefined &&
          (await this.transactions.count()) !== reviewedCount
        )
          throw new Error(
            "La base a changé depuis votre vérification. Vérifiez les opérations à nouveau.",
          );
        const priorAccounts = await this.accounts.toArray();
        if (
          options.reviewedState !== undefined &&
          options.reviewedState !==
            importReviewToken(await this.transactions.toArray(), priorAccounts)
        )
          throw new Error(
            "Les données ou soldes ont changé depuis votre vérification. Vérifiez à nouveau.",
          );
        const rows = candidates.filter(
          (c) => c.transaction && selected.has(c.row),
        );
        const hasMetadata = !!options.metadata?.accounts.length;
        if (!rows.length && !hasMetadata)
          throw new Error("Aucune opération sélectionnée.");
        if (
          options.metadata &&
          (options.metadata.accounts.some((a) => a.currency !== "EUR") ||
            (options.metadata.reportedCount !== undefined &&
              options.metadata.reportedCount !== candidates.length))
        )
          throw new Error("Métadonnées d’import invalides.");
        const id = crypto.randomUUID();
        const dates = (
          rows.length ? rows : candidates.filter((c) => c.transaction)
        )
          .map((c) => c.transaction!.date)
          .sort();
        const checkpointDates =
          options.metadata?.accounts
            .flatMap((a) => a.checkpoints.map((c) => c.date))
            .sort() ?? [];
        const batch: Batch = {
          id,
          name,
          hash,
          createdAt: new Date().toISOString(),
          count: rows.length,
          minDate: dates[0] ?? checkpointDates[0],
          maxDate: dates.at(-1) ?? checkpointDates.at(-1)!,
          ...(options.metadata ? { metadata: options.metadata } : {}),
        };
        if (!batch.minDate || !batch.maxDate)
          throw new Error("Aucune date bancaire valide.");
        for (const account of new Set(rows.map((c) => c.transaction!.account)))
          if (!(await this.accounts.get(account)))
            await this.accounts.add({ id: account });
        for (const entry of options.metadata?.accounts ?? []) {
          if (entry.bankAccountId && !/^\d{5,34}$/.test(entry.bankAccountId))
            throw new Error("Identifiant bancaire invalide.");
          if (
            entry.checkpoints.some(
              (c) => c.status !== "observed" && c.status !== "derived",
            )
          )
            throw new Error("Origine du solde importé invalide.");
          const accountId = metadataAccountId(
            entry,
            options.fallbackAccount ?? "",
            priorAccounts,
          );
          if (!accountId)
            throw new Error("Choisissez le compte lié à ces métadonnées.");
          if (
            options.metadata?.profile === "sg" &&
            rows.some((c) => c.transaction!.account !== accountId)
          )
            throw new Error(
              "Ce relevé appartient à un autre compte bancaire déjà identifié. Vérifiez le compte sélectionné.",
            );
          let account = (await this.accounts.get(accountId)) ?? {
            id: accountId,
          };
          if (
            entry.bankAccountId &&
            account.bankAccountId &&
            entry.bankAccountId !== account.bankAccountId
          )
            throw new Error(
              "Cet identifiant bancaire ne correspond pas au compte choisi.",
            );
          const decision = options.checkpointDecisions?.[accountId];
          if (entry.checkpoints.length && !decision)
            throw new Error(
              "Vérifiez explicitement les soldes importés : accepter, conserver ou utiliser la reconstruction.",
            );
          if (
            entry.checkpoints.some((c) => c.status === "derived") &&
            decision === "accept"
          )
            throw new Error(
              "Un solde dérivé n’est pas une observation bancaire. Choisissez explicitement la reconstruction.",
            );
          const previous = [...(account.checkpoints ?? [])];
          if (
            account.checkpoint &&
            !previous.some(
              (c) => JSON.stringify(c) === JSON.stringify(account.checkpoint),
            )
          )
            previous.push(account.checkpoint);
          const imported: BalanceCheckpoint[] = entry.checkpoints.map((c) => ({
            ...c,
            sourceHash: hash,
            batchId: id,
            accepted: decision !== "keep",
          }));
          if (
            imported.some(
              (c) =>
                parseDate(c.date) !== c.date ||
                !Number.isSafeInteger(c.amount) ||
                Math.abs(c.amount) > 1e12,
            )
          )
            throw new Error("Solde importé invalide.");
          const checkpoints = [...previous, ...imported];
          // Accepting a conflicting observation supersedes that date only, while
          // retaining the rejected source for audit and reversible batch removal.
          const eligible = checkpoints.filter(
            (c) => c.accepted !== false && c.status !== "derived",
          );
          const derived = checkpoints.filter(
            (c) => c.accepted !== false && c.status === "derived",
          );
          const latest = (eligible.length ? eligible : derived)
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .at(-1);
          account = {
            ...account,
            bankAccountId: entry.bankAccountId ?? account.bankAccountId,
            checkpoints,
            ...(latest ? { checkpoint: latest } : {}),
          };
          if (entry.coverageFrom && entry.coverageThrough) {
            if (
              parseDate(entry.coverageFrom) !== entry.coverageFrom ||
              parseDate(entry.coverageThrough) !== entry.coverageThrough ||
              entry.coverageFrom > entry.coverageThrough
            )
              throw new Error("Couverture bancaire invalide.");
            const latestObservation = entry.checkpoints
              .filter((c) => c.status === "observed")
              .map((c) => c.date)
              .sort()
              .at(-1);
            const verifiedThrough =
              latestObservation && latestObservation < entry.coverageThrough
                ? latestObservation
                : entry.coverageThrough;
            if (verifiedThrough >= entry.coverageFrom)
              account.coverage = [
                ...(account.coverage ?? []),
                {
                  from: entry.coverageFrom,
                  through: verifiedThrough,
                  sourceHash: hash,
                  batchId: id,
                  complete: candidates.every(
                    (c) =>
                      c.transaction && (c.duplicate || selected.has(c.row)),
                  ),
                },
              ];
          }
          await this.accounts.put(account);
        }
        const incoming = rows.map((c) => ({
          ...c.transaction!,
          importedState: transactionState(c.transaction!),
          id: crypto.randomUUID(),
          batchId: id,
        }));
        const existingByIdentity = new Map<string, Transaction[]>();
        for (const t of await this.transactions.toArray()) {
          const key = importIdentity(t);
          const bucket = existingByIdentity.get(key) ?? [];
          bucket.push(t);
          existingByIdentity.set(key, bucket);
        }
        const sharedIds: string[] = [];
        for (const c of candidates) {
          if (!c.transaction || !c.duplicate) continue;
          const previous = existingByIdentity
            .get(importIdentity(c.transaction))
            ?.pop();
          if (previous && !selected.has(c.row)) sharedIds.push(previous.id);
        }
        batch.transactionIds = [...incoming.map((t) => t.id), ...sharedIds];
        await this.transactions.bulkAdd(incoming);
        await this.batches.add(batch);
        return batch;
      },
    );
  }
  async undoBatch(id: string) {
    return this.transaction(
      "rw",
      this.transactions,
      this.batches,
      this.dues,
      this.accounts,
      async () => {
        const tx = await this.transactions
          .where("batchId")
          .equals(id)
          .toArray();
        const remainingBatches = (await this.batches.toArray()).filter(
          (b) => b.id !== id,
        );
        const sharedOwner = new Map<string, string>();
        for (const batch of remainingBatches)
          for (const tid of batch.transactionIds ?? [])
            sharedOwner.set(tid, batch.id);
        const ids = new Set(
          tx.filter((t) => !sharedOwner.has(t.id)).map((t) => t.id),
        );
        if (
          tx.some(
            (t) =>
              t.importedState !== undefined &&
              t.importedState !== transactionState(t),
          )
        )
          throw new Error(
            "Ce lot contient des corrections. Son annulation est bloquée pour ne pas les effacer ; exportez et examinez ces opérations avant suppression.",
          );
        await this.dues
          .filter((d) => !!d.transactionId && ids.has(d.transactionId))
          .modify((d) => {
            delete d.transactionId;
          });
        for (const t of tx) {
          const owner = sharedOwner.get(t.id);
          if (owner) await this.transactions.update(t.id, { batchId: owner });
          else await this.transactions.delete(t.id);
        }
        for (const account of await this.accounts.toArray()) {
          if (
            !account.checkpoints?.some((c) => c.batchId === id) &&
            !account.coverage?.some((c) => c.batchId === id)
          )
            continue;
          const checkpoints =
            account.checkpoints?.filter((c) => c.batchId !== id) ?? [];
          const eligible = checkpoints.filter(
            (c) => c.accepted !== false && c.status !== "derived",
          );
          const derived = checkpoints.filter(
            (c) => c.accepted !== false && c.status === "derived",
          );
          const checkpoint =
            account.checkpoint?.batchId !== id
              ? account.checkpoint
              : (eligible.length ? eligible : derived)
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .at(-1);
          await this.accounts.put({
            ...account,
            checkpoint,
            checkpoints,
            coverage: account.coverage?.filter((c) => c.batchId !== id),
          });
        }
        await this.batches.delete(id);
      },
    );
  }
}
export const db = new WealthDatabase();
export function validateBackup(value: unknown): Snapshot {
  const fail = () => {
    throw new Error("Sauvegarde invalide ou incompatible.");
  };
  if (!value || typeof value !== "object") return fail();
  const v = value as { format?: string; version?: number; data?: Snapshot };
  if (v.format !== "wealthpilot-next" || v.version !== 1 || !v.data)
    return fail();
  const s = v.data;
  for (const k of [
    "accounts",
    "transactions",
    "batches",
    "budgets",
    "dues",
  ] as const)
    if (!Array.isArray(s[k]) || s[k].length > 100000) return fail();
  const text = (x: unknown) => typeof x === "string" && x.length < 20000;
  const money = (x: unknown) =>
    typeof x === "number" && Number.isSafeInteger(x) && Math.abs(x) <= 1e12;
  const ids = (items: { id: string }[]) =>
    items.every((x) => x && text(x.id) && x.id.length > 0) &&
    new Set(items.map((x) => x.id)).size === items.length;
  if (![s.accounts, s.transactions, s.batches, s.budgets, s.dues].every(ids))
    return fail();
  if (
    !s.accounts.every(
      (a) =>
        !a.checkpoint ||
        (parseDate(a.checkpoint.date) === a.checkpoint.date &&
          money(a.checkpoint.amount)),
    )
  )
    return fail();
  if (
    !s.batches.every(
      (b) =>
        text(b.hash) &&
        text(b.name) &&
        text(b.createdAt) &&
        Number.isFinite(Date.parse(b.createdAt)) &&
        parseDate(b.minDate) === b.minDate &&
        parseDate(b.maxDate) === b.maxDate &&
        b.minDate <= b.maxDate &&
        Number.isInteger(b.count) &&
        b.count >= 0,
    )
  )
    return fail();
  if (new Set(s.batches.map((b) => b.hash)).size !== s.batches.length)
    return fail();
  const accountIds = new Set(s.accounts.map((a) => a.id));
  const batchIds = new Set(s.batches.map((b) => b.id));
  const checkpointValid = (c: BalanceCheckpoint) =>
    !!c &&
    parseDate(c.date) === c.date &&
    money(c.amount) &&
    (c.status === undefined || ["observed", "derived"].includes(c.status)) &&
    (c.sourceHash === undefined || text(c.sourceHash)) &&
    (c.batchId === undefined || batchIds.has(c.batchId)) &&
    (c.accepted === undefined || typeof c.accepted === "boolean");
  if (
    !s.accounts.every(
      (a) =>
        (a.bankAccountId === undefined ||
          (text(a.bankAccountId) && /^\d{5,34}$/.test(a.bankAccountId))) &&
        (!a.checkpoint || checkpointValid(a.checkpoint)) &&
        (a.checkpoints === undefined ||
          (Array.isArray(a.checkpoints) &&
            a.checkpoints.length <= 100000 &&
            a.checkpoints.every(checkpointValid))) &&
        (a.coverage === undefined ||
          (Array.isArray(a.coverage) &&
            a.coverage.length <= 10000 &&
            a.coverage.every(
              (c) =>
                !!c &&
                parseDate(c.from) === c.from &&
                parseDate(c.through) === c.through &&
                c.from <= c.through &&
                text(c.sourceHash) &&
                batchIds.has(c.batchId) &&
                typeof c.complete === "boolean",
            ))),
    )
  )
    return fail();
  const bankIds = s.accounts.flatMap((a) =>
    a.bankAccountId ? [a.bankAccountId] : [],
  );
  if (new Set(bankIds).size !== bankIds.length) return fail();
  if (
    !s.batches.every(
      (b) =>
        b.metadata === undefined ||
        (b.metadata &&
          ["sg", "generic"].includes(b.metadata.profile) &&
          Array.isArray(b.metadata.warnings) &&
          b.metadata.warnings.every(text) &&
          (b.metadata.reportedCount === undefined ||
            (Number.isInteger(b.metadata.reportedCount) &&
              b.metadata.reportedCount >= 0 &&
              b.metadata.reportedCount <= 50000)) &&
          Array.isArray(b.metadata.accounts) &&
          b.metadata.accounts.length <= 1000 &&
          b.metadata.accounts.every(
            (a) =>
              !!a &&
              a.currency === "EUR" &&
              (a.account === undefined || text(a.account)) &&
              (a.bankAccountId === undefined || text(a.bankAccountId)) &&
              Array.isArray(a.checkpoints) &&
              a.checkpoints.every(checkpointValid) &&
              (a.coverageFrom === undefined ||
                parseDate(a.coverageFrom) === a.coverageFrom) &&
              (a.coverageThrough === undefined ||
                parseDate(a.coverageThrough) === a.coverageThrough),
          )),
    )
  )
    return fail();
  const transactionsById = new Map(s.transactions.map((t) => [t.id, t]));
  if (
    !s.batches.every(
      (b) =>
        b.transactionIds === undefined ||
        (Array.isArray(b.transactionIds) &&
          b.transactionIds.length <= 100000 &&
          new Set(b.transactionIds).size === b.transactionIds.length &&
          b.transactionIds.every((id) => transactionsById.has(id))),
    )
  )
    return fail();
  if (
    !s.transactions.every(
      (t) =>
        parseDate(t.date) === t.date &&
        money(t.amount) &&
        text(t.label) &&
        text(t.merchant) &&
        text(t.category) &&
        [t.merchantName, t.subcategory, t.note].every(
          (v) => v === undefined || text(v),
        ) &&
        (t.reviewed === undefined || typeof t.reviewed === "boolean") &&
        (t.importedState === undefined || text(t.importedState)) &&
        typeof t.internal === "boolean" &&
        text(t.fingerprint) &&
        t.fingerprint === fingerprint(t) &&
        accountIds.has(t.account) &&
        batchIds.has(t.batchId) &&
        t.raw &&
        typeof t.raw === "object" &&
        !Array.isArray(t.raw) &&
        Object.values(t.raw).every(text),
    )
  )
    return fail();
  if (
    !s.budgets.every(
      (b) =>
        /^\d{4}-\d{2}$/.test(b.month) &&
        parseDate(b.month + "-01") === b.month + "-01" &&
        text(b.category) &&
        money(b.amount) &&
        b.amount >= 0,
    )
  )
    return fail();
  if (
    new Set(
      s.budgets.map((b) =>
        JSON.stringify([b.month, b.category, b.account ?? ""]),
      ),
    ).size !== s.budgets.length
  )
    return fail();
  if (
    !s.budgets.every(
      (b) => b.account === undefined || accountIds.has(b.account),
    )
  )
    return fail();
  const reconciledIds = s.dues.flatMap((d) =>
    d.transactionId ? [d.transactionId] : [],
  );
  if (new Set(reconciledIds).size !== reconciledIds.length) return fail();
  if (
    !s.dues.every(
      (d) =>
        text(d.label) &&
        money(d.amount) &&
        parseDate(d.date) === d.date &&
        accountIds.has(d.account) &&
        (d.category === undefined || text(d.category)) &&
        (d.internal === undefined || typeof d.internal === "boolean") &&
        (d.originOccurrenceId === undefined || text(d.originOccurrenceId)) &&
        (d.recurrenceConfirmed === undefined ||
          typeof d.recurrenceConfirmed === "boolean") &&
        (d.estimated === undefined || typeof d.estimated === "boolean") &&
        (d.confidence === undefined ||
          (Number.isFinite(d.confidence) &&
            d.confidence >= 0 &&
            d.confidence <= 100)) &&
        (d.recurrenceKey === undefined || text(d.recurrenceKey)) &&
        (!d.transactionId ||
          (transactionsById.get(d.transactionId)?.account === d.account &&
            Math.sign(transactionsById.get(d.transactionId)!.amount) ===
              Math.sign(d.amount))),
    )
  )
    return fail();
  const p = s.preferences;
  if (
    !p ||
    p.id !== "main" ||
    (p.cycleStartDay !== undefined &&
      (!Number.isInteger(p.cycleStartDay) ||
        p.cycleStartDay < 1 ||
        p.cycleStartDay > 31)) ||
    ![p.safety, p.essentials].every((x) => money(x) && x >= 0) ||
    !(p.weekly === null || (money(p.weekly) && p.weekly >= 0)) ||
    !["list", "rings"].includes(p.budgetView) ||
    !Array.isArray(p.widgets) ||
    p.widgets.some((w) => !Object.hasOwn(widgetNames, w)) ||
    new Set(p.widgets).size !== p.widgets.length
  )
    return fail();
  if (p.board !== undefined && !validateBoardState(p.board)) return fail();
  if (
    p.board?.views.some((v) =>
      v.instances.some(
        (i) =>
          i.source.kind === "account" && !accountIds.has(i.source.account!),
      ),
    )
  )
    return fail();
  if (
    p.categoryDefinitions !== undefined &&
    !Array.isArray(p.categoryDefinitions)
  )
    return fail();
  const definitions = p.categoryDefinitions ?? [];
  if (
    !Array.isArray(definitions) ||
    definitions.length > 1000 ||
    !ids(definitions) ||
    definitions.some(
      (d) =>
        !text(d.name) ||
        !d.name.trim() ||
        d.name.length > 100 ||
        (d.parentId !== undefined && !text(d.parentId)) ||
        (d.icon !== undefined && !isGoalIconKey(d.icon)) ||
        (d.color !== undefined &&
          (typeof d.color !== "string" || !/^#[0-9a-f]{6}$/i.test(d.color))) ||
        (d.archived !== undefined && typeof d.archived !== "boolean"),
    )
  )
    return fail();
  const definitionById = new Map(definitions.map((d) => [d.id, d]));
  if (
    definitions.some(
      (d) =>
        d.parentId !== undefined &&
        (d.parentId === d.id ||
          !definitionById.has(d.parentId) ||
          definitionById.get(d.parentId)!.parentId !== undefined),
    )
  )
    return fail();
  if (
    new Set(
      definitions.map((d) =>
        JSON.stringify([
          d.parentId ?? "",
          d.name.trim().toLocaleLowerCase("fr"),
        ]),
      ),
    ).size !== definitions.length
  )
    return fail();
  const rootCategory = (id: unknown) =>
    typeof id === "string" &&
    definitionById.has(id) &&
    definitionById.get(id)!.parentId === undefined;
  if (
    s.transactions.some(
      (t) =>
        (t.categoryId !== undefined && !rootCategory(t.categoryId)) ||
        (t.subcategoryId !== undefined &&
          (typeof t.subcategoryId !== "string" ||
            t.categoryId === undefined ||
            !definitionById.has(t.subcategoryId) ||
            definitionById.get(t.subcategoryId)!.parentId !== t.categoryId)),
    )
  )
    return fail();
  if (
    s.budgets.some(
      (b) => b.categoryId !== undefined && !rootCategory(b.categoryId),
    )
  )
    return fail();
  if (
    p.categoryRules !== undefined &&
    (!Array.isArray(p.categoryRules) ||
      p.categoryRules.length > 200 ||
      !ids(p.categoryRules) ||
      p.categoryRules.some(
        (r) =>
          !text(r.name) ||
          !r.name.trim() ||
          r.name.length > 120 ||
          !text(r.pattern) ||
          r.pattern.trim().length < 2 ||
          r.pattern.length > 200 ||
          (r.account !== undefined && !accountIds.has(r.account)) ||
          !["all", "expense", "income"].includes(r.direction) ||
          !text(r.category) ||
          !r.category.trim() ||
          r.category.length > 100 ||
          (r.subcategory !== undefined &&
            (!text(r.subcategory) || r.subcategory.length > 100)) ||
          typeof r.enabled !== "boolean" ||
          !Number.isInteger(r.priority) ||
          r.priority < 0 ||
          r.priority > 199,
      ))
  )
    return fail();
  if (
    p.ignoredOccurrences !== undefined &&
    (!Array.isArray(p.ignoredOccurrences) ||
      p.ignoredOccurrences.length > 10000 ||
      !p.ignoredOccurrences.every(text) ||
      new Set(p.ignoredOccurrences).size !== p.ignoredOccurrences.length)
  )
    return fail();
  if (
    p.recurrenceRules !== undefined &&
    (!Array.isArray(p.recurrenceRules) ||
      p.recurrenceRules.length > 200 ||
      !ids(p.recurrenceRules) ||
      p.recurrenceRules.some(
        (r) =>
          !text(r.name) ||
          !r.name.trim() ||
          r.name.length > 120 ||
          !accountIds.has(r.account) ||
          !money(r.amount) ||
          !r.amount ||
          !text(r.category) ||
          !["monthly", "weekly"].includes(r.frequency) ||
          parseDate(r.next) !== r.next ||
          (r.sourceKey !== undefined && !text(r.sourceKey)) ||
          (r.paused !== undefined && typeof r.paused !== "boolean") ||
          (r.end !== undefined &&
            (parseDate(r.end) !== r.end || r.end < r.next)),
      ))
  )
    return fail();
  if (
    p.scenarios !== undefined &&
    (!Array.isArray(p.scenarios) ||
      p.scenarios.length > 30 ||
      !ids(p.scenarios) ||
      p.scenarios.some(
        (v) =>
          !text(v.name) ||
          !v.name.trim() ||
          v.name.length > 80 ||
          (v.account !== "" && !accountIds.has(v.account)) ||
          !Number.isInteger(v.incomeDelay) ||
          v.incomeDelay < 0 ||
          v.incomeDelay > 31 ||
          !Number.isFinite(v.expenseIncrease) ||
          v.expenseIncrease < 0 ||
          v.expenseIncrease > 100,
      ))
  )
    return fail();
  if (p.householdPlan !== undefined) {
    const members = p.householdPlan?.members;
    if (
      !Array.isArray(members) ||
      !members.length ||
      members.length > 12 ||
      members.some(
        (m) =>
          !m ||
          !text(m.name) ||
          !m.name.trim() ||
          m.name.length > 80 ||
          !accountIds.has(m.account) ||
          !Number.isFinite(m.share) ||
          m.share < 0 ||
          m.share > 100,
      ) ||
      new Set(members.map((m) => m.name.trim().toLocaleLowerCase())).size !==
        members.length ||
      Math.abs(members.reduce((n, m) => n + m.share, 0) - 100) > 0.000001
    )
      return fail();
  }
  if (
    p.weeklyPlans !== undefined &&
    (!Array.isArray(p.weeklyPlans) ||
      p.weeklyPlans.length > 200 ||
      p.weeklyPlans.some(
        (w) =>
          !w ||
          parseDate(w.start) !== w.start ||
          new Date(w.start + "T12:00:00Z").getUTCDay() !== 1 ||
          (w.account !== "" && !accountIds.has(w.account)) ||
          !Number.isFinite(w.reduction) ||
          w.reduction < 0 ||
          w.reduction > 100 ||
          !money(w.reserve) ||
          w.reserve < 0 ||
          !w.limits ||
          typeof w.limits !== "object" ||
          Array.isArray(w.limits) ||
          Object.keys(w.limits).length > 100 ||
          !Object.entries(w.limits).every(
            ([k, v]) => text(k) && k.length > 0 && money(v) && v >= 0,
          ),
      ) ||
      new Set(p.weeklyPlans.map((w) => JSON.stringify([w.start, w.account])))
        .size !== p.weeklyPlans.length)
  )
    return fail();
  const validGoal = (g: unknown) => {
    if (!g || typeof g !== "object") return false;
    const goal = g as Preferences["goal"];
    return (
      !!goal &&
      (goal.account === undefined || accountIds.has(goal.account)) &&
      (goal.priority === undefined ||
        (Number.isInteger(goal.priority) &&
          goal.priority >= 0 &&
          goal.priority <= 100)) &&
      text(goal.name) &&
      money(goal.target) &&
      goal.target > 0 &&
      money(goal.saved) &&
      goal.saved >= 0 &&
      (goal.icon === undefined || isGoalIconKey(goal.icon)) &&
      (goal.color === undefined || /^#[0-9a-fA-F]{6}$/.test(goal.color)) &&
      (goal.deadline === undefined ||
        parseDate(goal.deadline) === goal.deadline) &&
      [goal.description, goal.legacyId].every(
        (v) => v === undefined || text(v),
      ) &&
      (goal.monthly === undefined || (money(goal.monthly) && goal.monthly >= 0))
    );
  };
  if (
    (p.goal !== null && !validGoal(p.goal)) ||
    (p.extraGoals !== undefined &&
      (!Array.isArray(p.extraGoals) ||
        p.extraGoals.length > 100 ||
        !p.extraGoals.every(validGoal)))
  )
    return fail();
  if (
    p.sizes !== undefined &&
    (typeof p.sizes !== "object" ||
      p.sizes === null ||
      Array.isArray(p.sizes) ||
      Object.entries(p.sizes).some(
        ([key, size]) =>
          !Object.hasOwn(widgetNames, key) ||
          !sizesFor(key as keyof typeof widgetNames).includes(size),
      ))
  )
    return fail();
  if (
    p.dismissedRecurrences !== undefined &&
    (!Array.isArray(p.dismissedRecurrences) ||
      !p.dismissedRecurrences.every(text))
  )
    return fail();
  if (
    p.tones !== undefined &&
    (!p.tones ||
      typeof p.tones !== "object" ||
      Array.isArray(p.tones) ||
      Object.entries(p.tones).some(
        ([key, tone]) =>
          !Object.hasOwn(widgetNames, key) || !isCardPaletteId(tone),
      ))
  )
    return fail();
  if (
    p.budgetOrder !== undefined &&
    (!Array.isArray(p.budgetOrder) ||
      p.budgetOrder.length > 1000 ||
      !p.budgetOrder.every(text) ||
      new Set(p.budgetOrder).size !== p.budgetOrder.length)
  )
    return fail();
  if (p.budgetLimit !== undefined && ![0, 3, 4, 6].includes(p.budgetLimit))
    return fail();
  if (
    p.widgetViews !== undefined &&
    (!p.widgetViews ||
      typeof p.widgetViews !== "object" ||
      Array.isArray(p.widgetViews) ||
      Object.entries(p.widgetViews).some(
        ([key, value]) =>
          !Object.hasOwn(widgetNames, key) || !visualizationIds.includes(value),
      ))
  )
    return fail();
  if (
    p.dockPages !== undefined &&
    (!Array.isArray(p.dockPages) ||
      p.dockPages.length > 5 ||
      new Set(p.dockPages).size !== p.dockPages.length ||
      !p.dockPages.every((id) => dockPageIds.includes(id)))
  )
    return fail();
  return s;
}
export async function restoreBackup(s: Snapshot, database = db) {
  await database.transaction("rw", database.tables, async () => {
    for (const table of database.tables) await table.clear();
    await database.accounts.bulkAdd(s.accounts);
    await database.batches.bulkAdd(s.batches);
    await database.transactions.bulkAdd(s.transactions);
    await database.budgets.bulkAdd(s.budgets);
    await database.dues.bulkAdd(s.dues);
    await database.preferences.put(s.preferences);
  });
}
