// CSV Import system with smart duplicate detection and merchant mapping
import Papa from 'papaparse';
import { db, Transaction } from './db';
import type { BalanceCheckpoint } from './db';
import { logger } from '@/lib/logger';
import { fromCents, roundMoney, toCents } from './money';
import { getBalanceAtDate, recalculateBalances } from './balance';
import {
  applyLearnedClassifications,
  applyLocalSuggestion,
  classificationKey,
  classifyDeterministically,
  type LocalClassificationSuggestion,
} from './classification';
import { 
  applyMerchantRules, 
  simplifyCategory, 
  areLikelyDuplicates, 
  extractMerchantFromDescription
} from './migration';

// Historical CSV format columns
interface HistoricalCSVRow {
  date: string;
  value_date?: string;
  direction: string;
  amount: string;
  category: string;
  subcategory: string;
  merchant: string;
  description: string;
  balance_after?: string;
  is_recurring?: string;
  category_confidence?: string;
  category_rule?: string;
  original_category?: string;
  original_subcategory?: string;
}

// Import result
export interface ImportResult {
  accountId: number;
  imported: number;
  duplicates: number;
  errors: number;
  transactionIds: number[];
  duplicateDetails: Array<{
    newTx: Partial<Transaction>;
    existingTx?: Transaction;
    confidence: number;
    reason: string;
  }>;
  errorDetails: string[];
  statement: BankStatementMetadata | null;
  reconciliation: ReconciliationResult | null;
  previousCheckpoint?: BalanceCheckpoint;
  createdCheckpointId?: number;
}

export interface BankStatementMetadata {
  accountNumber: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
  closingDate: string;
  closingBalance: number;
  currency: string;
}

export interface ReconciliationResult {
  expectedBalance: number;
  calculatedBalance: number;
  difference: number;
  isReconciled: boolean;
  checkpointId: number;
}

// Duplicate check result
export interface DuplicateCheck {
  transaction: Partial<Transaction>;
  isDuplicate: boolean;
  confidence: number;
  existingTransaction?: Transaction;
  reason: string;
}

function transactionFingerprint(tx: Partial<Transaction>): string {
  const description = (tx.description || tx.merchant || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return `${tx.date}|${tx.direction}|${toCents(tx.amount || 0)}|${description}`;
}

/**
 * Detect CSV format from content
 */
export function detectCSVFormat(content: string): 'historical' | 'bank' | 'unknown' {
  const firstLines = content.split('\n').slice(0, 5).join('\n').toLowerCase();
  
  if (firstLines.includes('direction') && firstLines.includes('subcategory')) {
    return 'historical';
  }
  
  if (firstLines.includes('date de l\'opération') || firstLines.includes('date de l\'op')) {
    return 'bank';
  }
  
  // Check for French bank format by looking at header patterns
  if (firstLines.includes('libellé') || firstLines.includes('libell')) {
    return 'bank';
  }
  
  return 'unknown';
}

/**
 * Parse French date (DD/MM/YYYY) to ISO string
 */
function parseFrenchDate(dateStr: string): string {
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Already ISO format
  if (dateStr.includes('-')) {
    return dateStr;
  }
  return dateStr;
}

/**
 * Parse French amount string to number
 */
function parseFrenchAmount(amountStr: string): number {
  // French format: -100,50 or 100,50
  const cleaned = amountStr
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(',', '.');
  return roundMoney(parseFloat(cleaned));
}

/** Parse the SG export metadata row preceding the CSV header. */
export function parseBankStatementMetadata(content: string): BankStatementMetadata | null {
  const firstLine = content.split(/\r?\n/).find(line => line.trim().length > 0);
  if (!firstLine) return null;

  const columns = firstLine.split(';').map(value => value.trim());
  columns[0] = columns[0].replace(/^\uFEFF/, '');
  if (columns.length < 6 || !/^\d+$/.test(columns[0])) return null;

  const transactionCount = Number.parseInt(columns[3], 10);
  const balanceMatch = columns[5].match(/^([-+]?\d+(?:[.,]\d+)?)\s*([A-Z]{3})?$/i);
  if (!Number.isFinite(transactionCount) || !balanceMatch) return null;

  const closingBalance = parseFrenchAmount(balanceMatch[1]);
  if (!Number.isFinite(closingBalance)) return null;

  return {
    accountNumber: columns[0],
    periodStart: parseFrenchDate(columns[1]),
    periodEnd: parseFrenchDate(columns[2]),
    transactionCount,
    closingDate: parseFrenchDate(columns[4]),
    closingBalance,
    currency: (balanceMatch[2] || 'EUR').toUpperCase(),
  };
}

/**
 * Parse historical CSV format
 */
export function parseHistoricalCSV(content: string): Partial<Transaction>[] {
  const result = Papa.parse<HistoricalCSVRow>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  
  const transactions: Partial<Transaction>[] = [];
  
  for (const row of result.data) {
    if (!row.date || !row.amount) continue;
    
    // Apply category simplification
    const { category, subcategory } = simplifyCategory(row.category, row.subcategory);
    
    // Try to improve merchant if it's generic
    let merchant = row.merchant;
    const description = row.description || '';
    // Direction can be 'credit'/'debit' or 'in'/'out'. Resolve it before
    // categorisation because labels such as DGFIP are direction-sensitive.
    const dirLower = row.direction?.toLowerCase() || '';
    const direction = (dirLower === 'credit' || dirLower === 'in') ? 'credit' : 'debit';
    
    // Fix generic merchants
    if (!merchant || 
        merchant === 'Direct debit' || 
        merchant === 'Transfer in' ||
        merchant === 'Transfer out' ||
        merchant === 'Refund' ||
        merchant.length < 3) {
      // Try to extract from description
      const ruleMatch = applyMerchantRules(description, direction);
      if (ruleMatch) {
        merchant = ruleMatch.merchant;
      } else {
        merchant = extractMerchantFromDescription(description);
      }
    }
    
    const amount = roundMoney(parseFloat(row.amount));
    
    transactions.push({
      date: parseFrenchDate(row.date),
      amount: Math.abs(amount),
      direction,
      category,
      subcategory,
      merchant,
      description,
      isRecurring: row.is_recurring === 'true' || row.is_recurring === '1',
      classificationSource: 'historical',
      classificationConfidence: Math.max(0, Math.min(1, Number.parseFloat(row.category_confidence || '0.9') || 0.9)),
      classificationReason: row.category_rule || 'Catégorie fournie par le fichier historique.',
    });
  }
  
  return transactions;
}

/**
 * Parse bank CSV format (French SG format)
 */
export function parseBankCSV(content: string): Partial<Transaction>[] {
  // Find the header row (skip account info line)
  const lines = content.split('\n');
  let headerIndex = 0;
  
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('date de l') || lower.includes('libell')) {
      headerIndex = i;
      break;
    }
  }
  
  // Rejoin from header
  const csvContent = lines.slice(headerIndex).join('\n');
  
  const result = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => {
      // Normalize headers (handle encoding issues)
      const normalized = header.trim()
        .replace(/�/g, 'é')
        .replace('Libell\u00e9', 'Libellé')
        .replace('Libell', 'Libellé');
      return normalized;
    },
  });
  
  const transactions: Partial<Transaction>[] = [];
  
  for (const row of result.data as Record<string, string>[]) {
    const dateKey = Object.keys(row).find(k => k.includes('Date') && k.includes('op'));
    const labelKey = Object.keys(row).find(k => k.includes('Libell') || k.includes('Libel'));
    const detailKey = Object.keys(row).find(k => k.includes('tail'));
    const amountKey = Object.keys(row).find(k => k.includes('Montant'));
    
    const dateStr = dateKey ? row[dateKey] : '';
    const label = labelKey ? row[labelKey] : '';
    const detail = detailKey ? row[detailKey] : '';
    const amountStr = amountKey ? row[amountKey] : '';
    
    if (!dateStr || !amountStr) continue;
    
    const amount = parseFrenchAmount(amountStr);
    const direction = amount < 0 ? 'debit' : 'credit';
    const description = `${label} ${detail}`.trim();
    
    const decision = classifyDeterministically(description, direction, label);
    
    transactions.push({
      date: parseFrenchDate(dateStr),
      amount: Math.abs(amount),
      direction,
      category: decision.category,
      subcategory: decision.subcategory,
      merchant: decision.merchant,
      description,
      isRecurring: decision.isRecurring,
      classificationSource: decision.source,
      classificationConfidence: decision.confidence,
      classificationReason: decision.reason,
    });
  }
  
  return transactions;
}

/**
 * Check for duplicates against existing transactions
 */
export async function checkDuplicates(
  newTransactions: Partial<Transaction>[],
  accountId?: number
): Promise<DuplicateCheck[]> {
  const dates = newTransactions
    .map((transaction) => transaction.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  let existingTxs: Transaction[] = [];
  if (dates.length > 0) {
    const start = new Date(`${dates[0]}T00:00:00Z`);
    const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 1);
    end.setUTCDate(end.getUTCDate() + 1);
    existingTxs = await db.transactions
      .where('date')
      .between(start.toISOString().split('T')[0], end.toISOString().split('T')[0], true, true)
      .filter((transaction) => accountId === undefined || transaction.accountId === accountId)
      .toArray();
  }

  // Candidate lookup stays linear in the history size instead of comparing
  // every imported row with every existing transaction.
  const existingByDate = new Map<string, Transaction[]>();
  for (const transaction of existingTxs) {
    const bucket = existingByDate.get(transaction.date) || [];
    bucket.push(transaction);
    existingByDate.set(transaction.date, bucket);
  }
  
  const results: DuplicateCheck[] = [];
  const seenInFile = new Set<string>();
  
  for (const newTx of newTransactions) {
    const fingerprint = transactionFingerprint(newTx);
    if (seenInFile.has(fingerprint)) {
      results.push({
        transaction: newTx,
        isDuplicate: true,
        confidence: 1,
        reason: 'Duplicate row in the imported file',
      });
      continue;
    }
    seenInFile.add(fingerprint);

    let isDuplicate = false;
    let highestConfidence = 0;
    let matchingTx: Transaction | undefined;
    let matchReason = '';
    
    const transactionDate = new Date(`${newTx.date}T00:00:00Z`);
    const candidateDates = [-1, 0, 1].map((offset) => {
      const date = new Date(transactionDate);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().split('T')[0];
    });
    const candidates = candidateDates.flatMap((date) => existingByDate.get(date) || []);

    for (const existing of candidates) {
      if (existing.direction !== newTx.direction || toCents(existing.amount) !== toCents(newTx.amount || 0)) {
        continue;
      }
      
      const check = areLikelyDuplicates(
        { 
          date: newTx.date!, 
          amount: newTx.amount!, 
          merchant: newTx.merchant, 
          description: newTx.description 
        },
        { 
          date: existing.date, 
          amount: existing.amount, 
          merchant: existing.merchant, 
          description: existing.description 
        }
      );
      
      if (check.isDuplicate && check.confidence > highestConfidence) {
        isDuplicate = true;
        highestConfidence = check.confidence;
        matchingTx = existing;
        matchReason = check.reason;
      }
    }
    
    results.push({
      transaction: newTx,
      isDuplicate,
      confidence: highestConfidence,
      existingTransaction: matchingTx,
      reason: matchReason,
    });
  }
  
  return results;
}

/**
 * Import transactions from CSV with duplicate detection
 */
export async function importCSV(
  content: string,
  accountId: number,
  options: {
    skipDuplicates?: boolean;
    duplicateThreshold?: number; // Confidence threshold (0-1)
    classificationOverrides?: Record<string, LocalClassificationSuggestion>;
  } = {}
): Promise<ImportResult> {
  const { skipDuplicates = true, duplicateThreshold = 0.7, classificationOverrides = {} } = options;
  const statement = parseBankStatementMetadata(content);
  
  // Detect format
  const format = detectCSVFormat(content);
  
  let parsedTxs: Partial<Transaction>[];
  
  if (format === 'historical') {
    parsedTxs = parseHistoricalCSV(content);
  } else if (format === 'bank') {
    parsedTxs = parseBankCSV(content);
  } else {
    throw new Error('Unknown CSV format. Expected historical or French bank format.');
  }

  parsedTxs = applyLearnedClassifications(parsedTxs, await db.transactions.toArray())
    .map((transaction) => {
      const suggestion = classificationOverrides[classificationKey(transaction)];
      return suggestion ? applyLocalSuggestion(transaction, suggestion) : transaction;
    });

  if (statement && parsedTxs.length !== statement.transactionCount) {
    throw new Error(
      `Incomplete SG export: metadata announces ${statement.transactionCount} transactions, ` +
      `but ${parsedTxs.length} were parsed.`
    );
  }
  
  // Check for duplicates
  const duplicateChecks = await checkDuplicates(parsedTxs, accountId);
  
  const result: ImportResult = {
    accountId,
    imported: 0,
    duplicates: 0,
    errors: 0,
    transactionIds: [],
    duplicateDetails: [],
    errorDetails: [],
    statement,
    reconciliation: null,
  };

  const now = new Date().toISOString();
  const pending: Array<Omit<Transaction, 'id'>> = [];

  for (const check of duplicateChecks) {
    if (check.isDuplicate && check.confidence >= duplicateThreshold) {
      result.duplicates++;
      result.duplicateDetails.push({
        newTx: check.transaction,
        existingTx: check.existingTransaction,
        confidence: check.confidence,
        reason: check.reason,
      });
      
      if (skipDuplicates) {
        continue; // Skip this transaction
      }
    }
    
    const merchantName = check.transaction.merchant || 'Unknown';
    const tx: Omit<Transaction, 'id'> = {
        accountId,
        date: check.transaction.date!,
        valueDate: check.transaction.date!, // Use same date if not provided
        amount: roundMoney(check.transaction.amount!),
        direction: check.transaction.direction as 'debit' | 'credit',
        category: check.transaction.category!,
        subcategory: check.transaction.subcategory!,
        merchant: merchantName,
        merchantOriginal: merchantName, // Store original for rule matching
        description: check.transaction.description || '',
        isRecurring: check.transaction.isRecurring || false,
        balanceAfter: 0, // Will be recalculated
        paymentMethod: 'card', // Default
        classificationSource: check.transaction.classificationSource || 'fallback',
        classificationConfidence: check.transaction.classificationConfidence ?? 0.25,
        classificationReason: check.transaction.classificationReason || 'Classification non documentée.',
        createdAt: now,
        updatedAt: now,
      };
    pending.push(tx);
  }

  try {
    await db.transaction('rw', db.transactions, db.accounts, db.balanceCheckpoints, async () => {
      if (pending.length > 0) {
        const ids = await db.transactions.bulkAdd(pending, { allKeys: true });
        result.transactionIds = ids.map(Number);
        result.imported = pending.length;
      }

      if (statement) {
        const existingCheckpoint = await db.balanceCheckpoints
          .where('[accountId+date]')
          .equals([accountId, statement.closingDate])
          .first();

        const checkpointData: Omit<BalanceCheckpoint, 'id'> = {
          accountId,
          date: statement.closingDate,
          balance: statement.closingBalance,
          note: `SG ${statement.accountNumber} — ${statement.transactionCount} opérations`,
          isActive: true,
          createdAt: existingCheckpoint?.createdAt || now,
          updatedAt: now,
        };

        if (existingCheckpoint) result.previousCheckpoint = { ...existingCheckpoint };
        const checkpointId = existingCheckpoint?.id
          ? (await db.balanceCheckpoints.update(existingCheckpoint.id, checkpointData), existingCheckpoint.id)
          : await db.balanceCheckpoints.add(checkpointData);
        if (!existingCheckpoint) result.createdCheckpointId = checkpointId;

        await recalculateBalances(accountId);
        const calculatedBalance = await getBalanceAtDate(
          new Date(`${statement.closingDate}T23:59:59`),
          accountId
        );
        const difference = fromCents(toCents(calculatedBalance) - toCents(statement.closingBalance));
        result.reconciliation = {
          expectedBalance: statement.closingBalance,
          calculatedBalance,
          difference,
          isReconciled: difference === 0,
          checkpointId,
        };

        if (difference !== 0) {
          throw new Error(`Import reconciliation failed: difference ${difference.toFixed(2)} EUR`);
        }
      } else if (pending.length > 0) {
        await recalculateBalances(accountId);
      }
    });
  } catch (err) {
    result.imported = 0;
    result.transactionIds = [];
    result.errors = pending.length || 1;
    result.errorDetails.push(err instanceof Error ? err.message : String(err));
  }
  
  return result;
}

/** Undo exactly one completed import and restore the checkpoint it replaced. */
export async function undoCSVImport(result: ImportResult): Promise<void> {
  const ids = result.transactionIds;
  await db.transaction("rw", db.transactions, db.accounts, db.balanceCheckpoints, async () => {
    const existing = await db.transactions.bulkGet(ids);
    if (existing.some((transaction, index) => !transaction || transaction.accountId !== result.accountId || transaction.id !== ids[index])) {
      throw new Error("L’import ne peut plus être annulé en sécurité : ses transactions ont changé.");
    }
    await db.transactions.bulkDelete(ids);
    if (result.createdCheckpointId) await db.balanceCheckpoints.delete(result.createdCheckpointId);
    if (result.previousCheckpoint?.id) await db.balanceCheckpoints.put(result.previousCheckpoint);
    await recalculateBalances(result.accountId);
  });
}

/**
 * Preview import without actually saving
 */
export async function previewImport(
  content: string,
  accountId?: number
): Promise<{
  format: 'historical' | 'bank' | 'unknown';
  totalRows: number;
  dateRange: { start: string; end: string } | null;
  transactions: Partial<Transaction>[];
  duplicateChecks: DuplicateCheck[];
  categorySummary: Record<string, number>;
  statement: BankStatementMetadata | null;
}> {
  const format = detectCSVFormat(content);
  
  let transactions: Partial<Transaction>[] = [];
  
  if (format === 'historical') {
    transactions = parseHistoricalCSV(content);
  } else if (format === 'bank') {
    transactions = parseBankCSV(content);
  }


  transactions = applyLearnedClassifications(transactions, await db.transactions.toArray());
  
  // Calculate date range
  let dateRange: { start: string; end: string } | null = null;
  if (transactions.length > 0) {
    const dates = transactions.map(t => t.date!).sort();
    dateRange = { start: dates[0], end: dates[dates.length - 1] };
  }
  
  // Check duplicates if accountId provided
  let duplicateChecks: DuplicateCheck[] = [];
  if (accountId !== undefined) {
    duplicateChecks = await checkDuplicates(transactions, accountId);
  }
  
  // Category summary
  const categorySummary: Record<string, number> = {};
  for (const tx of transactions) {
    const key = tx.category || 'Unknown';
    categorySummary[key] = (categorySummary[key] || 0) + 1;
  }
  
  return {
    format,
    totalRows: transactions.length,
    dateRange,
    transactions,
    duplicateChecks,
    categorySummary,
    statement: parseBankStatementMetadata(content),
  };
}

/**
 * Build merchant mappings by comparing historical and bank data in overlap period
 */
export async function buildMerchantMappings(
  historicalContent: string,
  bankContent: string
): Promise<Map<string, { merchant: string; category: string; subcategory: string }>> {
  const historical = parseHistoricalCSV(historicalContent);
  const bank = parseBankCSV(bankContent);
  
  // Find overlapping date range
  const hDates = historical.map(t => t.date!).sort();
  const bDates = bank.map(t => t.date!).sort();
  
  const overlapStart = hDates[0] > bDates[0] ? hDates[0] : bDates[0];
  const overlapEnd = hDates[hDates.length - 1] < bDates[bDates.length - 1] 
    ? hDates[hDates.length - 1] 
    : bDates[bDates.length - 1];
  
  logger.log(`Overlap period: ${overlapStart} to ${overlapEnd}`);
  
  // Filter to overlap period
  const hOverlap = historical.filter(t => t.date! >= overlapStart && t.date! <= overlapEnd);
  const bOverlap = bank.filter(t => t.date! >= overlapStart && t.date! <= overlapEnd);
  
  const mappings = new Map<string, { merchant: string; category: string; subcategory: string }>();
  
  // Match transactions by date and amount
  for (const bTx of bOverlap) {
    for (const hTx of hOverlap) {
      if (bTx.date === hTx.date && Math.abs(bTx.amount! - hTx.amount!) < 0.01) {
        // Found a match - map bank description to historical categorization
        const bankDesc = bTx.description?.toUpperCase() || '';
        
        // Extract key patterns from bank description
        const patterns = [
          bankDesc.match(/CARTE X\d+\s*\d+\/\d+\s*(\w+)/)?.[1],
          bankDesc.match(/^([A-Z0-9\s]+?)\s+(?:CARTE|DE:|MOTIF)/)?.[1],
          bankDesc.split(/\s+/).slice(0, 3).join(' '),
        ].filter(Boolean);
        
        for (const pattern of patterns) {
          if (pattern && pattern.length >= 3 && !mappings.has(pattern)) {
            mappings.set(pattern, {
              merchant: hTx.merchant!,
              category: hTx.category!,
              subcategory: hTx.subcategory!,
            });
          }
        }
      }
    }
  }
  
  logger.log(`Built ${mappings.size} merchant mappings from overlap`);
  return mappings;
}
