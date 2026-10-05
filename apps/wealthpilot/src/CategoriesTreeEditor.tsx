import { useMemo, useState } from "react";
import type { CategoryDefinition, Snapshot } from "./types";
import {
  categoryCatalog,
  prepareCategoryChange,
  applyCategoryDefinitionPlan,
  type CategoryDefinitionPlan,
  type CategoryAction,
} from "./category-definitions";
import {
  GoalAppearance,
  GoalIdentity,
  goalAppearance,
  goalColors,
} from "./GoalIdentity";
import { db } from "./store";
import { Field, Notice } from "./ui";
import { Select } from "./Select";
export function CategoriesTreeEditor({
  snapshot,
  notify,
}: {
  snapshot: Snapshot;
  notify: (s: string) => void;
}) {
  const catalog = useMemo(() => categoryCatalog(snapshot), [snapshot]);
  const registered =
    catalog.length === (snapshot.preferences.categoryDefinitions ?? []).length;
  const [editing, setEditing] = useState<CategoryDefinition | null>(null),
    [mergeSource, setMergeSource] = useState(""),
    [mergeTarget, setMergeTarget] = useState(""),
    [pending, setPending] = useState<CategoryDefinitionPlan | null>(null),
    [undo, setUndo] = useState<CategoryDefinitionPlan | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const roots = catalog
    .filter((d) => !d.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));
  function prepare(action: CategoryAction) {
    setError("");
    try {
      setPending(prepareCategoryChange(snapshot, action, catalog));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function commit(reverse = false) {
    const plan = reverse ? undo : pending;
    if (!plan || busy) return;
    setBusy(true);
    setError("");
    try {
      await applyCategoryDefinitionPlan(db, plan, reverse);
      setPending(null);
      setEditing(null);
      setMergeSource("");
      setMergeTarget("");
      setUndo(reverse ? null : plan);
      notify(
        reverse
          ? "Modification de l’arborescence annulée."
          : "Arborescence et références mises à jour ensemble.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const item = (d: CategoryDefinition) => (
    <div
      className={"definition-row " + (d.parentId ? "definition-child" : "")}
      key={d.id}
    >
      <GoalIdentity goal={{ ...d, target: 1, saved: 0 }} size={18} />
      <div>
        <b>{d.name}</b>
        {d.archived && <small>Archivée — références conservées</small>}
      </div>
      {registered && (
        <div className="actions">
          <button
            className="button compact"
            disabled={busy}
            aria-label={"Modifier catégorie " + d.name}
            onClick={() => {
              setEditing({ ...d });
              setPending(null);
              setMergeSource("");
            }}
          >
            Modifier
          </button>
          <button
            className="text-button"
            disabled={busy}
            aria-label={(d.archived ? "Réactiver " : "Archiver ") + d.name}
            onClick={() =>
              prepare({ kind: "archive", id: d.id, archived: !d.archived })
            }
          >
            {d.archived ? "Réactiver" : "Archiver"}
          </button>
          <button
            className="text-button"
            disabled={busy || d.archived}
            aria-label={"Fusionner " + d.name}
            onClick={() => {
              setMergeSource(d.id);
              setMergeTarget("");
              setPending(null);
              setEditing(null);
            }}
          >
            Fusionner
          </button>
        </div>
      )}
    </div>
  );
  return (
    <section
      className="card category-definitions"
      aria-label="Organiser l’arborescence"
    >
      <div className="card-heading">
        <h2>Votre arborescence</h2>
        <button
          className="button"
          disabled={busy || !registered || catalog.length >= 1000}
          onClick={() => {
            setEditing({
              id: crypto.randomUUID(),
              name: "",
              icon: "target",
              color: goalColors[catalog.length % goalColors.length],
            });
            setPending(null);
            setMergeSource("");
          }}
        >
          Créer une catégorie
        </button>
      </div>
      <p>
        Les identifiants restent stables lors d’un renommage. Une archive
        conserve l’historique ; une fusion modifie explicitement les références
        après aperçu.
      </p>
      {!registered && (
        <Notice>
          Des catégories proviennent encore des libellés historiques.{" "}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => prepare({ kind: "register" })}
          >
            Préparer leur association stable
          </button>
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      <div className="definition-list">
        {roots.map((root) => (
          <div key={root.id}>
            {item(root)}
            {catalog
              .filter((d) => d.parentId === root.id)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(item)}
          </div>
        ))}
      </div>
      {!roots.length && <p>Aucune catégorie définie.</p>}
      {editing && (
        <form
          className="category-definition-editor"
          style={goalAppearance(editing.color)}
          aria-label="Éditeur de catégorie"
          onSubmit={(e) => {
            e.preventDefault();
            prepare({ kind: "save", definition: editing });
          }}
        >
          <div className="form-grid">
            <Field label="Nom de catégorie">
              <input
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) => {
                  setEditing({ ...editing, name: e.target.value });
                  setPending(null);
                }}
              />
            </Field>
            <Field label="Niveau de catégorie">
              <Select
                disabled={catalog.some((d) => d.id === editing.id)}
                value={editing.parentId ?? ""}
                onChange={(e) => {
                  setEditing({
                    ...editing,
                    parentId: e.target.value || undefined,
                  });
                  setPending(null);
                }}
              >
                <option value="">Catégorie principale</option>
                {roots
                  .filter((d) => !d.archived)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      Sous-catégorie de {d.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <GoalAppearance
            goal={{ ...editing, target: 1, saved: 0 }}
            change={(key, value) => {
              setEditing({ ...editing, [key]: value });
              setPending(null);
            }}
          />
          <div className="actions">
            <button className="button yellow" disabled={busy}>
              Prévisualiser la modification
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setPending(null);
              }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}
      {mergeSource && (
        <section
          className="category-definition-editor"
          aria-label="Préparer une fusion"
        >
          <h3>Fusionner {catalog.find((d) => d.id === mergeSource)?.name}</h3>
          <Field label="Destination de la fusion">
            <Select
              value={mergeTarget}
              onChange={(e) => {
                setMergeTarget(e.target.value);
                setPending(null);
              }}
            >
              <option value="">Choisir une destination</option>
              {catalog
                .filter(
                  (d) =>
                    d.id !== mergeSource &&
                    !d.archived &&
                    d.parentId ===
                      catalog.find((c) => c.id === mergeSource)?.parentId,
                )
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </Field>
          <p>
            Les budgets d’un même mois et compte sont additionnés, jamais
            écrasés. La catégorie source est archivée ; les montants bancaires
            ne changent pas.
          </p>
          <div className="actions">
            <button
              className="button yellow"
              disabled={busy || !mergeTarget}
              onClick={() =>
                prepare({
                  kind: "merge",
                  source: mergeSource,
                  target: mergeTarget,
                })
              }
            >
              Prévisualiser la fusion
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                setMergeSource("");
                setPending(null);
              }}
            >
              Annuler
            </button>
          </div>
        </section>
      )}
      {pending && (
        <section
          className="definition-impact"
          aria-label="Impact de l’arborescence"
        >
          <h3>{pending.title}</h3>
          <p>
            {pending.transactions} opérations à associer ou renommer ·{" "}
            {pending.budgets} enveloppes mises à jour · {pending.mergedBudgets}{" "}
            enveloppes fusionnées · {pending.dues} échéances renommées.
          </p>
          <p>
            Les références des règles, récurrences et plans hebdomadaires
            suivent aussi ce changement. Aucun montant ni libellé bancaire n’est
            modifié. L’aperçu porte sur tout l’historique, indépendamment du
            filtre de cette page.
          </p>
          <div className="actions">
            <button
              className="button yellow"
              disabled={busy}
              onClick={() => void commit()}
            >
              Confirmer cet impact
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Ne pas appliquer
            </button>
          </div>
        </section>
      )}
      {undo && (
        <div className="definition-impact" role="status">
          <p>
            Dernière modification annulable tant que cette page reste ouverte.
            Toute modification concurrente bloque l’annulation pour préserver
            vos corrections.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void commit(true)}
          >
            Annuler la modification d’arborescence
          </button>
        </div>
      )}
    </section>
  );
}
