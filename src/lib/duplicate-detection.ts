// Duplicate Detection - Multi-factor matching algorithm for CSV imports
import { db, Transaction } from './db';

// Duplicate check result
export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number;           // 0-1, how confident we are it's a duplicate
  matchedTransactionId?: number; // ID of the existing transaction it matches
  matchFactors: string[];       // Which factors matched
}

// Weights for each matching factor
const MATCH_WEIGHTS = {
  date: 0.25,
  amount: 0.30,
  description: 0.20,
  merchant: 0.15,
  dayWindow: 0.10,   // Matches within ±1 day
};

// Threshold for considering a match a duplicate
const DUPLICATE_THRESHOLD = 0.75;

/**
 * Generate a simple hash for quick comparison
 */
function generateSignature(tx: Partial<Transaction>): string {
  return `${tx.date}|${tx.amount}|${tx.direction}|${tx.description?.substring(0, 30) || ''}`;
}

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1;
  
  // Check if one contains the other
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.8;
  }
  
  // Levenshtein-like quick check for short strings
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;
  
  // Count matching characters
  let matches = 0;
  const aChars = aLower.split('');
  const bChars = bLower.split('');
  
  for (const char of aChars) {
    const idx = bChars.indexOf(char);
    if (idx >= 0) {
      matches++;
      bChars.splice(idx, 1);
    }
  }
  
  return matches / maxLen;
}

/**
 * Check if two dates are within a window (days)
 */
function datesWithinWindow(date1: string, date2: string, windowDays: number = 1): boolean {
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
  return diffDays <= windowDays;
}

/**
 * Check if a single transaction is a duplicate of any existing transaction
 */
export async function checkDuplicate(
  newTx: Partial<Transaction>,
  accountId: number = 1
): Promise<DuplicateCheckResult> {
  // Get existing transactions in a reasonable window around this date
  const txDate = newTx.date;
  if (!txDate) {
    return { isDuplicate: false, confidence: 0, matchFactors: [] };
  }
  
  // Search window: ±7 days
  const searchStart = new Date(txDate);
  searchStart.setDate(searchStart.getDate() - 7);
  const searchEnd = new Date(txDate);
  searchEnd.setDate(searchEnd.getDate() + 7);
  
  const existingTxs = await db.transactions
    .where('date')
    .between(searchStart.toISOString().split('T')[0], searchEnd.toISOString().split('T')[0], true, true)
    .filter(tx => tx.accountId === accountId)
    .toArray();
  
  let bestMatch: DuplicateCheckResult = {
    isDuplicate: false,
    confidence: 0,
    matchFactors: [],
  };
  
  for (const existingTx of existingTxs) {
    const result = compareTransactions(newTx, existingTx);
    if (result.confidence > bestMatch.confidence) {
      bestMatch = result;
    }
  }
  
  return bestMatch;
}

/**
 * Compare two transactions and return match confidence
 */
export function compareTransactions(
  newTx: Partial<Transaction>,
  existingTx: Transaction
): DuplicateCheckResult {
  let score = 0;
  const matchFactors: string[] = [];
  
  // Factor 1: Exact date match
  if (newTx.date === existingTx.date) {
    score += MATCH_WEIGHTS.date;
    matchFactors.push('date');
  } else if (newTx.date && datesWithinWindow(newTx.date, existingTx.date, 1)) {
    score += MATCH_WEIGHTS.dayWindow;
    matchFactors.push('date_near');
  }
  
  // Factor 2: Amount match (with small tolerance for rounding)
  if (newTx.amount && existingTx.amount) {
    const amountDiff = Math.abs(newTx.amount - existingTx.amount);
    if (amountDiff < 0.01) {
      score += MATCH_WEIGHTS.amount;
      matchFactors.push('amount');
    } else if (amountDiff < 0.10) {
      score += MATCH_WEIGHTS.amount * 0.5;
      matchFactors.push('amount_near');
    }
  }
  
  // Factor 3: Direction must match
  if (newTx.direction && newTx.direction !== existingTx.direction) {
    // Different direction = definitely not a duplicate
    return { isDuplicate: false, confidence: 0, matchFactors: [] };
  }
  
  // Factor 4: Description similarity
  if (newTx.description && existingTx.description) {
    const descSimilarity = stringSimilarity(newTx.description, existingTx.description);
    if (descSimilarity >= 0.8) {
      score += MATCH_WEIGHTS.description;
      matchFactors.push('description');
    } else if (descSimilarity >= 0.5) {
      score += MATCH_WEIGHTS.description * 0.5;
      matchFactors.push('description_partial');
    }
  }
  
  // Factor 5: Merchant match
  if (newTx.merchant && existingTx.merchant) {
    const merchantSimilarity = stringSimilarity(newTx.merchant, existingTx.merchant);
    if (merchantSimilarity >= 0.8) {
      score += MATCH_WEIGHTS.merchant;
      matchFactors.push('merchant');
    } else if (merchantSimilarity >= 0.5) {
      score += MATCH_WEIGHTS.merchant * 0.5;
      matchFactors.push('merchant_partial');
    }
  }
  
  return {
    isDuplicate: score >= DUPLICATE_THRESHOLD,
    confidence: score,
    matchedTransactionId: score >= DUPLICATE_THRESHOLD ? existingTx.id : undefined,
    matchFactors,
  };
}

/**
 * Check multiple transactions for duplicates in batch
 */
export async function checkDuplicatesBatch(
  newTransactions: Partial<Transaction>[],
  accountId: number = 1
): Promise<Map<number, DuplicateCheckResult>> {
  if (newTransactions.length === 0) {
    return new Map();
  }
  
  // Find date range
  const dates = newTransactions
    .map(tx => tx.date)
    .filter((d): d is string => !!d)
    .sort();
  
  if (dates.length === 0) {
    return new Map();
  }
  
  const minDate = new Date(dates[0]);
  minDate.setDate(minDate.getDate() - 7);
  const maxDate = new Date(dates[dates.length - 1]);
  maxDate.setDate(maxDate.getDate() + 7);
  
  // Load all potentially matching existing transactions
  const existingTxs = await db.transactions
    .where('date')
    .between(minDate.toISOString().split('T')[0], maxDate.toISOString().split('T')[0], true, true)
    .filter(tx => tx.accountId === accountId)
    .toArray();
  
  // Build signature index for fast lookup
  const signatureIndex = new Map<string, Transaction[]>();
  for (const tx of existingTxs) {
    // Index by date and amount combo for quick filtering
    const key = `${tx.date}|${Math.round(tx.amount * 100)}`;
    const list = signatureIndex.get(key) || [];
    list.push(tx);
    signatureIndex.set(key, list);
  }
  
  // Check each new transaction
  const results = new Map<number, DuplicateCheckResult>();
  const newTxSignatures = new Set<string>();
  
  for (let i = 0; i < newTransactions.length; i++) {
    const newTx = newTransactions[i];
    
    // Check against new transactions already processed (self-duplicates in import)
    const selfSignature = generateSignature(newTx);
    if (newTxSignatures.has(selfSignature)) {
      results.set(i, {
        isDuplicate: true,
        confidence: 1,
        matchFactors: ['self_duplicate'],
      });
      continue;
    }
    newTxSignatures.add(selfSignature);
    
    // Quick lookup in index
    const key = `${newTx.date}|${Math.round((newTx.amount || 0) * 100)}`;
    const candidates = [
      ...(signatureIndex.get(key) || []),
    ];
    
    // Also check ±1 day
    if (newTx.date) {
      const prevDay = new Date(newTx.date);
      prevDay.setDate(prevDay.getDate() - 1);
      const nextDay = new Date(newTx.date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const prevKey = `${prevDay.toISOString().split('T')[0]}|${Math.round((newTx.amount || 0) * 100)}`;
      const nextKey = `${nextDay.toISOString().split('T')[0]}|${Math.round((newTx.amount || 0) * 100)}`;
      
      candidates.push(...(signatureIndex.get(prevKey) || []));
      candidates.push(...(signatureIndex.get(nextKey) || []));
    }
    
    // Find best match among candidates
    let bestMatch: DuplicateCheckResult = {
      isDuplicate: false,
      confidence: 0,
      matchFactors: [],
    };
    
    for (const candidate of candidates) {
      const result = compareTransactions(newTx, candidate);
      if (result.confidence > bestMatch.confidence) {
        bestMatch = result;
      }
    }
    
    results.set(i, bestMatch);
  }
  
  return results;
}

/**
 * Get statistics about duplicates in a batch
 */
export function getDuplicateStats(
  results: Map<number, DuplicateCheckResult>
): { total: number; duplicates: number; unique: number; uncertain: number } {
  let duplicates = 0;
  let unique = 0;
  let uncertain = 0;
  
  for (const result of results.values()) {
    if (result.isDuplicate) {
      duplicates++;
    } else if (result.confidence >= 0.5) {
      uncertain++;
    } else {
      unique++;
    }
  }
  
  return {
    total: results.size,
    duplicates,
    unique,
    uncertain,
  };
}
