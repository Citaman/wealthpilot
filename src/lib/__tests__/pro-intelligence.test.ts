import { describe, it, expect } from 'vitest';
import { detectAnomalies, calculateAdvancedHealthMetrics } from '../analytics';
import { Transaction } from '../db';

describe('Analytics Intelligence', () => {
  const history: Transaction[] = [
    { id: 1, merchant: 'Amazon', amount: -50, date: '2025-01-01', direction: 'debit', category: 'Shopping', subcategory: '', createdAt: '', updatedAt: '' },
    { id: 2, merchant: 'Amazon', amount: -55, date: '2025-02-01', direction: 'debit', category: 'Shopping', subcategory: '', createdAt: '', updatedAt: '' },
    { id: 3, merchant: 'Amazon', amount: -48, date: '2025-03-01', direction: 'debit', category: 'Shopping', subcategory: '', createdAt: '', updatedAt: '' },
  ];

  it('detects a spending spike as an anomaly', () => {
    const current: Transaction[] = [
      { id: 4, merchant: 'Amazon', amount: -250, date: '2025-04-01', direction: 'debit', category: 'Shopping', subcategory: '', createdAt: '', updatedAt: '' }
    ];
    
    const anomalies = detectAnomalies(current, history);
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].transaction.merchant).toBe('Amazon');
    expect(anomalies[0].deviation).toBeGreaterThan(3); // Significant spike
  });

  it('ignores normal spending', () => {
    const current: Transaction[] = [
      { id: 4, merchant: 'Amazon', amount: -52, date: '2025-04-01', direction: 'debit', category: 'Shopping', subcategory: '', createdAt: '', updatedAt: '' }
    ];
    
    const anomalies = detectAnomalies(current, history);
    expect(anomalies.length).toBe(0);
  });

  it('calculates correct Health Metrics', () => {
    const accounts = [
      { id: 1, type: 'checking', balance: 1000 },
      { id: 2, type: 'credit', balance: -500 }
    ];
    const transactions: Transaction[] = [
      { id: 1, amount: 3000, date: '2025-01-01', direction: 'credit', category: 'Income', subcategory: '', createdAt: '', updatedAt: '' },
      { id: 2, amount: 3000, date: '2025-02-01', direction: 'credit', category: 'Income', subcategory: '', createdAt: '', updatedAt: '' },
      { id: 3, amount: 3000, date: '2025-03-01', direction: 'credit', category: 'Income', subcategory: '', createdAt: '', updatedAt: '' },
    ];

    const referenceDate = new Date('2025-03-15');
    const metrics = calculateAdvancedHealthMetrics(transactions, accounts, transactions, referenceDate);
    
    // DTI = 500 (debt) / 3000 (avg income) * 100 = 16.66%
    expect(metrics.debtToIncomeRatio).toBeCloseTo(16.66, 1);
    expect(metrics.totalDebt).toBe(500);
  });
});
