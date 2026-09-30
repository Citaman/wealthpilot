import { CATEGORIES, type Transaction } from './db';
import { applyMerchantRules, extractMerchantFromDescription } from './migration';

export type ClassificationSource = NonNullable<Transaction['classificationSource']>;

export interface ClassificationDecision {
  category: string;
  subcategory: string;
  merchant: string;
  isRecurring: boolean;
  source: ClassificationSource;
  confidence: number;
  reason: string;
}

export interface LocalClassificationSuggestion {
  category: string;
  subcategory: string;
  confidence: number;
  reason: string;
}

const GENERIC_MERCHANTS = new Set(['UNKNOWN', 'CARTE', 'PAIEMENT', 'PRELEVEMENT', 'DIRECT DEBIT']);

export function normalizeClassificationText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(?:CARTE\s*X?\d+|CB|PAIEMENT|PRELEVEMENT\s+EUROPEEN)\b/gi, ' ')
    .replace(/\b\d{2}[/.]\d{2}(?:[/.]\d{2,4})?\b/g, ' ')
    .replace(/[^A-Z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function classificationKey(transaction: Pick<Partial<Transaction>, 'date' | 'direction' | 'amount' | 'description' | 'merchant'>): string {
  return [
    transaction.date || '',
    transaction.direction || '',
    Math.round(Math.abs(transaction.amount || 0) * 100),
    normalizeClassificationText(transaction.description || transaction.merchant || ''),
  ].join('|');
}

export function isValidCategoryPair(category: string, subcategory: string): boolean {
  return Boolean(CATEGORIES[category]?.subcategories.includes(subcategory));
}

export function classifyDeterministically(
  description: string,
  direction: 'debit' | 'credit',
  merchantHint = ''
): ClassificationDecision {
  const match = applyMerchantRules(`${merchantHint} ${description}`.trim(), direction);
  if (match) {
    return {
      ...match,
      source: 'rule',
      confidence: 0.98,
      reason: 'Règle locale explicite correspondant au libellé bancaire.',
    };
  }

  const extracted = extractMerchantFromDescription(merchantHint || description);
  return {
    category: direction === 'credit' ? 'Transfers' : 'Services',
    subcategory: direction === 'credit' ? 'From Others' : 'Other',
    merchant: GENERIC_MERCHANTS.has(normalizeClassificationText(extracted)) ? 'Inconnu' : extracted,
    isRecurring: false,
    source: 'fallback',
    confidence: 0.25,
    reason: 'Aucune règle suffisamment précise : vérification recommandée.',
  };
}

function merchantLearningKey(transaction: Pick<Partial<Transaction>, 'merchant' | 'description' | 'direction'>): string {
  const merchant = normalizeClassificationText(transaction.merchant || '');
  const description = normalizeClassificationText(transaction.description || '');
  const stable = merchant && !GENERIC_MERCHANTS.has(merchant) && merchant !== 'INCONNU'
    ? merchant
    : description.split(' ').slice(0, 4).join(' ');
  return `${transaction.direction || ''}|${stable}`;
}

/**
 * Learns only from repeated, non-generic local history. A dominant category is
 * required so one bad edit cannot silently contaminate later imports.
 */
export function applyLearnedClassifications(
  incoming: Partial<Transaction>[],
  history: Transaction[]
): Partial<Transaction>[] {
  const votes = new Map<string, Map<string, { count: number; category: string; subcategory: string }>>();

  for (const transaction of history) {
    if (!isValidCategoryPair(transaction.category, transaction.subcategory)) continue;
    if (transaction.category === 'Services' && transaction.subcategory === 'Other') continue;
    const key = merchantLearningKey(transaction);
    if (key.endsWith('|')) continue;
    const pair = `${transaction.category}|${transaction.subcategory}`;
    const bucket = votes.get(key) || new Map();
    const current = bucket.get(pair) || { count: 0, category: transaction.category, subcategory: transaction.subcategory };
    current.count += transaction.classificationSource === 'manual' ? 3 : 1;
    bucket.set(pair, current);
    votes.set(key, bucket);
  }

  return incoming.map((transaction) => {
    if (transaction.classificationSource !== 'fallback') return transaction;
    const bucket = votes.get(merchantLearningKey(transaction));
    if (!bucket) return transaction;
    const ranked = [...bucket.values()].sort((a, b) => b.count - a.count);
    const total = ranked.reduce((sum, item) => sum + item.count, 0);
    const winner = ranked[0];
    const dominance = winner ? winner.count / total : 0;
    if (!winner || winner.count < 2 || dominance < 0.8) return transaction;
    return {
      ...transaction,
      category: winner.category,
      subcategory: winner.subcategory,
      classificationSource: 'learned',
      classificationConfidence: Math.min(0.95, 0.72 + winner.count * 0.04),
      classificationReason: `Historique local cohérent (${winner.count}/${total} observations pondérées).`,
    };
  });
}

export function applyLocalSuggestion(
  transaction: Partial<Transaction>,
  suggestion: LocalClassificationSuggestion
): Partial<Transaction> {
  if (transaction.classificationSource !== 'fallback') return transaction;
  if (!isValidCategoryPair(suggestion.category, suggestion.subcategory)) return transaction;
  if (!Number.isFinite(suggestion.confidence) || suggestion.confidence < 0.78 || suggestion.confidence > 1) return transaction;
  return {
    ...transaction,
    category: suggestion.category,
    subcategory: suggestion.subcategory,
    classificationSource: 'local-model',
    classificationConfidence: suggestion.confidence,
    classificationReason: suggestion.reason.slice(0, 240),
  };
}

export function classificationQuality(transactions: Partial<Transaction>[]) {
  const counts: Record<ClassificationSource, number> = {
    historical: 0,
    rule: 0,
    learned: 0,
    'local-model': 0,
    fallback: 0,
    manual: 0,
  };
  for (const transaction of transactions) counts[transaction.classificationSource || 'fallback'] += 1;
  return { counts, needsReview: counts.fallback };
}
