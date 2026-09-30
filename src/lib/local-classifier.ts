import { CATEGORIES, type Transaction } from './db';
import {
  applyLocalSuggestion,
  isValidCategoryPair,
  normalizeClassificationText,
  type LocalClassificationSuggestion,
} from './classification';

export const LOCAL_AI_ENDPOINT = 'http://127.0.0.1:8080';

type LocalModelResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function ensureLoopbackEndpoint(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Le classifieur doit être un service HTTP local (127.0.0.1 ou localhost).');
  }
  return url.origin;
}

function allowedPairs(): Array<{ category: string; subcategory: string }> {
  return Object.entries(CATEGORIES).flatMap(([category, definition]) =>
    definition.subcategories.map((subcategory) => ({ category, subcategory }))
  );
}

export function parseLocalSuggestion(content: string): LocalClassificationSuggestion | null {
  const candidates = [content.trim()];
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) candidates.push(fenced.trim());
  const objectStart = content.lastIndexOf('{');
  const objectEnd = content.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(content.slice(objectStart, objectEnd + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<LocalClassificationSuggestion>;
      if (
        typeof parsed.category === 'string' &&
        typeof parsed.subcategory === 'string' &&
        typeof parsed.confidence === 'number' &&
        typeof parsed.reason === 'string' &&
        isValidCategoryPair(parsed.category, parsed.subcategory)
      ) {
        return {
          category: parsed.category,
          subcategory: parsed.subcategory,
          confidence: parsed.confidence,
          reason: parsed.reason,
        };
      }
    } catch {
      // A local model may emit analysis before its JSON. Try the next extraction.
    }
  }
  return null;
}

function promptFor(transaction: Partial<Transaction>): string {
  const pairs = JSON.stringify(allowedPairs());
  const merchant = normalizeClassificationText(transaction.merchant || '').slice(0, 80);
  const description = normalizeClassificationText(transaction.description || '').slice(0, 180);
  return [
    `Couples autorisés: ${pairs}.`,
    'Choisis exactement un couple et recopie ses deux libellés sans les modifier.',
    `Transaction: direction=${transaction.direction}; merchant=${merchant}; description=${description}.`,
    'Réponds avec category, subcategory, confidence (0 à 1) et reason (courte, en français).',
  ].join(' ');
}

export async function checkLocalClassifier(endpoint = LOCAL_AI_ENDPOINT): Promise<boolean> {
  const origin = ensureLoopbackEndpoint(endpoint);
  const response = await fetch(`${origin}/v1/models`, { signal: AbortSignal.timeout(2500) });
  return response.ok;
}

export async function classifyWithLocalModel(
  transaction: Partial<Transaction>,
  options: { endpoint?: string; timeoutMs?: number } = {}
): Promise<Partial<Transaction>> {
  if (transaction.classificationSource !== 'fallback') return transaction;
  const origin = ensureLoopbackEndpoint(options.endpoint || LOCAL_AI_ENDPOINT);
  const response = await fetch(`${origin}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(options.timeoutMs || 30_000),
    body: JSON.stringify({
      temperature: 0,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: 'Tu classes des transactions bancaires françaises. Réponds uniquement par un objet JSON valide, sans markdown ni analyse.',
        },
        { role: 'user', content: promptFor(transaction) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Le classifieur local a répondu ${response.status}.`);
  const payload = await response.json() as LocalModelResponse;
  const content = payload.choices?.[0]?.message?.content || '';
  const suggestion = parseLocalSuggestion(content);
  return suggestion ? applyLocalSuggestion(transaction, suggestion) : transaction;
}

/** Sequential by design: avoids memory spikes on small Macs and leaves the UI cancellable. */
export async function classifyAmbiguousTransactions(
  transactions: Partial<Transaction>[],
  onProgress?: (done: number, total: number) => void
): Promise<Partial<Transaction>[]> {
  const output = [...transactions];
  const indexes = output
    .map((transaction, index) => transaction.classificationSource === 'fallback' ? index : -1)
    .filter((index) => index >= 0);

  for (let position = 0; position < indexes.length; position += 1) {
    const index = indexes[position];
    output[index] = await classifyWithLocalModel(output[index]);
    onProgress?.(position + 1, indexes.length);
  }
  return output;
}
