import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';

// Create a test database that mirrors our schema
class TestWealthPilotDB extends Dexie {
  transactions!: Dexie.Table<Record<string, unknown>, number>;
  accounts!: Dexie.Table<Record<string, unknown>, number>;
  budgets!: Dexie.Table<Record<string, unknown>, number>;
  goals!: Dexie.Table<Record<string, unknown>, number>;
  settings!: Dexie.Table<Record<string, unknown>, number>;

  constructor() {
    super('TestWealthPilotDB');
    
    this.version(1).stores({
      transactions: '++id, date, category, accountId',
      accounts: '++id, name, type, isActive',
      budgets: '++id, category, year',
      goals: '++id, name, isActive',
      settings: '++id, key'
    });
  }
}

describe('Database Operations', () => {
  let db: TestWealthPilotDB;

  beforeEach(async () => {
    db = new TestWealthPilotDB();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('Accounts', () => {
    it('should create and retrieve an account', async () => {
      const now = new Date().toISOString();
      const accountId = await db.accounts.add({
        name: 'Test Account',
        type: 'checking',
        balance: 1000,
        currency: 'EUR',
        institution: 'Test Bank',
        color: '#3b82f6',
        isActive: true,
        initialBalance: 1000,
        initialBalanceDate: now,
        createdAt: now,
        updatedAt: now,
      });

      const account = await db.accounts.get(accountId);
      expect(account).toBeDefined();
      expect(account?.name).toBe('Test Account');
      expect(account?.balance).toBe(1000);
      expect(account?.type).toBe('checking');
    });

    it('should list all active accounts', async () => {
      const now = new Date().toISOString();
      
      await db.accounts.bulkAdd([
        { name: 'Account 1', type: 'checking', isActive: true, createdAt: now, updatedAt: now },
        { name: 'Account 2', type: 'savings', isActive: true, createdAt: now, updatedAt: now },
        { name: 'Account 3', type: 'credit', isActive: false, createdAt: now, updatedAt: now },
      ]);

      const activeAccounts = await db.accounts.filter(a => a.isActive === true).toArray();
      expect(activeAccounts).toHaveLength(2);
    });
  });

  describe('Transactions', () => {
    it('should create and retrieve a transaction', async () => {
      const now = new Date().toISOString();
      const txId = await db.transactions.add({
        date: '2026-01-22',
        valueDate: '2026-01-22',
        direction: 'debit',
        amount: 50.00,
        balanceAfter: 950.00,
        category: 'Food & Dining',
        subcategory: 'Restaurants',
        merchant: 'Test Restaurant',
        merchantOriginal: 'TEST RESTAURANT',
        paymentMethod: 'Card',
        description: 'Lunch',
        isRecurring: false,
        accountId: 1,
        createdAt: now,
        updatedAt: now,
      });

      const tx = await db.transactions.get(txId);
      expect(tx).toBeDefined();
      expect(tx?.amount).toBe(50.00);
      expect(tx?.category).toBe('Food & Dining');
    });

    it('should filter transactions by date range', async () => {
      const now = new Date().toISOString();
      
      await db.transactions.bulkAdd([
        { date: '2026-01-15', direction: 'debit', amount: 100, accountId: 1, createdAt: now, updatedAt: now },
        { date: '2026-01-20', direction: 'debit', amount: 200, accountId: 1, createdAt: now, updatedAt: now },
        { date: '2026-01-25', direction: 'debit', amount: 300, accountId: 1, createdAt: now, updatedAt: now },
      ]);

      const txs = await db.transactions
        .where('date')
        .between('2026-01-18', '2026-01-28', true, true)
        .toArray();
      
      expect(txs).toHaveLength(2);
      expect(txs.map(t => t.amount).sort()).toEqual([200, 300]);
    });
  });

  describe('Goals', () => {
    it('should create and update a goal', async () => {
      const now = new Date().toISOString();
      const goalId = await db.goals.add({
        name: 'Emergency Fund',
        targetAmount: 5000,
        currentAmount: 1000,
        icon: 'shield',
        color: '#10b981',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await db.goals.update(goalId, { currentAmount: 1500 });
      
      const goal = await db.goals.get(goalId);
      expect(goal?.currentAmount).toBe(1500);
    });
  });

  describe('Settings', () => {
    it('should store and retrieve settings', async () => {
      await db.settings.add({
        key: 'budgetRule',
        value: '50-30-20'
      });

      const setting = await db.settings.where('key').equals('budgetRule').first();
      expect(setting?.value).toBe('50-30-20');
    });
  });

  describe('Database initialization', () => {
    it('should open database without errors', async () => {
      expect(db.isOpen()).toBe(true);
    });

    it('should handle concurrent reads', async () => {
      const now = new Date().toISOString();
      await db.accounts.add({
        name: 'Main',
        type: 'checking',
        balance: 1000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      // Simulate concurrent reads
      const [accounts1, accounts2, accounts3] = await Promise.all([
        db.accounts.toArray(),
        db.accounts.toArray(),
        db.accounts.toArray(),
      ]);

      expect(accounts1).toHaveLength(1);
      expect(accounts2).toHaveLength(1);
      expect(accounts3).toHaveLength(1);
    });
  });
});
