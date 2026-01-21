// CSV Import system with smart duplicate detection and merchant mapping
import Papa from 'papaparse';
import { db, Transaction } from './db';
import { 
  applyMerchantRules, 
  simplifyCategory, 
  areLikelyDuplicates, 
  extractMerchantFromDescription,
  CATEGORY_SIMPLIFICATION
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

// Bank CSV format columns (French)
interface BankCSVRow {
  'Date de l\'opération': string;
  'Date de valeur'?: string;
  'Libellé': string;
  'Détail de l\'écriture'?: string;
  'Montant de l\'opération': string;
  'Devise'?: string;
}

// Import result
export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  transactions: Transaction[];
  duplicateDetails: Array<{
    newTx: Partial<Transaction>;
    existingTx: Transaction;
    confidence: number;
    reason: string;
  }>;
  errorDetails: string[];
}

// Duplicate check result
export interface DuplicateCheck {
  transaction: Partial<Transaction>;
  isDuplicate: boolean;
  confidence: number;
  existingTransaction?: Transaction;
  reason: string;
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
  return parseFloat(cleaned);
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
    
    // Fix generic merchants
    if (!merchant || 
        merchant === 'Direct debit' || 
        merchant === 'Transfer in' ||
        merchant === 'Transfer out' ||
        merchant === 'Refund' ||
        merchant.length < 3) {
      // Try to extract from description
      const ruleMatch = applyMerchantRules(description);
      if (ruleMatch) {
        merchant = ruleMatch.merchant;
      } else {
        merchant = extractMerchantFromDescription(description);
      }
    }
    
    const amount = parseFloat(row.amount);
    // Direction can be 'credit'/'debit' or 'in'/'out'
    const dirLower = row.direction?.toLowerCase() || '';
    const direction = (dirLower === 'credit' || dirLower === 'in') ? 'credit' : 'debit';
    
    transactions.push({
      date: parseFrenchDate(row.date),
      amount: Math.abs(amount),
      direction,
      category,
      subcategory,
      merchant,
      description,
      isRecurring: row.is_recurring === 'true' || row.is_recurring === '1',
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
    
    // Apply rules to determine category
    const ruleMatch = applyMerchantRules(description);
    
    let category = 'Services';
    let subcategory = 'Other';
    let merchant = extractMerchantFromDescription(label);
    let isRecurring = false;
    
    if (ruleMatch) {
      category = ruleMatch.category;
      subcategory = ruleMatch.subcategory;
      merchant = ruleMatch.merchant;
      isRecurring = ruleMatch.isRecurring;
    }
    
    transactions.push({
      date: parseFrenchDate(dateStr),
      amount: Math.abs(amount),
      direction,
      category,
      subcategory,
      merchant,
      description,
      isRecurring,
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
  // Get existing transactions
  let existingTxs: Transaction[];
  
  if (accountId) {
    existingTxs = await db.transactions.where('accountId').equals(accountId).toArray();
  } else {
    existingTxs = await db.transactions.toArray();
  }
  
  const results: DuplicateCheck[] = [];
  
  for (const newTx of newTransactions) {
    let isDuplicate = false;
    let highestConfidence = 0;
    let matchingTx: Transaction | undefined;
    let matchReason = '';
    
    for (const existing of existingTxs) {
      // Quick filter: check date and amount
      if (existing.date !== newTx.date && 
          Math.abs(new Date(existing.date).getTime() - new Date(newTx.date!).getTime()) > 86400000) {
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
  } = {}
): Promise<ImportResult> {
  const { skipDuplicates = true, duplicateThreshold = 0.7 } = options;
  
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
  
  // Check for duplicates
  const duplicateChecks = await checkDuplicates(parsedTxs, accountId);
  
  const result: ImportResult = {
    imported: 0,
    duplicates: 0,
    errors: 0,
    transactions: [],
    duplicateDetails: [],
    errorDetails: [],
  };
  
  for (const check of duplicateChecks) {
    if (check.isDuplicate && check.confidence >= duplicateThreshold) {
      result.duplicates++;
      result.duplicateDetails.push({
        newTx: check.transaction,
        existingTx: check.existingTransaction!,
        confidence: check.confidence,
        reason: check.reason,
      });
      
      if (skipDuplicates) {
        continue; // Skip this transaction
      }
    }
    
    try {
      const merchantName = check.transaction.merchant || 'Unknown';
      const tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
        accountId,
        date: check.transaction.date!,
        valueDate: check.transaction.date!, // Use same date if not provided
        amount: check.transaction.amount!,
        direction: check.transaction.direction as 'debit' | 'credit',
        category: check.transaction.category!,
        subcategory: check.transaction.subcategory!,
        merchant: merchantName,
        merchantOriginal: merchantName, // Store original for rule matching
        description: check.transaction.description || '',
        isRecurring: check.transaction.isRecurring || false,
        balanceAfter: 0, // Will be recalculated
        paymentMethod: 'card', // Default
      };
      
      const id = await db.transactions.add(tx as Transaction);
      result.transactions.push({ ...tx, id } as Transaction);
      result.imported++;
    } catch (err) {
      result.errors++;
      result.errorDetails.push(`Error importing ${check.transaction.date} ${check.transaction.merchant}: ${err}`);
    }
  }
  
  // Recalculate balances after import
  if (result.imported > 0) {
    const { recalculateBalances } = await import('./balance');
    await recalculateBalances(accountId);
  }
  
  return result;
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
}> {
  const format = detectCSVFormat(content);
  
  let transactions: Partial<Transaction>[] = [];
  
  if (format === 'historical') {
    transactions = parseHistoricalCSV(content);
  } else if (format === 'bank') {
    transactions = parseBankCSV(content);
  }
  
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
  
  console.log(`Overlap period: ${overlapStart} to ${overlapEnd}`);
  
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
  
  console.log(`Built ${mappings.size} merchant mappings from overlap`);
  return mappings;
}
