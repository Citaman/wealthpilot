import { describe, expect, it } from 'vitest';
import {
  applyLearnedClassifications,
  applyLocalSuggestion,
  classifyDeterministically,
  type LocalClassificationSuggestion,
} from '../classification';
import { parseLocalSuggestion } from '../local-classifier';
import type { Transaction } from '../db';

const history = (overrides: Partial<Transaction>): Transaction => ({
  id: 1,
  date: '2026-09-01',
  valueDate: '2026-09-01',
  direction: 'debit',
  amount: 10,
  balanceAfter: 0,
  category: 'Food',
  subcategory: 'Groceries',
  merchant: 'Épicerie Atlas',
  merchantOriginal: 'EPICERIE ATLAS',
  paymentMethod: 'card',
  description: 'CARTE EPICERIE ATLAS',
  isRecurring: false,
  accountId: 1,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  ...overrides,
});

describe('hybrid transaction classification', () => {
  it('keeps explicit local rules ahead of any model', () => {
    const decision = classifyDeterministically('CARTE MONOPRIX PARIS', 'debit');
    expect(decision).toMatchObject({ category: 'Food', subcategory: 'Groceries', source: 'rule' });
    const unchanged = applyLocalSuggestion({ ...decision, classificationSource: 'rule' }, {
      category: 'Services', subcategory: 'Other', confidence: 0.99, reason: 'wrong',
    });
    expect(unchanged.category).toBe('Food');
  });

  it('learns only from a repeated dominant local history', () => {
    const input = [{
      direction: 'debit' as const,
      merchant: 'Épicerie Atlas',
      description: 'CARTE EPICERIE ATLAS',
      category: 'Services',
      subcategory: 'Other',
      classificationSource: 'fallback' as const,
    }];
    const result = applyLearnedClassifications(input, [history({ id: 1 }), history({ id: 2 })]);
    expect(result[0]).toMatchObject({ category: 'Food', subcategory: 'Groceries', classificationSource: 'learned' });
  });

  it('rejects low-confidence and invalid local-model output', () => {
    const base = { category: 'Services', subcategory: 'Other', classificationSource: 'fallback' as const };
    const low: LocalClassificationSuggestion = { category: 'Food', subcategory: 'Groceries', confidence: 0.5, reason: 'maybe' };
    expect(applyLocalSuggestion(base, low).classificationSource).toBe('fallback');
    expect(parseLocalSuggestion('{"category":"Food","subcategory":"Not real","confidence":0.99,"reason":"x"}')).toBeNull();
  });

  it('extracts a valid final JSON object after optional model analysis', () => {
    expect(parseLocalSuggestion('analyse... {"category":"Food","subcategory":"Groceries","confidence":0.91,"reason":"supermarché"}'))
      .toMatchObject({ category: 'Food', subcategory: 'Groceries', confidence: 0.91 });
  });
});
