import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, type Account } from '../db';
import {
  importCSV,
  parseBankCSV,
  parseBankStatementMetadata,
  undoCSVImport,
} from '../csv-importer';
import { toCents } from '../money';
import { buildMonthlyFinancialHistory, summarizeFinancialHistory } from '../monthly-analysis';

const FIXTURE = `00000000001;01/09/2026;30/09/2026;3;30/09/2026;50.00 EUR

Date de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise
25/09/2026;PRELEVEMENT EUROPE;PRELEVEMENT EUROPEEN POUR CPTE DE:DGFIP IMPOT;-100,00;EUR
25/09/2026;VIR RECU;VIR RECU DE: DIGITAL CLASSIFIEDS FRANCE MOTIF: SALAIRE;200,00;EUR
30/09/2026;CARTE;CARTE SUPERMARCHE;-50,00;EUR`;

async function createAccount(name: string): Promise<number> {
  const now = new Date().toISOString();
  return db.accounts.add({
    name,
    type: 'checking',
    balance: 0,
    currency: 'EUR',
    institution: 'SG',
    color: '#000000',
    isActive: true,
    initialBalance: 0,
    initialBalanceDate: '2026-09-01',
    createdAt: now,
    updatedAt: now,
  } satisfies Omit<Account, 'id'>);
}

describe('SG bank import and reconciliation', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('parses SG statement metadata and direction-sensitive DGFIP', () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(-1.005)).toBe(-101);
    expect(parseBankStatementMetadata(FIXTURE)).toMatchObject({
      accountNumber: '00000000001',
      transactionCount: 3,
      closingDate: '2026-09-30',
      closingBalance: 50,
      currency: 'EUR',
    });

    const transactions = parseBankCSV(FIXTURE);
    expect(transactions).toHaveLength(3);
    expect(transactions[0]).toMatchObject({
      direction: 'debit',
      category: 'Taxes',
      subcategory: 'Income Tax',
      merchant: 'Tax Payment',
    });
  });

  it('keeps salary, transfers, refunds, and tax refunds economically distinct', () => {
    const csv = `Date de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise
01/09/2026;VIR RECU;VIR RECU DE: DIGITAL CLASSIFIEDS FRANCE MOTIF: SALAIRE;3690,24;EUR
02/09/2026;VIR RECU;VIR RECU DE: UN PROCHE;150,00;EUR
03/09/2026;REMBT;REMBOURSEMENT HENNER;42,20;EUR
04/09/2026;VIR RECU;VIR RECU DE: DGFIP REMBOURSEMENT;20,00;EUR`;

    expect(parseBankCSV(csv).map(tx => [tx.category, tx.subcategory])).toEqual([
      ['Income', 'Salary'],
      ['Transfers', 'From Others'],
      ['Income', 'Refunds'],
      ['Income', 'Refunds'],
    ]);
  });

  it('creates a closing checkpoint, reconciles exactly, and imports twice idempotently', async () => {
    const accountId = await createAccount('Fixture');

    const first = await importCSV(FIXTURE, accountId);
    expect(first.errors, first.errorDetails.join('\n')).toBe(0);
    expect(first).toMatchObject({
      imported: 3,
      duplicates: 0,
      errors: 0,
      reconciliation: {
        expectedBalance: 50,
        calculatedBalance: 50,
        difference: 0,
        isReconciled: true,
      },
    });
    expect(await db.balanceCheckpoints.where('accountId').equals(accountId).count()).toBe(1);
    expect((await db.accounts.get(accountId))?.balance).toBe(50);

    const second = await importCSV(FIXTURE, accountId);
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(3);
    expect(second.reconciliation).toMatchObject({ difference: 0, isReconciled: true });
    expect(await db.transactions.where('accountId').equals(accountId).count()).toBe(3);
    expect(await db.balanceCheckpoints.where('accountId').equals(accountId).count()).toBe(1);
  });

  it('deduplicates identical rows within a single file', async () => {
    const accountId = await createAccount('Duplicates');
    const csv = `date,direction,amount,category,subcategory,merchant,description
2026-09-01,debit,10,Food,Groceries,Shop,Same row
2026-09-01,debit,10,Food,Groceries,Shop,Same row`;

    const result = await importCSV(csv, accountId);
    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(await db.transactions.where('accountId').equals(accountId).count()).toBe(1);
  });

  it('annule atomiquement un import et son checkpoint nouvellement créé', async () => {
    const accountId = await createAccount('Undo');
    const result = await importCSV(FIXTURE, accountId);
    await undoCSVImport(result);
    expect(await db.transactions.where('accountId').equals(accountId).count()).toBe(0);
    expect(await db.balanceCheckpoints.where('accountId').equals(accountId).count()).toBe(0);
    expect((await db.accounts.get(accountId))?.balance).toBe(0);
  });

  it('rejects a truncated SG export before writing anything', async () => {
    const accountId = await createAccount('Incomplete');
    const incomplete = FIXTURE.replace(';3;30/09/2026;', ';4;30/09/2026;');

    await expect(importCSV(incomplete, accountId)).rejects.toThrow('Incomplete SG export');
    expect(await db.transactions.where('accountId').equals(accountId).count()).toBe(0);
    expect(await db.balanceCheckpoints.where('accountId').equals(accountId).count()).toBe(0);
  });
});

const downloads = join(homedir(), 'Downloads');
const realCsvPaths = [
  join(downloads, '00050059006.csv'),
  join(downloads, '00050024034-3.csv'),
];

describe.skipIf(!realCsvPaths.every(existsSync))('local SG regression files', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('reconciles Anthonny and Mirane independently and as a household', async () => {
    const [anthonnyId, miraneId] = await Promise.all([
      createAccount('Anthonny'),
      createAccount('Mirane'),
    ]);
    const [anthonny, mirane] = await Promise.all([
      importCSV(readFileSync(realCsvPaths[0], 'latin1'), anthonnyId),
      importCSV(readFileSync(realCsvPaths[1], 'latin1'), miraneId),
    ]);

    expect(anthonny.imported).toBe(500);
    expect(anthonny.reconciliation).toMatchObject({ calculatedBalance: 1774.47, difference: 0 });
    expect(mirane.imported).toBe(238);
    expect(mirane.reconciliation).toMatchObject({ calculatedBalance: -253.36, difference: 0 });

    const accounts = await db.accounts.toArray();
    expect(accounts.reduce((sum, account) => sum + Math.round(account.balance * 100), 0)).toBe(152111);
    expect((await db.accounts.get(anthonnyId))?.initialBalance).toBe(-490.15);
    expect((await db.accounts.get(miraneId))?.initialBalance).toBe(-338.36);

    const dgfip = await db.transactions
      .where('accountId')
      .equals(anthonnyId)
      .filter(tx => tx.amount === 854)
      .first();
    expect(dgfip).toMatchObject({
      direction: 'debit',
      category: 'Taxes',
      subcategory: 'Income Tax',
    });

    const householdHistory = buildMonthlyFinancialHistory(
      await db.transactions.toArray(),
      new Date(2026, 0, 1),
      new Date(2026, 8, 30),
      undefined,
      new Date(2026, 8, 29)
    );
    const householdSummary = summarizeFinancialHistory(householdHistory);
    expect(householdHistory.find(month => month.month === '2026-09')?.income).toBeCloseTo(4401.27, 2);
    expect(householdHistory.filter(month => month.salary > 0).map(month => month.salary)).toEqual([
      3748.76,
      4269.51,
      5689.38,
      3847.16,
      3690.24,
    ]);
    expect(householdSummary.medianSalary).toBe(3847.16);
    expect(householdSummary.salaryVariance).toBe(-156.92);

    const [anthonnyAgain, miraneAgain] = await Promise.all([
      importCSV(readFileSync(realCsvPaths[0], 'latin1'), anthonnyId),
      importCSV(readFileSync(realCsvPaths[1], 'latin1'), miraneId),
    ]);
    expect(anthonnyAgain).toMatchObject({ imported: 0, duplicates: 500 });
    expect(miraneAgain).toMatchObject({ imported: 0, duplicates: 238 });
  });
});
