import type { Transaction } from "./types";
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const merchantLabel = (t: Transaction) =>
  t.merchantName || t.merchant || t.label;
export function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    previous = current;
  }
  return previous[b.length];
}
function matchToken(q: string, token: string): number {
  if (token === q) return 100;
  if (token.startsWith(q)) return 90;
  if (q.length < 3) return 0;
  if (token.includes(q)) return 80;
  if (
    q.length >= 4 &&
    Math.abs(token.length - q.length) <= 2 &&
    distance(q, token) <= (q.length > 6 ? 2 : 1)
  )
    return 65;
  // Abbreviations retain letter order: mcdo → macdonalds, bnp → BNP Paribas.
  if (q.length >= 4 && token[0] === q[0] && token.length <= q.length * 2.5) {
    let at = 0;
    for (const c of token) if (c === q[at]) at++;
    if (at === q.length) return 55;
  }
  return 0;
}
const searchIndex = new WeakMap<
  Transaction,
  { source: string; tokens: string[] }
>();
export function searchScore(t: Transaction, query: string): number {
  const terms = normalize(query).split(" ").filter(Boolean);
  if (!terms.length) return 1;
  const source = [
    merchantLabel(t),
    t.merchant,
    t.label,
    t.category,
    t.subcategory,
    t.account,
    t.note,
  ]
    .filter(Boolean)
    .join(" ");
  let indexed = searchIndex.get(t);
  if (!indexed || indexed.source !== source) {
    indexed = { source, tokens: [...new Set(normalize(source).split(" "))] };
    searchIndex.set(t, indexed);
  }
  const tokens = indexed.tokens;
  let score = 0;
  for (const term of terms) {
    const best = Math.max(...tokens.map((token) => matchToken(term, token)));
    if (!best) return 0;
    score += best;
  }
  return score;
}
