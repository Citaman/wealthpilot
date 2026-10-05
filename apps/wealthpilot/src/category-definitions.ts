import type { CategoryDefinition, Snapshot } from "./types";
import type { WealthDatabase } from "./store";
import { normalize } from "./search";
import { goalColors } from "./GoalIdentity";

export type CategoryAction =
  | { kind: "register" }
  | { kind: "save"; definition: CategoryDefinition }
  | { kind: "archive"; id: string; archived: boolean }
  | { kind: "merge"; source: string; target: string };
export function categoryCatalog(s: Snapshot): CategoryDefinition[] {
  const result = (s.preferences.categoryDefinitions ?? []).map((d) => ({
    ...d,
  }));
  const add = (name: string, parentId?: string) => {
    if (!name.trim()) return undefined;
    let d = result.find((d) => d.parentId === parentId && d.name === name);
    if (!d) {
      d = {
        id: crypto.randomUUID(),
        name,
        parentId,
        icon: "target",
        color: goalColors[result.length % goalColors.length],
      };
      result.push(d);
    }
    return d;
  };
  for (const t of s.transactions) {
    const root = add(t.category);
    if (root && t.subcategory) add(t.subcategory, root.id);
  }
  for (const b of s.budgets) add(b.category);
  for (const r of s.preferences.categoryRules ?? []) {
    const root = add(r.category);
    if (root && r.subcategory) add(r.subcategory, root.id);
  }
  return result;
}
const sorted = <T extends { id: string }>(rows: T[]) =>
  rows.slice().sort((a, b) => a.id.localeCompare(b.id));
const revision = (s: Snapshot) =>
  JSON.stringify([
    sorted(s.transactions),
    sorted(s.budgets),
    sorted(s.dues),
    s.preferences.categoryDefinitions ?? [],
    s.preferences.categoryRules ?? [],
    s.preferences.recurrenceRules ?? [],
    s.preferences.weeklyPlans ?? [],
  ]);
export interface CategoryDefinitionPlan {
  title: string;
  before: Snapshot;
  after: Snapshot;
  transactions: number;
  budgets: number;
  mergedBudgets: number;
  dues: number;
}
export function prepareCategoryChange(
  s: Snapshot,
  action: CategoryAction,
  catalog = categoryCatalog(s),
): CategoryDefinitionPlan {
  let definitions = catalog.map((d) => ({ ...d }));
  const redirects = new Map<string, string>();
  let title = "Associer l’arborescence aux opérations existantes";
  if (action.kind === "save") {
    const d = { ...action.definition, name: action.definition.name.trim() },
      old = catalog.find((c) => c.id === d.id);
    if (!d.name || d.name.length > 100)
      throw new Error("Le nom doit contenir de 1 à 100 caractères.");
    if (old && old.parentId !== d.parentId)
      throw new Error(
        "Le déplacement entre parents se fait par une fusion explicite.",
      );
    if (
      d.parentId &&
      !definitions.some(
        (p) => p.id === d.parentId && !p.parentId && !p.archived,
      )
    )
      throw new Error("Choisissez une catégorie parente active.");
    if (
      definitions.some(
        (c) =>
          c.id !== d.id &&
          c.parentId === d.parentId &&
          normalize(c.name) === normalize(d.name),
      )
    )
      throw new Error("Ce nom existe déjà à ce niveau. Utilisez la fusion.");
    definitions = [...definitions.filter((c) => c.id !== d.id), d];
    title = old
      ? `Modifier « ${old.name} » en « ${d.name} »`
      : `Créer « ${d.name} »`;
  } else if (action.kind === "archive") {
    const d = definitions.find((c) => c.id === action.id);
    if (!d) throw new Error("Catégorie introuvable.");
    definitions = definitions.map((c) =>
      c.id === d.id || c.parentId === d.id
        ? { ...c, archived: action.archived }
        : c,
    );
    title = `${action.archived ? "Archiver" : "Réactiver"} « ${d.name} » et ses sous-catégories`;
  } else if (action.kind === "merge") {
    const source = definitions.find((d) => d.id === action.source),
      target = definitions.find((d) => d.id === action.target);
    if (
      !source ||
      !target ||
      source.id === target.id ||
      source.parentId !== target.parentId ||
      target.archived
    )
      throw new Error(
        "La destination doit être une autre catégorie active au même niveau.",
      );
    redirects.set(source.id, target.id);
    for (const child of catalog.filter((d) => d.parentId === source.id)) {
      const collision = catalog.find(
        (d) =>
          d.parentId === target.id &&
          normalize(d.name) === normalize(child.name) &&
          !d.archived,
      );
      if (collision) redirects.set(child.id, collision.id);
      else
        definitions = definitions.map((d) =>
          d.id === child.id ? { ...d, parentId: target.id } : d,
        );
    }
    definitions = definitions.map((d) =>
      redirects.has(d.id) ? { ...d, archived: true } : d,
    );
    title = `Fusionner « ${source.name} » vers « ${target.name} »`;
  }
  if (definitions.length > 1000)
    throw new Error("La limite est de 1 000 catégories et sous-catégories.");
  const findRoot = (name: string, id?: string) =>
    catalog.find((d) => d.id === id && !d.parentId) ??
    catalog.find((d) => !d.parentId && d.name === name);
  const mapped = (id: string) =>
    definitions.find((d) => d.id === (redirects.get(id) ?? id));
  const nameMap = new Map(
    catalog
      .filter((d) => !d.parentId)
      .map((d) => [d.name, mapped(d.id)?.name ?? d.name]),
  );
  const rename = (name: string) => nameMap.get(name) ?? name;
  const tx = s.transactions.map((t) => {
    const old = findRoot(t.category, t.categoryId),
      root = old && mapped(old.id);
    if (!old || !root) return t;
    const child =
      catalog.find((d) => d.id === t.subcategoryId && d.parentId === old.id) ??
      catalog.find((d) => d.parentId === old.id && d.name === t.subcategory);
    const sub = child && mapped(child.id);
    return {
      ...t,
      category: root.name,
      categoryId: root.id,
      subcategory: sub?.name ?? t.subcategory,
      subcategoryId: sub?.id,
    };
  });
  let budgets = s.budgets.map((b) => {
    const old = findRoot(b.category, b.categoryId),
      root = old && mapped(old.id);
    return root ? { ...b, category: root.name, categoryId: root.id } : b;
  });
  let mergedBudgets = 0;
  if (
    action.kind === "merge" &&
    !catalog.find((d) => d.id === action.source)?.parentId
  ) {
    const buckets = new Map<string, (typeof budgets)[number]>();
    for (const b of budgets) {
      const key =
        b.categoryId === action.target
          ? JSON.stringify([b.month, b.account ?? "", b.categoryId])
          : b.id;
      const prior = buckets.get(key);
      if (prior) {
        const amount = prior.amount + b.amount;
        if (!Number.isSafeInteger(amount) || amount > 1e12)
          throw new Error("Le budget fusionné dépasse la limite de montant.");
        buckets.set(key, { ...prior, amount });
        mergedBudgets++;
      } else buckets.set(key, b);
    }
    budgets = [...buckets.values()];
  }
  const rules = (s.preferences.categoryRules ?? []).map((r) => {
    const old = findRoot(r.category),
      child =
        old &&
        catalog.find((d) => d.parentId === old.id && d.name === r.subcategory);
    return {
      ...r,
      category: rename(r.category),
      subcategory: child ? mapped(child.id)?.name : r.subcategory,
    };
  });
  const dues = s.dues.map((d) =>
    d.category ? { ...d, category: rename(d.category) } : d,
  );
  const after: Snapshot = {
    ...s,
    transactions: tx,
    budgets,
    dues,
    preferences: {
      ...s.preferences,
      categoryDefinitions: definitions,
      categoryRules: rules,
      recurrenceRules: s.preferences.recurrenceRules?.map((r) => ({
        ...r,
        category: rename(r.category),
      })),
      weeklyPlans: s.preferences.weeklyPlans?.map((p) => {
        const limits: Record<string, number> = {};
        for (const [key, amount] of Object.entries(p.limits)) {
          const total = (limits[rename(key)] ?? 0) + amount;
          if (!Number.isSafeInteger(total) || total > 1e12)
            throw new Error(
              "L’enveloppe hebdomadaire fusionnée dépasse la limite de montant.",
            );
          limits[rename(key)] = total;
        }
        return { ...p, limits };
      }),
    },
  };
  return {
    title,
    before: s,
    after,
    transactions: tx.filter(
      (t, i) => JSON.stringify(t) !== JSON.stringify(s.transactions[i]),
    ).length,
    budgets: budgets.filter(
      (b) =>
        JSON.stringify(b) !==
        JSON.stringify(s.budgets.find((x) => x.id === b.id)),
    ).length,
    mergedBudgets,
    dues: dues.filter((d, i) => d.category !== s.dues[i].category).length,
  };
}
export async function applyCategoryDefinitionPlan(
  db: WealthDatabase,
  plan: CategoryDefinitionPlan,
  undo = false,
) {
  const expected = undo ? plan.after : plan.before,
    next = undo ? plan.before : plan.after;
  await db.transaction(
    "rw",
    db.transactions,
    db.budgets,
    db.dues,
    db.preferences,
    async () => {
      const current: Snapshot = {
        ...expected,
        transactions: await db.transactions.toArray(),
        budgets: await db.budgets.toArray(),
        dues: await db.dues.toArray(),
        preferences: (await db.preferences.get("main")) ?? expected.preferences,
      };
      if (revision(current) !== revision(expected))
        throw new Error(
          "Les données ont changé depuis l’aperçu. Rien n’a été modifié ; refaites l’aperçu ou conservez les nouvelles corrections.",
        );
      const currentTx = new Map(current.transactions.map((t) => [t.id, t]));
      const changedTx = next.transactions.filter(
        (t) => JSON.stringify(t) !== JSON.stringify(currentTx.get(t.id)),
      );
      if (changedTx.length) await db.transactions.bulkPut(changedTx);
      const removedBudgets = current.budgets
        .filter((b) => !next.budgets.some((x) => x.id === b.id))
        .map((b) => b.id);
      if (removedBudgets.length) await db.budgets.bulkDelete(removedBudgets);
      if (next.budgets.length) await db.budgets.bulkPut(next.budgets);
      if (next.dues.length) await db.dues.bulkPut(next.dues);
      await db.preferences.put({
        ...current.preferences,
        categoryDefinitions: next.preferences.categoryDefinitions,
        categoryRules: next.preferences.categoryRules,
        recurrenceRules: next.preferences.recurrenceRules,
        weeklyPlans: next.preferences.weeklyPlans,
      });
    },
  );
}
