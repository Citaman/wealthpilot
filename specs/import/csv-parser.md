# CSV Import & Migration Specifications

**Version**: v0.1.0  
**Priority**: 🔴 CRITICAL  
**Status**: Specification Complete

---

## Overview

Handle multiple CSV formats, detect and eliminate duplicates, and perform one-time migration of historical data.

## Current Issues (v0.0.1)

1. ❌ Duplicate transactions counted twice
2. ❌ Historical CSV differs from import CSV
3. ❌ No smart duplicate detection
4. ❌ Balance read from CSV (incorrect)
5. ❌ No import history tracking

---

## CSV Formats

### Format A: Historical (LLM-Generated)

```csv
date,value_date,direction,amount,balance_after,category,subcategory,merchant,payment_method,description,is_recurring_guess
2025-01-10,2025-01-10,credit,2500.00,5000.00,Income,Salary,Employer,transfer,VIR SEPA RECU...,true
```

**Fields:**
- `date`: ISO format (YYYY-MM-DD)
- `value_date`: Bank value date
- `direction`: credit/debit
- `amount`: Positive number (direction determines sign)
- `balance_after`: Balance after transaction (unreliable)
- `category`: Pre-categorized
- `subcategory`: Optional
- `merchant`: Clean name
- `payment_method`: card/transfer/direct_debit/check
- `description`: Full bank description
- `is_recurring_guess`: Boolean string

### Format B: Bank Export (Société Générale)

```csv
Date de l'opération;Libellé;Détail de l'écriture;Montant de l'opération;Devise
10/01/2025;PRELEVEMENT EUROPEEN;7026904072 DE: VENDOR...;-19,21;EUR
```

**Fields:**
- `Date de l'opération`: DD/MM/YYYY format
- `Libellé`: Transaction type (PRELEVEMENT, VIREMENT, CB, etc.)
- `Détail de l'écriture`: Full description
- `Montant de l'opération`: French number format (comma decimal, negative for debits)
- `Devise`: Currency (EUR)

---

## Duplicate Detection Algorithm

### Problem

Same transaction appears differently in the two formats:

**Historical:**
```
10/12/2025,10/12/2025,debit,19.21,4980.79,Bills,Utilities,Papernest,direct_debit,PRELEVEMENT EUROPEEN 7026904072,true
```

**Import:**
```
10/12/2025;PRELEVEMENT EUROPEEN;7026904072 DE: papernest ID: FR55ZZZ671230 MOTIF: PNEST CONTRAT...;-19,21;EUR
```

### Solution: Multi-Factor Matching

```typescript
interface DuplicateCandidate {
  transaction: Transaction;
  confidence: number;
  matchFactors: string[];
}

function findDuplicates(
  incoming: ParsedTransaction,
  existing: Transaction[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  
  for (const tx of existing) {
    let score = 0;
    const factors: string[] = [];
    
    // Factor 1: Same date (exact or ±1 day)
    const dateDiff = Math.abs(
      differenceInDays(new Date(incoming.date), new Date(tx.date))
    );
    if (dateDiff === 0) {
      score += 40;
      factors.push('exact_date');
    } else if (dateDiff === 1) {
      score += 25;
      factors.push('close_date');
    }
    
    // Factor 2: Same amount (exact match required)
    if (Math.abs(incoming.amount - tx.amount) < 0.01) {
      score += 40;
      factors.push('exact_amount');
    }
    
    // Factor 3: Reference number match
    const incomingRef = extractReference(incoming.description);
    const existingRef = extractReference(tx.description);
    if (incomingRef && existingRef && incomingRef === existingRef) {
      score += 50;
      factors.push('reference_match');
    }
    
    // Factor 4: Merchant fuzzy match
    const merchantSimilarity = calculateSimilarity(
      incoming.merchant?.toLowerCase(),
      tx.merchant?.toLowerCase()
    );
    if (merchantSimilarity > 0.8) {
      score += 20;
      factors.push('merchant_match');
    }
    
    // Factor 5: Description contains shared keywords
    const sharedKeywords = findSharedKeywords(
      incoming.description,
      tx.description
    );
    if (sharedKeywords.length >= 2) {
      score += 15;
      factors.push('keyword_match');
    }
    
    // Threshold: 70+ is a likely duplicate
    if (score >= 70) {
      candidates.push({
        transaction: tx,
        confidence: Math.min(score, 100),
        matchFactors: factors
      });
    }
  }
  
  // Sort by confidence
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function extractReference(description: string): string | null {
  // Common reference patterns
  const patterns = [
    /\b(\d{8,12})\b/,                    // 8-12 digit numbers
    /REF[:\s]*([A-Z0-9]+)/i,             // REF: ABC123
    /ID[:\s]*([A-Z0-9]+)/i,              // ID: FR12345
    /N°\s*([A-Z0-9]+)/i,                 // N° 12345
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  
  // Levenshtein distance normalized
  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - (distance / maxLen);
}
```

### Import Resolution UI

```tsx
<DuplicateResolutionDialog>
  <DialogHeader>
    <DialogTitle>Potential Duplicate Found</DialogTitle>
  </DialogHeader>
  <DialogContent>
    <div className="grid grid-cols-2 gap-4">
      {/* Incoming transaction */}
      <div className="p-4 border rounded-lg">
        <h4 className="font-semibold mb-2">New (Import)</h4>
        <TransactionPreview transaction={incoming} />
      </div>
      
      {/* Existing transaction */}
      <div className="p-4 border rounded-lg bg-muted">
        <h4 className="font-semibold mb-2">Existing</h4>
        <TransactionPreview transaction={existing} />
      </div>
    </div>
    
    {/* Match explanation */}
    <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
      <p className="text-sm font-medium">
        {confidence}% confidence this is a duplicate
      </p>
      <p className="text-xs text-muted-foreground">
        Matched on: {matchFactors.join(', ')}
      </p>
    </div>
    
    {/* Actions */}
    <div className="mt-4 space-y-2">
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleResolution('skip')}
      >
        <Ban className="w-4 h-4 mr-2" />
        Skip (don't import)
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleResolution('replace')}
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Replace existing with new data
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleResolution('keep_both')}
      >
        <Copy className="w-4 h-4 mr-2" />
        Keep both (not duplicates)
      </Button>
      
      <Button 
        variant="outline" 
        className="w-full justify-start"
        onClick={() => handleResolution('merge')}
      >
        <GitMerge className="w-4 h-4 mr-2" />
        Merge (combine information)
      </Button>
    </div>
  </DialogContent>
</DuplicateResolutionDialog>
```

### Batch Duplicate Handling

```tsx
<ImportPreview>
  {/* Summary */}
  <div className="grid grid-cols-4 gap-4 mb-6">
    <StatCard label="Total rows" value={totalRows} />
    <StatCard label="New transactions" value={newCount} />
    <StatCard label="Duplicates" value={duplicateCount} color="yellow" />
    <StatCard label="Errors" value={errorCount} color="red" />
  </div>
  
  {/* Duplicate handling options */}
  {duplicateCount > 0 && (
    <div className="p-4 border rounded-lg mb-4">
      <h4 className="font-semibold mb-2">
        {duplicateCount} potential duplicates found
      </h4>
      
      <RadioGroup value={duplicateAction} onChange={setDuplicateAction}>
        <RadioGroupItem value="skip_all">
          Skip all duplicates
        </RadioGroupItem>
        <RadioGroupItem value="replace_all">
          Replace all with new data
        </RadioGroupItem>
        <RadioGroupItem value="review_each">
          Review each one
        </RadioGroupItem>
      </RadioGroup>
    </div>
  )}
  
  {/* Preview table */}
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Status</TableHead>
        <TableHead>Date</TableHead>
        <TableHead>Description</TableHead>
        <TableHead>Amount</TableHead>
        <TableHead>Action</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {previewRows.map(row => (
        <TableRow 
          key={row.id}
          className={cn(
            row.isDuplicate && "bg-yellow-50",
            row.hasError && "bg-red-50"
          )}
        >
          <TableCell>
            {row.isDuplicate && <Badge variant="warning">Duplicate</Badge>}
            {row.hasError && <Badge variant="destructive">Error</Badge>}
            {!row.isDuplicate && !row.hasError && <Badge variant="success">New</Badge>}
          </TableCell>
          <TableCell>{row.date}</TableCell>
          <TableCell className="max-w-xs truncate">{row.description}</TableCell>
          <TableCell>{formatCurrency(row.amount)}</TableCell>
          <TableCell>
            {row.isDuplicate && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => reviewDuplicate(row)}
              >
                Review
              </Button>
            )}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</ImportPreview>
```

---

## One-Time Migration

### Purpose

Clean up the historical CSV data and store a normalized version in the app.

### Migration Steps

```typescript
async function migrateHistoricalData(): Promise<MigrationResult> {
  // 1. Read historical CSV
  const historicalFile = await readHistoricalCSV();
  
  // 2. Read recent import CSV
  const importFile = await readImportCSV();
  
  // 3. Parse both with their respective formats
  const historicalTxs = parseHistoricalFormat(historicalFile);
  const importTxs = parseImportFormat(importFile);
  
  // 4. Find overlap period
  const overlapStart = findLatestDate(historicalTxs);
  const overlapEnd = findEarliestDate(importTxs);
  
  // 5. For overlap period, prefer import data
  const merged = mergeWithDeduplication(historicalTxs, importTxs);
  
  // 6. Apply enhanced categorization to all
  const categorized = merged.map(tx => enhanceCategorization(tx));
  
  // 7. Calculate balances
  const withBalances = calculateRunningBalances(categorized);
  
  // 8. Store in database
  await db.transactions.clear();
  await db.transactions.bulkAdd(withBalances);
  
  // 9. Generate normalized CSV backup
  const normalizedCSV = generateNormalizedCSV(withBalances);
  
  // 10. Save migration record
  await db.migrationHistory.add({
    date: new Date().toISOString(),
    historicalCount: historicalTxs.length,
    importCount: importTxs.length,
    mergedCount: withBalances.length,
    duplicatesResolved: historicalTxs.length + importTxs.length - withBalances.length
  });
  
  return {
    success: true,
    transactionCount: withBalances.length,
    normalizedCSV
  };
}
```

### Migration UI

```tsx
<MigrationWizard>
  <Steps current={step}>
    <Step title="Upload Historical" />
    <Step title="Upload Recent" />
    <Step title="Review Conflicts" />
    <Step title="Confirm" />
  </Steps>
  
  {step === 0 && (
    <div className="space-y-4">
      <h3 className="font-semibold">Step 1: Upload Historical CSV</h3>
      <p className="text-muted-foreground">
        Upload the CSV generated from your PDF statements (LLM format).
      </p>
      <FileDropzone
        accept=".csv"
        onDrop={handleHistoricalUpload}
        file={historicalFile}
      />
    </div>
  )}
  
  {step === 1 && (
    <div className="space-y-4">
      <h3 className="font-semibold">Step 2: Upload Recent Bank Export</h3>
      <p className="text-muted-foreground">
        Upload the CSV exported directly from your bank.
      </p>
      <FileDropzone
        accept=".csv"
        onDrop={handleImportUpload}
        file={importFile}
      />
    </div>
  )}
  
  {step === 2 && (
    <div className="space-y-4">
      <h3 className="font-semibold">Step 3: Review Conflicts</h3>
      <p className="text-muted-foreground">
        We found {conflicts.length} potential duplicates. Review each one.
      </p>
      
      {conflicts.map(conflict => (
        <ConflictCard
          key={conflict.id}
          conflict={conflict}
          onResolve={handleResolve}
        />
      ))}
    </div>
  )}
  
  {step === 3 && (
    <div className="space-y-4">
      <h3 className="font-semibold">Step 4: Confirm Migration</h3>
      
      <div className="p-4 bg-muted rounded-lg">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Historical transactions</p>
            <p className="text-2xl font-bold">{historicalCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Recent transactions</p>
            <p className="text-2xl font-bold">{importCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Duplicates resolved</p>
            <p className="text-2xl font-bold text-yellow-600">{duplicateCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Final count</p>
            <p className="text-2xl font-bold text-green-600">{finalCount}</p>
          </div>
        </div>
      </div>
      
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This will replace all existing transaction data. 
          A backup will be created automatically.
        </AlertDescription>
      </Alert>
      
      <div className="flex gap-4">
        <Button variant="outline" onClick={downloadBackup}>
          Download Backup First
        </Button>
        <Button onClick={executeMigration}>
          Run Migration
        </Button>
      </div>
    </div>
  )}
</MigrationWizard>
```

---

## Normalized CSV Format

After migration, store a clean normalized format:

```csv
id,date,amount,category,subcategory,merchant,description,payment_method,is_recurring,reference,account_id
tx_001,2025-01-10,-19.21,Bills,Insurance,Papernest,PRELEVEMENT EUROPEEN 7026904072...,direct_debit,true,7026904072,default
```

**Export function:**

```typescript
function generateNormalizedCSV(transactions: Transaction[]): string {
  const headers = [
    'id',
    'date',
    'amount',
    'category',
    'subcategory',
    'merchant',
    'description',
    'payment_method',
    'is_recurring',
    'reference',
    'account_id'
  ];
  
  const rows = transactions.map(tx => [
    tx.id,
    tx.date,
    tx.amount.toFixed(2),
    tx.category,
    tx.subcategory || '',
    tx.merchant,
    `"${tx.description.replace(/"/g, '""')}"`,
    tx.paymentMethod,
    tx.isRecurring ? 'true' : 'false',
    extractReference(tx.description) || '',
    tx.accountId
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
```

---

## Import History

Track all imports for debugging and audit:

```typescript
interface ImportHistory {
  id: string;
  filename: string;
  format: 'historical' | 'bank_sg' | 'normalized';
  importedAt: string;
  
  // Stats
  totalRows: number;
  successCount: number;
  duplicateCount: number;
  errorCount: number;
  
  // Date range
  dateRangeStart: string;
  dateRangeEnd: string;
  
  // Account
  accountId: string;
  
  // Errors
  errors: ImportError[];
}

interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}
```

---

## Implementation Checklist

### v0.1.0

- [ ] Implement multi-factor duplicate detection
- [ ] Add reference number extraction
- [ ] Create duplicate resolution dialog
- [ ] Build batch duplicate handling UI
- [ ] Create migration wizard
- [ ] Implement merge logic for overlapping periods
- [ ] Add normalized CSV export
- [ ] Create import history tracking
- [ ] Add backup before migration
- [ ] Test with real historical + import data

---

*Last updated: January 20, 2026*
