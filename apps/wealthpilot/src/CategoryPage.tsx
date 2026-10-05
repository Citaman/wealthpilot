import { useMemo, useState } from "react";
import type { CategoryRule, Snapshot } from "./types";
import { db } from "./store";
import { dateLabel, euro, monthEnd } from "./domain";
import { Field, Notice } from "./ui";
import { Select } from "./Select";
import { normalize } from "./search";
import {
  applyCategoryPreview,
  isUnclassified,
  previewCategoryRules,
  rulesRevision,
  undoCategoryChanges,
  type CategoryChange,
} from "./category-rules";
import "./category-controls.css";
import { CategoriesTreeEditor } from "./CategoriesTreeEditor";

const newRule = (account: string, priority: number): CategoryRule => ({
  id: crypto.randomUUID(),
  name: "",
  pattern: "",
  account: account || undefined,
  direction: "expense",
  category: "",
  enabled: true,
  priority,
});
export function CategoriesPage({
  snapshot,
  from,
  month,
  account,
  notify,
  onTransactions,
}: {
  snapshot: Snapshot;
  from: string;
  month: string;
  account: string;
  notify: (s: string) => void;
  onTransactions?: (category: string) => void;
}) {
  const rules = snapshot.preferences.categoryRules ?? [];
  const [editing, setEditing] = useState<CategoryRule | null>(null),
    [original, setOriginal] = useState<CategoryRule | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ReturnType<
      typeof previewCategoryRules
    > | null>(null),
    [undo, setUndo] = useState<CategoryChange[]>([]),
    [search, setSearch] = useState("");
  const [previewPage, setPreviewPage] = useState(0);
  const scoped = useMemo(
    () =>
      snapshot.transactions.filter(
        (t) =>
          t.date >= from + "-01" &&
          t.date <= monthEnd(month) &&
          (!account || t.account === account),
      ),
    [snapshot.transactions, from, month, account],
  );
  const tree = useMemo(() => {
    const groups = new Map<
      string,
      { total: number; count: number; sub: Map<string, number> }
    >();
    for (const t of scoped.filter((t) => !t.internal)) {
      const g = groups.get(t.category) ?? {
        total: 0,
        count: 0,
        sub: new Map<string, number>(),
      };
      g.count++;
      if (t.amount < 0) g.total -= t.amount;
      if (t.subcategory)
        g.sub.set(t.subcategory, (g.sub.get(t.subcategory) ?? 0) + 1);
      groups.set(t.category, g);
    }
    return [...groups.entries()]
      .filter(([category]) => normalize(category).includes(normalize(search)))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [scoped, search]);
  async function mutate(run: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await run();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveRule() {
    if (!editing) return;
    const saved = {
      ...editing,
      name: editing.name.trim(),
      pattern: editing.pattern.trim(),
      category: editing.category.trim(),
      subcategory: editing.subcategory?.trim() || undefined,
      account: editing.account || undefined,
    };
    if (
      !saved.name ||
      normalize(saved.pattern).length < 2 ||
      !saved.category ||
      isUnclassified(saved.category)
    )
      throw new Error(
        "Renseignez un nom, au moins deux caractères significatifs et une catégorie de destination précise.",
      );
    await db.transaction("rw", db.preferences, db.accounts, async () => {
      const p = (await db.preferences.get("main")) ?? snapshot.preferences;
      const current = p.categoryRules ?? [];
      if (
        JSON.stringify(current.find((r) => r.id === saved.id) ?? null) !==
        JSON.stringify(original)
      )
        throw new Error(
          "Cette règle a changé ailleurs. Votre brouillon est conservé ; annulez puis rouvrez la règle pour comparer.",
        );
      if (!original && current.length >= 200)
        throw new Error("La limite est de 200 règles.");
      if (saved.account && !(await db.accounts.get(saved.account)))
        throw new Error("Ce compte n’existe plus.");
      await db.preferences.put({
        ...p,
        categoryRules: [...current.filter((r) => r.id !== saved.id), saved],
      });
    });
    setEditing(null);
    setPreview(null);
    notify("Règle enregistrée. Testez son impact avant de l’appliquer.");
  }
  async function reorder(id: string, delta: number) {
    await db.transaction("rw", db.preferences, async () => {
      const p = (await db.preferences.get("main")) ?? snapshot.preferences;
      if (rulesRevision(p.categoryRules ?? []) !== rulesRevision(rules))
        throw new Error(
          "L’ordre des règles a changé. Réessayez avec la liste à jour.",
        );
      const ordered = rules
        .slice()
        .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
      const at = ordered.findIndex((r) => r.id === id),
        next = at + delta;
      if (next < 0 || next >= ordered.length) return;
      [ordered[at], ordered[next]] = [ordered[next], ordered[at]];
      await db.preferences.put({
        ...p,
        categoryRules: ordered.map((r, priority) => ({ ...r, priority })),
      });
    });
    setPreview(null);
  }
  const ordered = rules
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const previewScope = `${from}/${month}/${account}`;
  const [reviewScope, setReviewScope] = useState("");
  return (
    <main className="page categories-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">CLASSIFICATION EXPLICITE</span>
          <h1>Catégories & règles.</h1>
          <p>
            {account || "Tous les comptes"} · {from} → {month} · {scoped.length}{" "}
            opérations
          </p>
        </div>
        <button
          className="button yellow"
          disabled={busy || rules.length >= 200}
          onClick={() => {
            setOriginal(null);
            setEditing(newRule(account, rules.length));
            setError("");
          }}
        >
          Créer une règle
        </button>
      </div>
      <Notice>
        Les règles sont testées puis appliquées explicitement. Elles ne
        remplacent ni une catégorie existante ni une opération déjà vérifiée.
        Aucun import futur n’est modifié automatiquement. Une destination
        archivée ne produit pas de nouvelles propositions.
      </Notice>
      {error && <Notice error>{error}</Notice>}
      {editing && (
        <section className="card category-editor" aria-label="Éditeur de règle">
          <h2>{original ? "Modifier la règle" : "Nouvelle règle"}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(saveRule);
            }}
          >
            <div className="form-grid">
              <Field label="Nom de la règle">
                <input
                  required
                  maxLength={100}
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Mots du libellé ou de l’entité">
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Ex. free mobile"
                  value={editing.pattern}
                  onChange={(e) =>
                    setEditing({ ...editing, pattern: e.target.value })
                  }
                />
              </Field>
              <Field label="Compte de la règle">
                <Select
                  value={editing.account ?? ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      account: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">Tous les comptes</option>
                  {snapshot.accounts.map((a) => (
                    <option key={a.id}>{a.id}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Sens">
                <Select
                  value={editing.direction}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      direction: e.target.value as CategoryRule["direction"],
                    })
                  }
                >
                  <option value="expense">Dépenses</option>
                  <option value="income">Entrées</option>
                  <option value="all">Les deux</option>
                </Select>
              </Field>
              <Field label="Catégorie cible">
                <input
                  required
                  maxLength={100}
                  list="existing-rule-categories"
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value })
                  }
                />
                <datalist id="existing-rule-categories">
                  {[...new Set(snapshot.transactions.map((t) => t.category))]
                    .filter((c) => !isUnclassified(c))
                    .map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                </datalist>
              </Field>
              <Field label="Sous-catégorie cible (facultatif)">
                <input
                  maxLength={100}
                  value={editing.subcategory ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, subcategory: e.target.value })
                  }
                />
              </Field>
            </div>
            <p>
              Les mots doivent se suivre, accents et casse ignorés. « Free » ne
              correspond pas à « Freepik ». En cas de recouvrement, la première
              règle active gagne.
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={editing.enabled}
                onChange={(e) =>
                  setEditing({ ...editing, enabled: e.target.checked })
                }
              />
              Règle active dans les aperçus
            </label>
            <div className="actions">
              <button className="button yellow" disabled={busy}>
                Enregistrer la règle
              </button>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null);
                  setError("");
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="card">
        <div className="card-heading">
          <h2>Règles de classification</h2>
          <button
            className="button"
            disabled={busy || !rules.some((r) => r.enabled)}
            onClick={() => {
              setPreview(
                previewCategoryRules(
                  scoped,
                  rules,
                  snapshot.preferences.categoryDefinitions,
                ),
              );
              setPreviewPage(0);
              setReviewScope(previewScope);
              setError("");
            }}
          >
            Tester sur ce périmètre
          </button>
        </div>
        {!ordered.length && (
          <p>
            Aucune règle. Créez une correspondance ciblée, puis examinez son
            impact.
          </p>
        )}
        <ol className="category-rule-list">
          {ordered.map((r, i) => (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <p>
                  « {r.pattern} » → {r.category}
                  {r.subcategory ? " / " + r.subcategory : ""}
                </p>
                <small>
                  {r.account || "Tous les comptes"} ·{" "}
                  {r.direction === "all"
                    ? "Entrées et dépenses"
                    : r.direction === "income"
                      ? "Entrées"
                      : "Dépenses"}{" "}
                  · {r.enabled ? "Active" : "Désactivée"}
                </small>
              </div>
              <div className="actions">
                <button
                  className="button compact"
                  disabled={busy || i === 0}
                  aria-label={"Monter " + r.name}
                  onClick={() => void mutate(() => reorder(r.id, -1))}
                >
                  ↑
                </button>
                <button
                  className="button compact"
                  disabled={busy || i === ordered.length - 1}
                  aria-label={"Descendre " + r.name}
                  onClick={() => void mutate(() => reorder(r.id, 1))}
                >
                  ↓
                </button>
                <button
                  className="button compact"
                  disabled={busy}
                  aria-label={"Modifier " + r.name}
                  onClick={() => {
                    setOriginal(r);
                    setEditing({ ...r });
                    setError("");
                  }}
                >
                  Modifier
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {preview && (
        <section className="card" aria-label="Aperçu de classification">
          <h2>{preview.changes.length} opérations à classer</h2>
          <p>
            {preview.protectedCount} déjà classées ou vérifiées protégées ·{" "}
            {preview.unmatched} sans correspondance. Toutes les opérations
            proposées dans cet aperçu seront modifiées, sur l’ensemble de ses
            pages.
          </p>
          {reviewScope !== previewScope && (
            <Notice error>
              Le périmètre a changé. Refaire le test avant d’appliquer.
            </Notice>
          )}
          <div
            className="category-preview-scroll"
            tabIndex={0}
            role="region"
            aria-label="Opérations proposées"
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opération</th>
                  <th>Montant</th>
                  <th>Résultat</th>
                  <th>Règle</th>
                </tr>
              </thead>
              <tbody>
                {preview.changes
                  .slice(previewPage * 100, (previewPage + 1) * 100)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>{dateLabel(c.date)}</td>
                      <td>{c.label}</td>
                      <td>{euro(c.amount)}</td>
                      <td>
                        {c.after.category}
                        {c.after.subcategory ? " / " + c.after.subcategory : ""}
                      </td>
                      <td>{c.ruleName}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {preview.changes.length > 100 && (
            <nav className="actions" aria-label="Pages de l’aperçu">
              <button
                className="button compact"
                disabled={previewPage === 0}
                onClick={() => setPreviewPage((p) => p - 1)}
              >
                Page précédente
              </button>
              <span aria-live="polite">
                {previewPage * 100 + 1}–
                {Math.min((previewPage + 1) * 100, preview.changes.length)} sur{" "}
                {preview.changes.length}
              </span>
              <button
                className="button compact"
                disabled={(previewPage + 1) * 100 >= preview.changes.length}
                onClick={() => setPreviewPage((p) => p + 1)}
              >
                Page suivante
              </button>
            </nav>
          )}
          <button
            className="button yellow"
            disabled={
              busy || !preview.changes.length || reviewScope !== previewScope
            }
            onClick={() =>
              void mutate(async () => {
                const changes = await applyCategoryPreview(db, preview);
                setUndo(changes);
                setPreview(null);
                notify(
                  `${changes.length} classifications appliquées. Annulation disponible sur cette page.`,
                );
              })
            }
          >
            Appliquer aux {preview.changes.length} opérations proposées
          </button>
        </section>
      )}
      {!!undo.length && (
        <section className="card" role="status">
          <p>
            {undo.length} classifications appliquées. Les soldes et libellés
            bancaires sont inchangés. Annulation disponible tant que cette page
            reste ouverte.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void mutate(async () => {
                await undoCategoryChanges(db, undo);
                setUndo([]);
                notify(
                  "Classification annulée sans modifier les autres champs.",
                );
              })
            }
          >
            Annuler cette application
          </button>
        </section>
      )}
      <section className="card">
        <div className="card-heading">
          <h2>Catégories présentes</h2>
          <Field label="Rechercher une catégorie">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
        <div className="category-tree">
          {tree.map(([category, g]) => (
            <article key={category}>
              <div>
                <h3>{category || "Sans catégorie"}</h3>
                <strong>{euro(g.total)}</strong>
              </div>
              <p>{g.count} opérations · dépenses brutes, hors virements</p>
              {g.sub.size > 0 && (
                <ul>
                  {[...g.sub.entries()].map(([sub, count]) => (
                    <li key={sub}>
                      {sub}
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              )}
              {onTransactions && (
                <button
                  className="text-button"
                  onClick={() => onTransactions(category)}
                >
                  Voir les opérations
                </button>
              )}
            </article>
          ))}
        </div>
        {!tree.length && <p>Aucune catégorie sur ce périmètre.</p>}
        <small>
          Statistiques du périmètre sélectionné. Organisez les noms et identités
          dans l’arborescence ci-dessous.
        </small>
      </section>
      <CategoriesTreeEditor snapshot={snapshot} notify={notify} />
    </main>
  );
}
