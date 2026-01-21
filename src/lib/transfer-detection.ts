/**
 * Transfer Detection Module
 * Detects transfers between accounts by matching opposite amounts on similar dates
 */

import { db, Transaction } from './db';

export interface TransferLink {
  id?: number;
  fromTransactionId: number;
  toTransactionId: number;
  amount: number;
  date: string;
  isConfirmed: boolean;
  createdAt: string;
}

export interface DetectedTransfer {
  outgoing: Transaction;
  incoming: Transaction;
  confidence: number; // 0-1 confidence score
  reasons: string[];
}

/**
 * Detects potential transfers between accounts
 * Looks for matching opposite amounts on the same or nearby dates
 */
export async function detectTransfers(
  dayTolerance: number = 3
): Promise<DetectedTransfer[]> {
  // Get all transactions from the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const cutoffDate = twelveMonthsAgo.toISOString().split('T')[0];
  
  const transactions = await db.transactions
    .where('date')
    .above(cutoffDate)
    .toArray();
  
  // Group by date for faster matching
  const byDate = new Map<string, Transaction[]>();
  transactions.forEach(tx => {
    const date = tx.date;
    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(tx);
  });
  
  const detectedTransfers: DetectedTransfer[] = [];
  const processedIds = new Set<number>();
  
  // Find outgoing transactions (debits)
  const outgoingTxs = transactions.filter(tx => 
    tx.direction === 'debit' && 
    !tx.linkedTransferId && // Not already linked
    !processedIds.has(tx.id!)
  );
  
  for (const outgoing of outgoingTxs) {
    // Skip if already linked as a transfer
    if (outgoing.linkedTransferId) continue;
    
    const outgoingDate = new Date(outgoing.date);
    let bestMatch: { tx: Transaction; confidence: number; reasons: string[] } | null = null;
    
    // Search in date range
    for (let dayOffset = 0; dayOffset <= dayTolerance; dayOffset++) {
      const searchDate = new Date(outgoingDate);
      searchDate.setDate(searchDate.getDate() + dayOffset);
      const searchDateStr = searchDate.toISOString().split('T')[0];
      
      // Also check negative offset
      const searchDateNeg = new Date(outgoingDate);
      searchDateNeg.setDate(searchDateNeg.getDate() - dayOffset);
      const searchDateNegStr = searchDateNeg.toISOString().split('T')[0];
      
      const candidateDates = [searchDateStr];
      if (dayOffset > 0) candidateDates.push(searchDateNegStr);
      
      for (const dateStr of candidateDates) {
        const candidates = byDate.get(dateStr) || [];
        
        for (const candidate of candidates) {
          // Skip same transaction
          if (candidate.id === outgoing.id) continue;
          
          // Skip same account
          if (candidate.accountId === outgoing.accountId) continue;
          
          // Skip already processed
          if (processedIds.has(candidate.id!)) continue;
          
          // Skip already linked
          if (candidate.linkedTransferId) continue;
          
          // Must be a credit (incoming)
          if (candidate.direction !== 'credit') continue;
          
          // Amount must match (within small tolerance for fees)
          const amountDiff = Math.abs(candidate.amount - outgoing.amount);
          const amountTolerance = outgoing.amount * 0.02; // 2% tolerance for fees
          
          if (amountDiff > amountTolerance) continue;
          
          // Calculate confidence score
          const confidence = calculateTransferConfidence(outgoing, candidate, dayOffset);
          const reasons = getMatchReasons(outgoing, candidate, dayOffset);
          
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = { tx: candidate, confidence, reasons };
          }
        }
      }
    }
    
    if (bestMatch && bestMatch.confidence >= 0.5) {
      detectedTransfers.push({
        outgoing,
        incoming: bestMatch.tx,
        confidence: bestMatch.confidence,
        reasons: bestMatch.reasons,
      });
      
      processedIds.add(outgoing.id!);
      processedIds.add(bestMatch.tx.id!);
    }
  }
  
  return detectedTransfers;
}

/**
 * Calculate confidence score for a potential transfer match
 */
function calculateTransferConfidence(
  outgoing: Transaction,
  incoming: Transaction,
  dayOffset: number
): number {
  let score = 0.5; // Base score
  
  // Exact amount match
  if (outgoing.amount === incoming.amount) {
    score += 0.2;
  }
  
  // Same day
  if (dayOffset === 0) {
    score += 0.15;
  } else if (dayOffset === 1) {
    score += 0.1;
  } else if (dayOffset <= 3) {
    score += 0.05;
  }
  
  // Transfer-related keywords in description
  const transferKeywords = /virement|transfer|vir\s|viremen|interne/i;
  if (transferKeywords.test(outgoing.description) || transferKeywords.test(incoming.description)) {
    score += 0.1;
  }
  
  // Category is "Transfer" or "Autre"
  if (outgoing.category === 'Transfer' || incoming.category === 'Transfer') {
    score += 0.05;
  }
  
  return Math.min(score, 1.0);
}

/**
 * Get human-readable reasons for the match
 */
function getMatchReasons(
  outgoing: Transaction,
  incoming: Transaction,
  dayOffset: number
): string[] {
  const reasons: string[] = [];
  
  if (outgoing.amount === incoming.amount) {
    reasons.push('Exact amount match');
  } else {
    reasons.push('Amount match (within 2% tolerance)');
  }
  
  if (dayOffset === 0) {
    reasons.push('Same date');
  } else {
    reasons.push(`${dayOffset} day(s) apart`);
  }
  
  const transferKeywords = /virement|transfer|vir\s|viremen|interne/i;
  if (transferKeywords.test(outgoing.description)) {
    reasons.push('Transfer keyword in outgoing description');
  }
  if (transferKeywords.test(incoming.description)) {
    reasons.push('Transfer keyword in incoming description');
  }
  
  return reasons;
}

/**
 * Link two transactions as a transfer
 */
export async function linkAsTransfer(
  outgoingId: number,
  incomingId: number
): Promise<void> {
  const now = new Date().toISOString();
  
  await db.transaction('rw', db.transactions, async () => {
    // Update outgoing transaction
    await db.transactions.update(outgoingId, {
      linkedTransferId: incomingId,
      category: 'Transfer',
      subcategory: 'Internal Transfer',
      updatedAt: now,
    });
    
    // Update incoming transaction  
    await db.transactions.update(incomingId, {
      linkedTransferId: outgoingId,
      category: 'Transfer',
      subcategory: 'Internal Transfer',
      updatedAt: now,
    });
  });
}

/**
 * Unlink a transfer
 */
export async function unlinkTransfer(transactionId: number): Promise<void> {
  const now = new Date().toISOString();
  
  const tx = await db.transactions.get(transactionId);
  if (!tx || !tx.linkedTransferId) return;
  
  await db.transaction('rw', db.transactions, async () => {
    // Clear link on both transactions
    await db.transactions.update(transactionId, {
      linkedTransferId: undefined,
      updatedAt: now,
    });
    
    await db.transactions.update(tx.linkedTransferId!, {
      linkedTransferId: undefined,
      updatedAt: now,
    });
  });
}

/**
 * Get all confirmed transfers
 */
export async function getLinkedTransfers(): Promise<Array<{ from: Transaction; to: Transaction }>> {
  const transactions = await db.transactions
    .filter(tx => tx.linkedTransferId !== undefined && tx.direction === 'debit')
    .toArray();
  
  const transfers: Array<{ from: Transaction; to: Transaction }> = [];
  
  for (const fromTx of transactions) {
    if (!fromTx.linkedTransferId) continue;
    
    const toTx = await db.transactions.get(fromTx.linkedTransferId);
    if (toTx) {
      transfers.push({ from: fromTx, to: toTx });
    }
  }
  
  return transfers;
}
