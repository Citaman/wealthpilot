import { Select } from "./Select";
import { useState, useRef, useEffect } from "react";
import type { Snapshot, Transaction, WidgetId, Preferences } from "./types";
import { defaultPreferences, widgetNames } from "./types";
import { db, restoreBackup, validateBackup } from "./store";
import { euro, parseMoney, today, dateLabel } from "./domain";
import { exportCSV } from "./importer";
import { download } from "./download";
import { Modal, InlinePanel, Field, Notice, MerchantIcon } from "./ui";
import { budgetCalendar, budgetCycle, within } from "./periods";
export type Editor =
  | "accounts"
  | "plan"
  | "budgets"
  | "goal"
  | "dues"
  | "transactions"
  | "layout"
  | "data"
  | null;
const numberValue = (v: number) => String(v / 100);
export function EditorDialog({
  kind,
  snapshot,
  month,
  category,
  account = "",
  onClose,
  notify,
  inline = false,
}: {
  kind: Exclude<Editor, null>;
  snapshot: Snapshot;
  month: string;
  category: string;
  account?: string;
  onClose: () => void;
  notify: (m: string) => void;
  inline?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [categoryFilter, setCategoryFilter] = useState(category),
    [widgets, setWidgets] = useState([...snapshot.preferences.widgets]),
    [dueAccount, setDueAccount] = useState(
      account || snapshot.accounts[0]?.id || "",
    ),
    [safetyBackupExported, setSafetyBackupExported] = useState(false),
    [safetyBackupConfirmed, setSafetyBackupConfirmed] = useState(false),
    [backupFileName, setBackupFileName] = useState(""),
    [pendingBackup, setPendingBackup] = useState<Snapshot | null>(null);
  const titles: Record<Exclude<Editor, null>, string> = {
    accounts: "Soldes des comptes",
    plan: "Votre disponible",
    budgets: "Vos enveloppes",
    goal: "Votre objectif",
    dues: "Échéances",
    transactions: "Vos opérations",
    layout: "Personnaliser la vue",
    data: "Données et sauvegarde",
  };
  const p = snapshot.preferences;
  // An open budget draft belongs to its opening scope, never to a later global filter.
  const budgetScope = useRef({ month, account });
  const budgetRevision = useRef(
    snapshot.budgets.filter(
      (b) => b.month === month && (b.account ?? "") === account,
    ),
  );
  const budgetContextChanged =
    month !== budgetScope.current.month ||
    account !== budgetScope.current.account;
  const backupGeneration = useRef(0);
  const backupInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      backupGeneration.current++;
    },
    [],
  );
  async function patchPreferences(
    patch:
      | Partial<Preferences>
      | ((current: Preferences) => Partial<Preferences>),
  ) {
    return db.transaction("rw", db.preferences, async () => {
      const current = (await db.preferences.get("main")) ?? p;
      await db.preferences.put({
        ...current,
        ...(typeof patch === "function" ? patch(current) : patch),
      });
    });
  }
  async function save(action: () => Promise<unknown>, close = true) {
    setBusy(true);
    setError("");
    try {
      await action();
      notify("Enregistré.");
      if (close) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const cents = (value: FormDataEntryValue | null, allowNegative = false) => {
    const n = parseMoney(String(value ?? ""));
    if (n === null || (!allowNegative && n < 0))
      throw new Error(
        "Saisissez un montant valide, avec deux décimales maximum.",
      );
    return n;
  };
  const submit =
    (action: (data: FormData) => Promise<unknown>, close = true) =>
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      void save(() => action(data), close);
    };
  const footer = (
    <div className="actions">
      <button className="button" type="button" onClick={onClose}>
        Annuler
      </button>
      <button className="button yellow" disabled={busy}>
        Enregistrer
      </button>
    </div>
  );
  let content;
  if (kind === "accounts")
    content = (
      <>
        <p>
          Indiquez le solde affiché par votre banque en fin de journée. Les
          opérations importées servent ensuite à reconstruire les autres dates.
        </p>
        <Notice>
          Un solde calculé n’atteste pas que toutes les opérations ont été
          importées. Vérifiez la couverture de vos relevés.
        </Notice>
        {!snapshot.accounts.length ? (
          <p>Importez d’abord un CSV pour créer vos comptes.</p>
        ) : (
          <form
            onSubmit={submit(async (f) => {
              await db.transaction("rw", db.accounts, async () => {
                for (const [i, a] of snapshot.accounts.entries()) {
                  const raw = String(f.get("amount" + i) ?? "");
                  if (raw === "") continue;
                  const date = String(f.get("date" + i));
                  if (!date || date > today())
                    throw new Error(
                      "La date du solde doit être passée ou aujourd’hui.",
                    );
                  const current = await db.accounts.get(a.id);
                  if (JSON.stringify(current) !== JSON.stringify(a))
                    throw new Error(
                      "Ce compte a changé. Fermez puis rouvrez les soldes pour comparer.",
                    );
                  await db.accounts.put({
                    ...a,
                    checkpoints: [
                      ...(a.checkpoints ?? []),
                      ...(a.checkpoint ? [a.checkpoint] : []),
                    ],
                    checkpoint: {
                      date,
                      amount: cents(f.get("amount" + i), true),
                      status: "observed",
                      accepted: true,
                    },
                  });
                }
              });
            })}
          >
            {snapshot.accounts.map((a, i) => (
              <fieldset key={a.id}>
                <legend>{a.id}</legend>
                <div className="form-grid">
                  <Field label="Solde observé (€)">
                    <input
                      name={"amount" + i}
                      inputMode="decimal"
                      placeholder="À confirmer"
                      defaultValue={
                        a.checkpoint ? numberValue(a.checkpoint.amount) : ""
                      }
                    />
                  </Field>
                  <Field label="En fin de journée le">
                    <input
                      name={"date" + i}
                      type="date"
                      required
                      max={today()}
                      defaultValue={a.checkpoint?.date ?? today()}
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
            {footer}
          </form>
        )}
      </>
    );
  if (kind === "plan")
    content = (
      <form
        onSubmit={submit(async (f) => {
          await patchPreferences({
            safety: cents(f.get("safety")),
            essentials: cents(f.get("essentials")),
            weekly:
              String(f.get("weekly")) === "" ? null : cents(f.get("weekly")),
          });
        })}
      >
        <p>
          Ces réserves s’appliquent au foyer. Les échéances non payées et
          l’épargne affectée à l’objectif sont déduites séparément.
        </p>
        <Field label="Réserve de sécurité (€)">
          <input
            name="safety"
            inputMode="decimal"
            required
            defaultValue={numberValue(p.safety)}
          />
        </Field>
        <Field label="Essentiels restant à financer ce cycle (€)">
          <input
            name="essentials"
            inputMode="decimal"
            required
            defaultValue={numberValue(p.essentials)}
          />
        </Field>
        <Field label="Allocation pour la semaine (€)">
          <input
            name="weekly"
            inputMode="decimal"
            placeholder="Non définie"
            defaultValue={p.weekly === null ? "" : numberValue(p.weekly)}
          />
        </Field>
        <Notice>
          Ne comptez pas une même charge dans les essentiels et dans les
          échéances. Le disponible reste une estimation basée sur les montants
          saisis.
        </Notice>
        {footer}
      </form>
    );
  if (kind === "budgets")
    content = (
      <>
        {budgetContextChanged && (
          <Notice>
            Le filtre global a changé. Ce brouillon concerne toujours{" "}
            {budgetScope.current.account || "le foyer"}, pour{" "}
            {budgetScope.current.month}. Enregistrer conserve ce périmètre ;
            fermez puis rouvrez l’éditeur pour utiliser le nouveau filtre.
          </Notice>
        )}
        <p>
          Enveloppes {budgetScope.current.account || "du foyer"} pour{" "}
          {budgetScope.current.month}. Choisissez une catégorie existante ou
          saisissez-en une nouvelle.
        </p>
        <form
          onSubmit={submit(async (f) => {
            const category = String(f.get("category")).trim();
            if (!category) throw new Error("Choisissez une catégorie.");
            const scope = budgetScope.current;
            const amount = cents(f.get("amount"));
            await db.transaction("rw", db.budgets, async () => {
              const expected = budgetRevision.current.find(
                (b) => b.category === category,
              );
              const matches = (await db.budgets.toArray()).filter(
                (b) =>
                  b.month === scope.month &&
                  b.category === category &&
                  (b.account ?? "") === scope.account,
              );
              if (
                matches.length > 1 ||
                JSON.stringify(matches[0] ?? null) !==
                  JSON.stringify(expected ?? null)
              )
                throw new Error(
                  "Cette enveloppe a changé dans un autre onglet. Fermez puis rouvrez l’éditeur pour comparer les nouvelles valeurs ; votre brouillon n’a rien remplacé.",
                );
              const next = {
                ...expected,
                id: expected?.id ?? crypto.randomUUID(),
                month: scope.month,
                category,
                amount,
                ...(scope.account ? { account: scope.account } : {}),
              };
              await db.budgets.put(next);
              budgetRevision.current = [
                ...budgetRevision.current.filter(
                  (b) => b.category !== category,
                ),
                next,
              ];
            });
          }, false)}
        >
          <div className="form-grid">
            <Field label="Catégorie">
              <input name="category" list="budget-categories" required />
              <datalist id="budget-categories">
                {[...new Set(snapshot.transactions.map((t) => t.category))]
                  .sort()
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </datalist>
            </Field>
            <Field label="Budget mensuel (€)">
              <input name="amount" inputMode="decimal" required />
            </Field>
          </div>
          <button className="button yellow" disabled={busy}>
            Ajouter / remplacer l’enveloppe
          </button>
        </form>
        <div className="editor-list">
          {snapshot.budgets
            .filter(
              (b) =>
                b.month === budgetScope.current.month &&
                (b.account ?? "") === budgetScope.current.account,
            )
            .map((b) => (
              <div key={b.id}>
                <strong>{b.category}</strong>
                <span>{euro(b.amount)}</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void save(
                      () =>
                        db.transaction("rw", db.budgets, async () => {
                          const expected = budgetRevision.current.find(
                            (item) => item.id === b.id,
                          );
                          const latest = await db.budgets.get(b.id);
                          if (
                            !expected ||
                            JSON.stringify(latest ?? null) !==
                              JSON.stringify(expected)
                          )
                            throw new Error(
                              "Cette enveloppe a changé dans un autre onglet. Fermez puis rouvrez l’éditeur avant de la retirer.",
                            );
                          await db.budgets.delete(b.id);
                          budgetRevision.current =
                            budgetRevision.current.filter(
                              (item) => item.id !== b.id,
                            );
                        }),
                      false,
                    )
                  }
                >
                  Retirer l’enveloppe
                </button>
              </div>
            ))}
        </div>
      </>
    );
  if (kind === "goal")
    content = (
      <form
        onSubmit={submit(async (f) => {
          const target = cents(f.get("target"));
          if (target <= 0)
            throw new Error("La cible doit être supérieure à zéro.");
          await patchPreferences((current) => ({
            goal: {
              ...current.goal,
              name: String(f.get("name")).trim(),
              target,
              saved: cents(f.get("saved")),
            },
          }));
        })}
      >
        <p>
          L’argent affecté reste dans vos comptes mais est réservé pour ce
          projet. Ce n’est pas un revenu supplémentaire.
        </p>
        <Field label="Nom du projet">
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={p.goal?.name ?? ""}
            placeholder="Le prochain iPhone"
          />
        </Field>
        <div className="form-grid">
          <Field label="Montant cible (€)">
            <input
              name="target"
              required
              inputMode="decimal"
              defaultValue={p.goal ? numberValue(p.goal.target) : ""}
            />
          </Field>
          <Field label="Déjà réservé (€)">
            <input
              name="saved"
              required
              inputMode="decimal"
              defaultValue={numberValue(p.goal?.saved ?? 0)}
            />
          </Field>
        </div>
        {footer}
        {p.goal && (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => void save(() => patchPreferences({ goal: null }))}
          >
            Retirer cet objectif et libérer sa réserve
          </button>
        )}
      </form>
    );
  if (kind === "dues")
    content = (
      <>
        <p>
          Saisissez une échéance connue. Rapprochez-la ensuite de son opération
          importée pour ne pas la compter deux fois.
        </p>
        {!snapshot.accounts.length ? (
          <Notice>
            Importez un CSV pour créer un compte avant d’ajouter une échéance.
          </Notice>
        ) : (
          <form
            onSubmit={submit(async (f) => {
              const label = String(f.get("label")).trim();
              const selectedAccount = String(f.get("account") ?? "");
              if (!label)
                throw new Error("Saisissez un libellé pour cette échéance.");
              if (!(await db.accounts.get(selectedAccount)))
                throw new Error(
                  "Choisissez un compte existant pour cette échéance.",
                );
              await db.dues.add({
                id: crypto.randomUUID(),
                label,
                amount: cents(f.get("amount"), true),
                date: String(f.get("date")),
                account: selectedAccount,
              });
            }, false)}
          >
            <div className="form-grid">
              <Field label="Libellé">
                <input name="label" required maxLength={120} />
              </Field>
              <Field label="Montant signé (€)">
                <input
                  name="amount"
                  placeholder="-950 pour une dépense"
                  required
                  inputMode="decimal"
                />
              </Field>
              <Field label="Date prévue">
                <input
                  type="date"
                  name="date"
                  defaultValue={today()}
                  required
                />
              </Field>
              <Field label="Compte">
                <Select
                  name="account"
                  required
                  value={dueAccount}
                  onChange={(e) => setDueAccount(e.target.value)}
                >
                  {snapshot.accounts.map((a) => (
                    <option key={a.id}>{a.id}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <button className="button yellow" disabled={busy}>
              Ajouter l’échéance
            </button>
          </form>
        )}
        <div className="due-editor">
          {[...snapshot.dues]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((d) => (
              <div key={d.id}>
                <div>
                  <strong>{d.label}</strong>
                  <span>
                    {dateLabel(d.date)} · {d.account} · {euro(d.amount)}
                  </span>
                </div>
                <Field
                  label={
                    d.transactionId
                      ? "Rapprochée"
                      : "Rapprocher avec une opération"
                  }
                >
                  <Select
                    disabled={busy}
                    value={d.transactionId ?? ""}
                    onChange={(e) =>
                      void save(
                        () =>
                          db.dues.put({
                            ...d,
                            transactionId: e.target.value || undefined,
                          }),
                        false,
                      )
                    }
                  >
                    <option value="">Non payée / à vérifier</option>
                    {snapshot.transactions
                      .filter(
                        (t) =>
                          t.account === d.account &&
                          Math.sign(t.amount) === Math.sign(d.amount) &&
                          !snapshot.dues.some(
                            (other) =>
                              other.id !== d.id && other.transactionId === t.id,
                          ),
                      )
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.date} · {t.merchant.slice(0, 35)} ·{" "}
                          {euro(t.amount)}
                        </option>
                      ))}
                  </Select>
                </Field>
                <button
                  disabled={busy}
                  onClick={() => void save(() => db.dues.delete(d.id), false)}
                >
                  Retirer cette échéance
                </button>
              </div>
            ))}
        </div>
      </>
    );
  if (kind === "transactions") {
    const rows = snapshot.transactions
      .filter(
        (t) =>
          within(
            t.date,
            budgetCycle(month, budgetCalendar(snapshot.transactions, today())),
          ) &&
          (!account || t.account === account) &&
          (!categoryFilter || t.category === categoryFilter) &&
          (t.merchant + " " + t.label + " " + t.account)
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    content = (
      <>
        <div className="form-grid">
          <Field label="Rechercher">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Commerçant, libellé, compte"
            />
          </Field>
          <Field label="Catégorie">
            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Toutes les catégories</option>
              {[...new Set(snapshot.transactions.map((t) => t.category))]
                .sort()
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </Select>
          </Field>
        </div>
        <p>
          {rows.length} opérations · {month}
        </p>
        <div className="transaction-editor">
          {rows.slice(page * 15, page * 15 + 15).map((t) => (
            <TransactionEditor
              key={t.id}
              transaction={t}
              save={save}
              busy={busy}
            />
          ))}
        </div>
        <div className="pagination">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            Précédent
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil(rows.length / 15))}
          </span>
          <button
            disabled={(page + 1) * 15 >= rows.length}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </button>
        </div>
      </>
    );
  }
  if (kind === "layout")
    content = (
      <>
        <p>
          Choisissez les blocs et leur ordre. Les données ne sont jamais
          supprimées lorsqu’un bloc est masqué.
        </p>
        {(Object.keys(widgetNames) as WidgetId[]).map((id) => (
          <label className="check-row" key={id}>
            <input
              type="checkbox"
              checked={widgets.includes(id)}
              onChange={(e) =>
                setWidgets(
                  e.target.checked
                    ? [...widgets, id]
                    : widgets.filter((w) => w !== id),
                )
              }
            />
            {widgetNames[id]}
          </label>
        ))}
        <ol className="layout-list">
          {widgets.map((id, i) => (
            <li key={id}>
              <span>{widgetNames[id]}</span>
              <button
                aria-label={"Monter " + widgetNames[id]}
                disabled={!i}
                onClick={() =>
                  setWidgets((w) => {
                    const n = [...w];
                    [n[i - 1], n[i]] = [n[i], n[i - 1]];
                    return n;
                  })
                }
              >
                ↑
              </button>
              <button
                aria-label={"Descendre " + widgetNames[id]}
                disabled={i === widgets.length - 1}
                onClick={() =>
                  setWidgets((w) => {
                    const n = [...w];
                    [n[i + 1], n[i]] = [n[i], n[i + 1]];
                    return n;
                  })
                }
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
        <div className="actions">
          <button
            className="button"
            onClick={() => setWidgets([...defaultPreferences.widgets])}
          >
            Vue par défaut
          </button>
          <button
            className="button yellow"
            disabled={busy}
            onClick={() => void save(() => patchPreferences({ widgets }))}
          >
            Enregistrer la vue
          </button>
        </div>
      </>
    );
  if (kind === "data")
    content = (
      <>
        <Notice>
          Les données sont conservées dans ce navigateur, sur cette adresse.
          Elles ne sont pas synchronisées et le stockage local ne remplace pas
          une sauvegarde.
        </Notice>
        <h3>Exporter</h3>
        <p>
          {snapshot.transactions.length} opérations · {snapshot.accounts.length}{" "}
          comptes
        </p>
        <div className="actions">
          <button
            className="button dark"
            onClick={() => {
              download(
                "wealthpilot-sauvegarde-" + today() + ".json",
                JSON.stringify(
                  { format: "wealthpilot-next", version: 1, data: snapshot },
                  null,
                  2,
                ),
                "application/json",
              );
              notify(
                "Sauvegarde exportée. Conservez-la dans un endroit privé.",
              );
            }}
          >
            Sauvegarde complète JSON
          </button>
          <button
            className="button"
            onClick={() =>
              download(
                "wealthpilot-operations-" + today() + ".csv",
                exportCSV(snapshot.transactions),
                "text/csv;charset=utf-8",
              )
            }
          >
            Toutes les opérations CSV
          </button>
        </div>
        <small>
          Ces fichiers ne sont pas chiffrés. Ils contiennent vos informations
          financières.
        </small>
        <h3>Restaurer une sauvegarde</h3>
        <input
          ref={backupInput}
          className="sr-only"
          tabIndex={-1}
          type="file"
          aria-label="Sauvegarde JSON"
          accept=".json"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const token = ++backupGeneration.current;
            e.target.value = "";
            setBackupFileName(f.name);
            setPendingBackup(null);
            setSafetyBackupExported(false);
            setSafetyBackupConfirmed(false);
            setError("");
            try {
              if (f.size > 30 * 1024 * 1024)
                throw new Error("Sauvegarde trop volumineuse.");
              const contents = await f.text();
              if (token !== backupGeneration.current) return;
              setPendingBackup(validateBackup(JSON.parse(contents)));
              setError("");
            } catch (err) {
              if (token !== backupGeneration.current) return;
              setPendingBackup(null);
              setError((err as Error).message);
            }
          }}
        />
        <button
          className="button dark"
          disabled={busy}
          onClick={() => backupInput.current?.click()}
        >
          {backupFileName
            ? "Choisir une autre sauvegarde JSON"
            : "Choisir une sauvegarde JSON"}
        </button>
        <p className="muted" role="status">
          {backupFileName
            ? "Fichier sélectionné : " + backupFileName
            : "Fichier JSON WealthPilot · 30 Mo maximum · lecture locale uniquement."}
        </p>
        {pendingBackup && (
          <>
            <Notice>
              Fichier validé : {pendingBackup.transactions.length} opérations,{" "}
              {pendingBackup.accounts.length} comptes. Cette restauration
              remplacera la nouvelle base uniquement. Exportez votre sauvegarde
              actuelle avant de confirmer.
            </Notice>
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const current = await db.snapshot();
                  download(
                    "wealthpilot-avant-restauration-" + today() + ".json",
                    JSON.stringify(
                      { format: "wealthpilot-next", version: 1, data: current },
                      null,
                      2,
                    ),
                    "application/json",
                  );
                  setSafetyBackupExported(true);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Télécharger la sauvegarde actuelle
            </button>
            <label className="check-row">
              <input
                type="checkbox"
                disabled={!safetyBackupExported || busy}
                checked={safetyBackupConfirmed}
                onChange={(e) => setSafetyBackupConfirmed(e.target.checked)}
              />
              J’ai conservé la sauvegarde actuelle avant de remplacer les
              données.
            </label>
            <div className="actions">
              <button className="button" onClick={() => setPendingBackup(null)}>
                Annuler
              </button>
              <button
                className="button danger"
                disabled={busy || !safetyBackupConfirmed}
                onClick={() => void save(() => restoreBackup(pendingBackup))}
              >
                Confirmer le remplacement
              </button>
            </div>
          </>
        )}
        <h3>Références conservées</h3>
        <p>
          <a href="/references/index.html" target="_blank" rel="noreferrer">
            Ouvrir les pages, composants et documents ↗
          </a>
        </p>
      </>
    );
  const Container = inline ? InlinePanel : Modal;
  return (
    <Container
      title={titles[kind]}
      onClose={onClose}
      wide={["transactions", "dues", "layout"].includes(kind)}
    >
      {error && <Notice error>{error}</Notice>}
      {content}
    </Container>
  );
}
function TransactionEditor({
  transaction: t,
  save,
  busy,
}: {
  transaction: Transaction;
  save: (a: () => Promise<unknown>, close?: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [category, setCategory] = useState(t.category),
    [internal, setInternal] = useState(t.internal);
  return (
    <details>
      <summary>
        <MerchantIcon name={t.merchant} category={t.category} />
        <span>
          <strong>{t.merchant}</strong>
          <small>
            {dateLabel(t.date)} · {t.account}
          </small>
        </span>
        <b>{euro(t.amount)}</b>
      </summary>
      <p className="raw-label">Libellé source : {t.label}</p>
      <Field label="Catégorie">
        <input value={category} onChange={(e) => setCategory(e.target.value)} />
      </Field>
      <label className="check-row">
        <input
          type="checkbox"
          checked={internal}
          onChange={(e) => setInternal(e.target.checked)}
        />
        Virement interne (exclu des dépenses et revenus)
      </label>
      <button
        className="button"
        disabled={busy || !category.trim()}
        onClick={() =>
          void save(
            () =>
              db.transactions.update(t.id, {
                category: category.trim(),
                internal,
              }),
            false,
          )
        }
      >
        Enregistrer la correction
      </button>
    </details>
  );
}
