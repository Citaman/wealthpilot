import type { CategoryRule, CategoryDefinition, Transaction } from "./types";
import { normalize } from "./search";
import type { WealthDatabase } from "./store";

export const rulesRevision = (rules: CategoryRule[]) =>
  JSON.stringify(rules.slice().sort((a, b) => a.id.localeCompare(b.id)));
export const isUnclassified = (category: string) =>
  [
    "",
    "a categoriser",
    "non classe",
    "non classee",
    "uncategorized",
    "uncategorised",
    "sans categorie",
  ].includes(normalize(category));
export function ruleMatches(rule: CategoryRule, t: Transaction) {
  return compiledMatch(rule)(t, normalizedTexts(t));
}
const normalizedTexts = (t: Transaction) =>
  [t.label, t.merchant, t.merchantName ?? ""].map(
    (text) => " " + normalize(text) + " ",
  );
function compiledMatch(rule: CategoryRule) {
  const pattern = normalize(rule.pattern);
  const needle = " " + pattern + " ";
  return (t: Transaction, texts: string[]) => {
    if (
      !rule.enabled ||
      t.internal ||
      (rule.account && rule.account !== t.account) ||
      (rule.direction === "expense" && t.amount >= 0) ||
      (rule.direction === "income" && t.amount <= 0)
    )
      return false;
    if (pattern.length < 2) return false;
    return texts.some((text) => text.includes(needle));
  };
}
const transactionRevision = (t: Transaction) =>
  JSON.stringify([
    t.account,
    t.date,
    t.amount,
    t.label,
    t.merchant,
    t.merchantName,
    t.category,
    t.subcategory,
    t.internal,
    t.reviewed,
    t.categoryId,
    t.subcategoryId,
  ]);
export interface CategoryChange {
  id: string;
  label: string;
  date: string;
  amount: number;
  ruleId: string;
  ruleName: string;
  before: {
    category: string;
    subcategory?: string;
    categoryId?: string;
    subcategoryId?: string;
  };
  after: {
    category: string;
    subcategory?: string;
    categoryId?: string;
    subcategoryId?: string;
  };
  revision: string;
}
export function previewCategoryRules(
  transactions: Transaction[],
  rules: CategoryRule[],
  definitions: CategoryDefinition[] = [],
) {
  const ordered = rules
    .filter(
      (r) =>
        r.enabled &&
        !definitions.some(
          (d) => !d.parentId && d.name === r.category && d.archived,
        ),
    )
    .slice()
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .map((rule) => ({ rule, matches: compiledMatch(rule) }));
  let protectedCount = 0,
    unmatched = 0;
  const changes: CategoryChange[] = [];
  for (const t of transactions) {
    const texts = normalizedTexts(t);
    const rule = ordered.find((r) => r.matches(t, texts))?.rule;
    if (!rule) {
      unmatched++;
      continue;
    }
    if (!isUnclassified(t.category) || t.reviewed) {
      protectedCount++;
      continue;
    }
    const category = definitions.find(
      (d) => !d.parentId && !d.archived && d.name === rule.category.trim(),
    );
    const subcategory =
      category &&
      definitions.find(
        (d) =>
          d.parentId === category.id &&
          !d.archived &&
          d.name === rule.subcategory?.trim(),
      );
    changes.push({
      id: t.id,
      label: t.merchantName || t.merchant || t.label,
      date: t.date,
      amount: t.amount,
      ruleId: rule.id,
      ruleName: rule.name,
      before: {
        category: t.category,
        subcategory: t.subcategory,
        categoryId: t.categoryId,
        subcategoryId: t.subcategoryId,
      },
      after: {
        category: rule.category.trim(),
        subcategory: rule.subcategory?.trim() || undefined,
        categoryId: category?.id,
        subcategoryId: subcategory?.id,
      },
      revision: transactionRevision(t),
    });
  }
  return {
    changes,
    protectedCount,
    unmatched,
    revision: rulesRevision(rules),
    definitionRevision: JSON.stringify(definitions),
  };
}
export async function applyCategoryPreview(
  database: WealthDatabase,
  preview: ReturnType<typeof previewCategoryRules>,
) {
  await database.transaction(
    "rw",
    database.transactions,
    database.preferences,
    async () => {
      const preferences = await database.preferences.get("main");
      if (
        JSON.stringify(preferences?.categoryDefinitions ?? []) !==
        preview.definitionRevision
      )
        throw new Error(
          "L’arborescence a changé. Refaire l’aperçu avant application.",
        );
      if (
        rulesRevision(
          (await database.preferences.get("main"))?.categoryRules ?? [],
        ) !== preview.revision
      )
        throw new Error(
          "Les règles ont changé. Refaire l’aperçu avant application.",
        );
      for (const c of preview.changes) {
        const latest = await database.transactions.get(c.id);
        if (!latest || transactionRevision(latest) !== c.revision)
          throw new Error(
            "Une opération a changé. Rien n’a été appliqué ; refaites l’aperçu.",
          );
      }
      for (const c of preview.changes)
        await database.transactions.update(c.id, c.after);
    },
  );
  return preview.changes;
}
export async function undoCategoryChanges(
  database: WealthDatabase,
  changes: CategoryChange[],
) {
  await database.transaction("rw", database.transactions, async () => {
    for (const c of changes) {
      const latest = await database.transactions.get(c.id);
      if (
        !latest ||
        latest.category !== c.after.category ||
        latest.subcategory !== c.after.subcategory ||
        latest.categoryId !== c.after.categoryId ||
        latest.subcategoryId !== c.after.subcategoryId ||
        latest.reviewed
      )
        throw new Error(
          "Une classification a changé ou a été vérifiée depuis. Annulation bloquée pour préserver cette correction.",
        );
    }
    for (const c of changes) await database.transactions.update(c.id, c.before);
  });
}
