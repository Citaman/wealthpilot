import { describe, it, expect } from 'vitest';
import './domain.js';

const domain = globalThis.WealthDomain;
const context = { scope: 'all', start: '2026-09-01', end: '2026-09-30', granularity: 'day' };

describe('Clean finance workspace', () => {
  it('preserves source labels, categories, internal transfers and distinct bank identifiers', () => {
    const mapping = { date: 'date', merchant: 'merchant', amount: 'amount', direction: 'direction', category: 'category', bankLabel: 'label', bankDetail: 'detail', internal: 'internal', shared: 'shared', sourceId: 'id' };
    const source = { date: '2026-09-15', merchant: 'Loisir', amount: '-12,50', direction: 'expense', category: 'Entertainment', label: 'CARTE ORIGINAL', detail: 'DETAIL ORIGINAL', internal: 'N', shared: 'Oui', id: 'source-1' };
    const result = domain.normalizeRows([source, { ...source, id: 'source-2' }, { ...source, id: 'source-3', internal: 'Y' }], mapping, 'a');
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ amount: -1250, bankLabel: 'CARTE ORIGINAL', bankDetail: 'DETAIL ORIGINAL', category: 'Loisirs', sourceCategory: 'Entertainment', shared: true, splitMode: 'auto' });
    expect(result.rows[2].kind).toBe('transfer');
    expect(domain.fingerprint(result.rows[0])).not.toBe(domain.fingerprint(result.rows[1]));
    expect(domain.fingerprint(result.rows[0])).toBe(domain.fingerprint({ ...result.rows[0], id: 'different-local-id' }));
  });
  it('validates the demonstration data and computes consistent balances', () => {
    const state = domain.validateState(domain.demo());
    const previous = domain.balance(state, 'all', '2026-08-31');
    const result = domain.metrics(state, context);
    expect(result.balance).toBe(previous + result.net);
    expect(result.series).toHaveLength(30);
    expect(result.series.at(-1).balance).toBe(result.balance);
  });
  it('changes periods and aggregates by month, week and quarter', () => {
    expect(domain.range('six', '2026-09-30')).toEqual({ start: '2026-04-01', end: '2026-09-30' });
    expect(domain.bucket('2026-09-30', 'week')).toBe('2026-09-28');
    expect(domain.bucket('2026-09-30', 'quarter')).toBe('2026-07-01');
    const result = domain.metrics(domain.demo(), { ...context, start: '2026-04-01', granularity: 'month' });
    expect(result.series).toHaveLength(6);
    expect(result.income).toBe(510000 * 6);
  });
  it('keeps calendar month boundaries when moving between months', () => {
    expect(domain.shiftPeriod({ start: '2026-09-01', end: '2026-09-30' }, 1)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(domain.shiftPeriod({ start: '2026-09-01', end: '2026-09-30' }, -1)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  });
  it('does not invent balances before an anchor or after known coverage', () => {
    const state = domain.demo();
    expect(domain.balance(state, 'a', '2026-02-28')).toBeNull();
    const result = domain.metrics(state, { ...context, end: '2026-10-02' });
    expect(result.series.at(-1).balance).toBeNull();
    expect(result.through).toBe('2026-09-30');
  });
  it('excludes pending and transfers from consumption, but includes transfers in cash', () => {
    const state = domain.demo(), before = domain.metrics(state, context);
    state.transactions.push({ ...state.transactions[0], id: 'pending', date: '2026-09-15', amount: -9900, status: 'pending', kind: 'expense' });
    expect(domain.metrics(state, context).expenses).toBe(before.expenses);
    expect(domain.metrics(state, context).balance).toBe(before.balance);
    expect(domain.selectedRows(state, context).filter(row => row.kind === 'transfer')).toHaveLength(4);
  });
  it('keeps negative budget remaining and prorates partial periods', () => {
    const state = domain.demo(); state.budgets.Logement = 1000;
    expect(domain.budgets(state, context).find(item => item.category === 'Logement').remaining).toBeLessThan(0);
    expect(domain.budgets(state, { ...context, end: '2026-09-15' }).find(item => item.category === 'Logement').limit).toBe(500);
  });
  it('preserves expense and sharing totals down to the cent', () => {
    const result = domain.sharing(domain.demo(), context);
    expect(result.paidA + result.paidB).toBe(result.shareA + result.shareB);
    expect(result.owedToA).toBe(result.paidA - result.shareA);
    expect(result.paidJoint).toBeGreaterThan(0);
  });
  it('derives common expenses from incomes and preserves individual overrides', () => {
    const state = domain.demo(), rent = state.transactions.find(row => row.date === '2026-09-03' && row.merchant === 'Loyer');
    const initial = domain.sharing(state, context);
    expect(initial.rule.ratio).toBeCloseTo(285000 / 510000 * 100);
    expect(initial.allocations.find(item => item.row.id === rent.id).partA).toBe(Math.round(125000 * 285000 / 510000));
    rent.splitMode = 'manual'; rent.splitA = 100;
    expect(domain.sharing(state, context).allocations.find(item => item.row.id === rent.id).partA).toBe(125000);
    state.transactions.push({ ...state.transactions[0], id: 'extra-income', date: '2026-09-20', amount: 100000 });
    expect(domain.sharing(state, context).rule.ratio).toBeCloseTo(385000 / 610000 * 100);
    expect(domain.sharing(state, context).allocations.find(item => item.row.id === rent.id).partA).toBe(125000);
    expect(rent.amount).toBe(-125000);
  });
  it('settles a debt without recording another expense', () => {
    const state = domain.demo(), before = domain.sharing(state, context);
    state.transactions.push({ ...state.transactions[0], id: 'settlement', account: 'b', date: '2026-09-30', amount: -before.owedToA, kind: 'settlement' });
    expect(domain.sharing(state, context).owedToA).toBe(0);
    expect(domain.sharing(state, context).shareA).toBe(before.shareA);
  });
  it('rolls monthly occurrences without drifting from month end', () => {
    const state = domain.demo(); state.recurring = [{ ...state.recurring[0], nextDate: '2026-01-31' }];
    expect(domain.occurrences(state, '2026-01-01', '2026-03-31').map(item => item.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('detects recurring expenses only from observed CSV rows and review metadata', () => {
    const state = domain.demo();
    expect(domain.detectRecurring(state, '2026-09-30').find(item => item.name === 'Spotify')).toMatchObject({ frequency: 'monthly', nextDate: '2026-10-08', confidence: 'observed', amount: 1099 });
    expect(domain.detectRecurring(state, '2026-09-30').some(item => item.name.includes('Salaire'))).toBe(false);
    state.transactions.find(row => row.merchant === 'Spotify').recurrence = 'exclude';
    expect(domain.detectRecurring(state, '2026-09-30').some(item => item.name === 'Spotify')).toBe(false);
    state.transactions = [{ ...domain.demo().transactions[0], id: 'one-off', date: '2026-09-10', merchant: 'Assurance', amount: -5000, kind: 'expense', recurrence: 'include', recurrenceFrequency: 'yearly' }];
    expect(domain.detectRecurring(state, '2026-09-30')[0]).toMatchObject({ frequency: 'yearly', nextDate: '2027-09-10', confidence: 'reviewed' });
    expect(state.transactions).toHaveLength(1);
  });
  it('counts all spending against a monthly global budget without double counting envelopes', () => {
    const state = domain.demo(); state.monthlyBudget = 300000;
    const full = domain.budgetSummary(state, context), half = domain.budgetSummary(state, { ...context, end: '2026-09-15' });
    expect(full.limit).toBe(300000); expect(half.limit).toBe(150000);
    expect(full.spent).toBe(domain.metrics(state, context).expenses);
    expect(full.remaining).toBe(300000 - full.spent);
    expect(full.envelopes.length).toBeGreaterThan(0);
  });
  it('parses French amounts, explicit directions and source labels', () => {
    const result = domain.normalizeRows([{ date: '30/09/2026', detail: 'Salaire', amount: '1 234,56', direction: 'income' }, { date: '2026-09-30', detail: 'Course', amount: '12,34', direction: 'expense' }], { date: 'date', merchant: 'detail', amount: 'amount', direction: 'direction' }, 'a');
    expect(result.errors).toHaveLength(0);
    expect(result.rows.map(row => row.amount)).toEqual([123456, -1234]);
    expect(result.rows[0].bankLabel).toBe('Salaire');
    expect(() => domain.csvDate('31/02/2026')).toThrow();
    expect(() => domain.parseAmount('12x')).toThrow();
  });
  it('reports reconciliation differences without resetting the anchor', () => {
    const state = domain.demo(); state.accounts[0].opening = 10000; state.transactions = [];
    const row = { ...domain.demo().transactions[0], account: 'a', date: '2026-09-30', amount: -90000, status: 'posted' };
    const result = domain.reconciliation(state, 'a', [row], '2026-09-30', 9000);
    expect(result).toEqual({ expected: -80000, observed: 9000, difference: 89000 });
    expect(state.accounts[0].opening).toBe(10000);
  });
  it('rejects corrupted or incompatible backups', () => {
    const state = domain.demo(); state.transactions[0].amount = NaN;
    expect(() => domain.validateState(state)).toThrow();
    expect(() => domain.validateState({ schema: 999 })).toThrow();
    const annotated = domain.demo(); annotated.transactions[0].recurrenceFrequency = 'daily';
    expect(() => domain.validateState(annotated)).toThrow('Annotation invalide');
    expect(() => domain.days('2026-10-01', '2026-09-30')).toThrow();
  });
});