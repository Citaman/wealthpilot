// CSV Parser and Transaction Mapper
import Papa from 'papaparse';
import { db, Transaction, CATEGORIES } from './db';

// Old format from LLM extraction
interface LLMExtractedRow {
  date: string;
  value_date: string;
  direction: string;
  amount: string;
  balance_after: string;
  category: string;
  subcategory: string;
  merchant: string;
  payment_method: string;
  description: string;
  is_recurring_guess: string;
  [key: string]: string;
}

// New bank CSV format (Société Générale)
interface BankCSVRow {
  "Date de l'opération": string;
  "Libellé": string;
  "Détail de l'écriture": string;
  "Montant de l'opération": string;
  "Devise": string;
  [key: string]: string;
}

// Parsed transaction with duplicate flag
export interface ParsedTransaction extends Omit<Transaction, 'id'> {
  isDuplicate: boolean;
}

// Result of parsing a CSV file
export interface ParseResult {
  transactions: ParsedTransaction[];
  totalRows: number;
  newCount: number;
  duplicateCount: number;
  dateRange: { start: string; end: string } | null;
}

// Merchant patterns for smart categorization
const MERCHANT_PATTERNS: Array<{ pattern: RegExp; category: string; subcategory: string; merchant?: string }> = [
  // Income
  { pattern: /DIGITAL CLASSIFIEDS|VIREMENT.*SALAIRE/i, category: 'Income', subcategory: 'Salary', merchant: 'Salary' },
  { pattern: /DGFIP|FINANCES PUBLIQUES|IMPOT/i, category: 'Income', subcategory: 'Refunds', merchant: 'Tax Refund' },
  { pattern: /GENERATION.*MOTIF:/i, category: 'Income', subcategory: 'Other', merchant: 'Generation' },
  
  // Housing
  { pattern: /EDF/i, category: 'Housing', subcategory: 'Utilities', merchant: 'EDF Electricity' },
  { pattern: /VEOLIA|COMPAGNIE GENERALE DES EAUX/i, category: 'Housing', subcategory: 'Utilities', merchant: 'Veolia Water' },
  { pattern: /Loyer|RENT/i, category: 'Housing', subcategory: 'Rent', merchant: 'Rent' },
  { pattern: /LEROY MERLIN|ADEO/i, category: 'Housing', subcategory: 'Repairs', merchant: 'Leroy Merlin' },
  { pattern: /BUT\s/i, category: 'Housing', subcategory: 'Furniture', merchant: 'BUT' },
  
  // Food - Groceries
  { pattern: /ALDI/i, category: 'Food', subcategory: 'Groceries', merchant: 'Aldi' },
  { pattern: /LECLERC|E\.LECLERC/i, category: 'Food', subcategory: 'Groceries', merchant: 'E.Leclerc' },
  { pattern: /CARREFOUR/i, category: 'Food', subcategory: 'Groceries', merchant: 'Carrefour' },
  { pattern: /LIDL/i, category: 'Food', subcategory: 'Groceries', merchant: 'Lidl' },
  { pattern: /BADIS DISTRIB/i, category: 'Food', subcategory: 'Groceries', merchant: 'Badis' },
  { pattern: /KAVI KND|KAVI/i, category: 'Food', subcategory: 'Groceries', merchant: 'Kavi' },
  { pattern: /PICARD/i, category: 'Food', subcategory: 'Groceries', merchant: 'Picard' },
  
  // Food - Restaurants & Fast Food
  { pattern: /MCDONALDS|MC DONALD|MCDONALD/i, category: 'Food', subcategory: 'Fast Food', merchant: "McDonald's" },
  { pattern: /KFC/i, category: 'Food', subcategory: 'Fast Food', merchant: 'KFC' },
  { pattern: /BURGER KING|BK\s/i, category: 'Food', subcategory: 'Fast Food', merchant: 'Burger King' },
  { pattern: /UBER.*EATS/i, category: 'Food', subcategory: 'Delivery', merchant: 'Uber Eats' },
  { pattern: /DELIVEROO/i, category: 'Food', subcategory: 'Delivery', merchant: 'Deliveroo' },
  { pattern: /TAILLEVENT/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Taillevent' },
  { pattern: /CUCINA DA MARIO/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Cucina Da Mario' },
  { pattern: /COTE WOK/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Côté Wok' },
  { pattern: /RESTAURANT|RESTO/i, category: 'Food', subcategory: 'Restaurants' },
  
  // Food - Bakery & Coffee
  { pattern: /LEVAIN|BOULANGERIE|FOURNIL|FEUILLETTE/i, category: 'Food', subcategory: 'Coffee & Bakery', merchant: 'Bakery' },
  { pattern: /PAUL\s/i, category: 'Food', subcategory: 'Coffee & Bakery', merchant: 'Paul' },
  { pattern: /STARBUCKS/i, category: 'Food', subcategory: 'Coffee & Bakery', merchant: 'Starbucks' },
  
  // Transport
  { pattern: /NAVIGO|COMUTITRES/i, category: 'Transport', subcategory: 'Public Transit', merchant: 'Navigo Pass' },
  { pattern: /RATP/i, category: 'Transport', subcategory: 'Public Transit', merchant: 'RATP' },
  { pattern: /ELF|TOTAL|SHELL|BP\s|RELAIS/i, category: 'Transport', subcategory: 'Fuel', merchant: 'Gas Station' },
  { pattern: /UBER\s(?!EATS)/i, category: 'Transport', subcategory: 'Ride-hailing', merchant: 'Uber' },
  { pattern: /BOLT/i, category: 'Transport', subcategory: 'Ride-hailing', merchant: 'Bolt' },
  { pattern: /APRR|SANEF|VINCI.*AUTO/i, category: 'Transport', subcategory: 'Parking', merchant: 'Toll' },
  { pattern: /PARKING|STATTELPAYBYPHON/i, category: 'Transport', subcategory: 'Parking', merchant: 'Parking' },
  
  // Shopping
  { pattern: /AMAZON/i, category: 'Shopping', subcategory: 'Online', merchant: 'Amazon' },
  { pattern: /FNAC|DARTY/i, category: 'Shopping', subcategory: 'Electronics', merchant: 'Fnac Darty' },
  { pattern: /ZARA|H&M|HETM|PRIMARK/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'Clothing Store' },
  { pattern: /PUMA|NIKE|ADIDAS|INTERSPORT/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'Sports Store' },
  { pattern: /CRETEIL SOLEIL/i, category: 'Shopping', subcategory: 'Retail', merchant: 'Créteil Soleil' },
  { pattern: /LINDT/i, category: 'Shopping', subcategory: 'Retail', merchant: 'Lindt' },
  
  // Bills & Subscriptions
  { pattern: /FREE MOBILE/i, category: 'Bills', subcategory: 'Phone', merchant: 'Free Mobile' },
  { pattern: /FREE.*HAUT.*DEBIT|Free Telecom/i, category: 'Bills', subcategory: 'Internet', merchant: 'Free Internet' },
  { pattern: /SPOTIFY/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Spotify' },
  { pattern: /NETFLIX/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Netflix' },
  { pattern: /AMAZON PRIME/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Amazon Prime' },
  { pattern: /ADOBE/i, category: 'Bills', subcategory: 'Software', merchant: 'Adobe' },
  { pattern: /JAZZ JEUNE ACTIF/i, category: 'Bills', subcategory: 'Bank Fees', merchant: 'SG Bank Fees' },
  { pattern: /INTERETS DEBITEURS/i, category: 'Bills', subcategory: 'Bank Fees', merchant: 'Overdraft Interest' },
  
  // Insurance
  { pattern: /SOGESSUR/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Sogessur Insurance' },
  { pattern: /MAIF(?!\s*VIE)/i, category: 'Bills', subcategory: 'Insurance', merchant: 'MAIF Insurance' },
  { pattern: /MATMUT/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Matmut Insurance' },
  { pattern: /papernest|MRH/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Home Insurance' },
  { pattern: /HOMESERVE|DOMEO/i, category: 'Bills', subcategory: 'Insurance', merchant: 'HomeServe' },
  { pattern: /CARDIF|MAIF VIE/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Life Insurance' },
  
  // Health
  { pattern: /PHARMACIE|PHIE\s/i, category: 'Health', subcategory: 'Pharmacy', merchant: 'Pharmacy' },
  { pattern: /QARE|DOCTOLIB/i, category: 'Health', subcategory: 'Doctor', merchant: 'Online Doctor' },
  { pattern: /DR\s|DOCTEUR|MEDECIN/i, category: 'Health', subcategory: 'Doctor' },
  
  // Entertainment
  { pattern: /DISNEY|EURO DISNEY/i, category: 'Entertainment', subcategory: 'Events', merchant: 'Disneyland' },
  { pattern: /PATHE|CINEMA|UGC/i, category: 'Entertainment', subcategory: 'Cinema', merchant: 'Cinema' },
  { pattern: /CIRQUE|PINDER/i, category: 'Entertainment', subcategory: 'Events', merchant: 'Circus' },
  
  // Family
  { pattern: /REGIE ENFANCE|CRECHE|HALTE.?GARDERIE/i, category: 'Family', subcategory: 'Childcare', merchant: 'Childcare' },
  
  // Transfers
  { pattern: /VIR EUROPEEN EMIS|VIR INSTANTANE EMIS/i, category: 'Transfers', subcategory: 'To Others', merchant: 'Transfer Out' },
  { pattern: /VIR RECU/i, category: 'Income', subcategory: 'Other', merchant: 'Transfer In' },
  { pattern: /RETRAIT DAB/i, category: 'Transfers', subcategory: 'To Others', merchant: 'ATM Withdrawal' },
];

// Map CSV categories to our simplified structure (for old format)
const CATEGORY_MAP: Record<string, { category: string; subcategory: string }> = {
  // Income
  'Income|Salary': { category: 'Income', subcategory: 'Salary' },
  'Income|Meal allowance': { category: 'Income', subcategory: 'Benefits' },
  'Income|Refunds': { category: 'Income', subcategory: 'Refunds' },
  'Income|Insurance reimbursement': { category: 'Income', subcategory: 'Refunds' },
  'Income|Tax refund': { category: 'Income', subcategory: 'Refunds' },
  'Income|Other income': { category: 'Income', subcategory: 'Other' },
  
  // Housing
  'Housing|Utilities': { category: 'Housing', subcategory: 'Utilities' },
  'Housing|Repairs & maintenance': { category: 'Housing', subcategory: 'Repairs' },
  'Housing|Home goods / Furniture / Electronics': { category: 'Housing', subcategory: 'Furniture' },
  'Housing|Furniture & home goods': { category: 'Housing', subcategory: 'Furniture' },
  'Housing|Home improvement': { category: 'Housing', subcategory: 'Repairs' },
  'Housing|Furniture & appliances': { category: 'Housing', subcategory: 'Furniture' },
  
  // Food
  'Food|Delivery': { category: 'Food', subcategory: 'Delivery' },
  'Food|Groceries (local/ethnic)': { category: 'Food', subcategory: 'Groceries' },
  'Food|Fast food': { category: 'Food', subcategory: 'Fast Food' },
  'Food|Restaurant': { category: 'Food', subcategory: 'Restaurants' },
  'Food|Restaurants': { category: 'Food', subcategory: 'Restaurants' },
  'Food|Bakery & coffee': { category: 'Food', subcategory: 'Coffee & Bakery' },
  'Food|Groceries': { category: 'Food', subcategory: 'Groceries' },
  'Food|Convenience & snacks': { category: 'Food', subcategory: 'Groceries' },
  'Food|Delivery & meal prep': { category: 'Food', subcategory: 'Delivery' },
  'Food|Snacks & convenience': { category: 'Food', subcategory: 'Groceries' },
  'Food|Bakery / Convenience': { category: 'Food', subcategory: 'Coffee & Bakery' },
  
  // Transport
  'Transport|Ride-hailing': { category: 'Transport', subcategory: 'Ride-hailing' },
  'Transport|Fuel': { category: 'Transport', subcategory: 'Fuel' },
  'Transport|Parking & tolls': { category: 'Transport', subcategory: 'Parking' },
  'Transport|Car services': { category: 'Transport', subcategory: 'Car Service' },
  'Transport|Car admin': { category: 'Transport', subcategory: 'Insurance' },
  
  // Shopping
  'Shopping|Online shopping': { category: 'Shopping', subcategory: 'Online' },
  'Shopping|Clothing & accessories': { category: 'Shopping', subcategory: 'Clothing' },
  'Shopping|Local retail': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Electronics & media': { category: 'Shopping', subcategory: 'Electronics' },
  'Shopping|BNPL (Klarna)': { category: 'Shopping', subcategory: 'Online' },
  'Shopping|Beauty': { category: 'Shopping', subcategory: 'Beauty' },
  'Shopping|Jewelry': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Beauty & personal items': { category: 'Shopping', subcategory: 'Beauty' },
  'Shopping|Toys': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Sports': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Printing & photos': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Home goods': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Electronics accessories': { category: 'Shopping', subcategory: 'Electronics' },
  'Shopping|Clothing': { category: 'Shopping', subcategory: 'Clothing' },
  
  // Bills & Subscriptions
  'Bills & Subscriptions|Direct debit': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Insurance': { category: 'Bills', subcategory: 'Insurance' },
  'Bills & Subscriptions|App store & Apple': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Mobile': { category: 'Bills', subcategory: 'Phone' },
  'Bills & Subscriptions|Streaming & music': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Digital subscriptions': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Software': { category: 'Bills', subcategory: 'Software' },
  'Bills & Subscriptions|Bank fees & interest': { category: 'Bills', subcategory: 'Bank Fees' },
  
  // Health
  'Health|Pharmacy': { category: 'Health', subcategory: 'Pharmacy' },
  'Health|Doctor': { category: 'Health', subcategory: 'Doctor' },
  'Health|Doctor & medical': { category: 'Health', subcategory: 'Doctor' },
  'Health|Optical': { category: 'Health', subcategory: 'Doctor' },
  
  // Entertainment
  'Entertainment|Cinema': { category: 'Entertainment', subcategory: 'Cinema' },
  'Entertainment|Attractions / Cinema': { category: 'Entertainment', subcategory: 'Events' },
  'Entertainment|Theme park': { category: 'Entertainment', subcategory: 'Events' },
  'Entertainment|Leisure activities': { category: 'Entertainment', subcategory: 'Hobbies' },
  'Entertainment|Games': { category: 'Entertainment', subcategory: 'Games' },
  'Entertainment|Attractions': { category: 'Entertainment', subcategory: 'Events' },
  
  // Services
  'Services|General services': { category: 'Services', subcategory: 'Other' },
  'Services|Laundry / Dry cleaning': { category: 'Services', subcategory: 'Laundry' },
  'Services|Postage & shipping': { category: 'Services', subcategory: 'Other' },
  'Services|Card payment (merchant unclear)': { category: 'Services', subcategory: 'Other' },
  'Personal Care|Hair & grooming': { category: 'Services', subcategory: 'Other' },
  'Lifestyle|Fitness': { category: 'Entertainment', subcategory: 'Sports' },
  'Education|Training': { category: 'Family', subcategory: 'Education' },
  
  // Transfers
  'Transfers|Transfer out': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Transfer in': { category: 'Transfers', subcategory: 'From Others' },
  'Transfers|Transfer out (reimbursement)': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Car fund transfer': { category: 'Transfers', subcategory: 'To Savings' },
  'Transfers|Cheque payment': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Savings transfer': { category: 'Transfers', subcategory: 'To Savings' },
  
  // Other
  'Taxes & Government|Fines': { category: 'Taxes', subcategory: 'Fines' },
  'Cash|ATM withdrawal': { category: 'Transfers', subcategory: 'To Others' },
  'Finance|Installments / BNPL': { category: 'Bills', subcategory: 'Subscriptions' },
  'Travel|Tours & activities': { category: 'Entertainment', subcategory: 'Events' },
};

// Smart categorization from merchant/description text
function smartCategorize(libelle: string, detail: string): { category: string; subcategory: string; merchant: string } {
  const fullText = `${libelle} ${detail}`.toUpperCase();
  
  for (const rule of MERCHANT_PATTERNS) {
    if (rule.pattern.test(fullText)) {
      // Try to extract a cleaner merchant name from the text
      let merchant = rule.merchant || libelle.replace(/^CARTE X\d+ \d+\/\d+ /i, '').trim();
      merchant = merchant.replace(/\s+\d+.*$/, '').trim(); // Remove trailing numbers
      if (merchant.length > 30) merchant = merchant.substring(0, 30);
      
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        merchant: rule.merchant || merchant || 'Unknown',
      };
    }
  }
  
  // Default fallback
  let merchant = libelle.replace(/^CARTE X\d+ \d+\/\d+ /i, '').replace(/^PRELEVEMENT EUROPE.*$/i, 'Direct Debit').trim();
  merchant = merchant.replace(/\s+\d+.*$/, '').substring(0, 30) || 'Unknown';
  
  return { category: 'Services', subcategory: 'Other', merchant };
}

// Map old format categories
function mapCategory(rawCategory: string, rawSubcategory: string): { category: string; subcategory: string } {
  const key = `${rawCategory}|${rawSubcategory}`;
  if (CATEGORY_MAP[key]) {
    return CATEGORY_MAP[key];
  }
  
  // Fallback: try to match just category
  const categoryKey = Object.keys(CATEGORIES).find(c => 
    rawCategory.toLowerCase().includes(c.toLowerCase())
  );
  
  if (categoryKey) {
    return { 
      category: categoryKey, 
      subcategory: CATEGORIES[categoryKey as keyof typeof CATEGORIES].subcategories[0] 
    };
  }
  
  return { category: 'Services', subcategory: 'Other' };
}

// Detect CSV format
function detectCSVFormat(firstRow: Record<string, string>): 'bank' | 'llm' {
  // Check for bank format columns (French)
  if (firstRow["Date de l'opération"] || firstRow["Libellé"] || firstRow["Montant de l'opération"]) {
    return 'bank';
  }
  // Check for LLM-extracted format columns
  if (firstRow.date && firstRow.merchant && firstRow.category) {
    return 'llm';
  }
  return 'llm'; // default
}

// Parse date from DD/MM/YYYY to YYYY-MM-DD
function parseFrenchDate(dateStr: string): string {
  if (!dateStr) return '';
  // Handle DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr; // Already in correct format
}

// Parse French amount (-1 234,56 EUR -> -1234.56)
function parseFrenchAmount(amountStr: string): number {
  if (!amountStr) return 0;
  // Remove currency, spaces, and convert comma to dot
  const cleaned = amountStr
    .replace(/EUR/gi, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Determine payment method from description
function detectPaymentMethod(libelle: string): string {
  if (/CARTE X\d+/i.test(libelle)) return 'card';
  if (/VIR.*EUROPEEN|VIR INSTANTANE/i.test(libelle)) return 'transfer';
  if (/VIR RECU/i.test(libelle)) return 'transfer';
  if (/PRELEVEMENT/i.test(libelle)) return 'direct_debit';
  if (/RETRAIT DAB/i.test(libelle)) return 'cash';
  if (/CHEQUE/i.test(libelle)) return 'check';
  return 'other';
}

// Detect if transaction is likely recurring
function detectRecurring(libelle: string, detail: string): boolean {
  const text = `${libelle} ${detail}`.toUpperCase();
  const recurringPatterns = [
    /PRELEVEMENT/i,
    /EDF|VEOLIA|FREE|SPOTIFY|NETFLIX|AMAZON PRIME|NAVIGO|MAIF|SOGESSUR|MATMUT|HOMESERVE/i,
    /ABONNEMENT|MENSUEL|ECHEANCE/i,
  ];
  return recurringPatterns.some(p => p.test(text));
}

export async function parseCSV(file: File, targetAccountId?: number): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    // First, read the file to check if we need to skip the first line
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let csvText = e.target?.result as string;
        
        // Check if first line is the account info line (starts with = or contains account number pattern)
        const lines = csvText.split('\n');
        let skipLines = 0;
        
        // Check for bank format header line (account info)
        if (lines[0] && (lines[0].startsWith('=') || /^\d{16}/.test(lines[0].replace(/[="]/g, '')))) {
          skipLines = 1;
        }
        
        // Remove the account info line if present
        if (skipLines > 0) {
          csvText = lines.slice(skipLines).join('\n');
        }
        
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          complete: async (results) => {
            try {
              const data = results.data as Record<string, string>[];
              if (data.length === 0) {
                resolve({
                  transactions: [],
                  totalRows: 0,
                  newCount: 0,
                  duplicateCount: 0,
                  dateRange: null,
                });
                return;
              }
              
              const format = detectCSVFormat(data[0]);
              const accountId = targetAccountId || (await db.accounts.where('isActive').equals(1 as number).first())?.id || 1;
              const existingTransactions = await db.transactions.toArray();
              
              // Create a set of existing transaction signatures for duplicate detection
              const existingSignatures = new Set(
                existingTransactions.map(t => `${t.date}|${t.amount}|${t.description.substring(0, 50)}`)
              );
              
              const now = new Date().toISOString();
              const transactions: ParsedTransaction[] = [];
              let duplicateCount = 0;
              let minDate: string | null = null;
              let maxDate: string | null = null;
              
              for (const row of data) {
                let transaction: ParsedTransaction;
                
                if (format === 'bank') {
                  // Parse bank format
                  const dateStr = row["Date de l'opération"] || row["Date de l'op�ration"];
                  const libelle = row["Libellé"] || row["Libell�"];
                  const detail = row["Détail de l'écriture"] || row["D�tail de l'�criture"];
                  const amountStr = row["Montant de l'opération"] || row["Montant de l'op�ration"];
                  
                  if (!dateStr || !amountStr) continue;
                  
                  const date = parseFrenchDate(dateStr);
                  const amount = parseFrenchAmount(amountStr);
                  const { category, subcategory, merchant } = smartCategorize(libelle || '', detail || '');
                  const direction = amount >= 0 ? 'credit' : 'debit';
                  const paymentMethod = detectPaymentMethod(libelle || '');
                  const isRecurring = detectRecurring(libelle || '', detail || '');
                  const description = detail || libelle || '';
                  
                  // Check for duplicate
                  const signature = `${date}|${amount}|${description.substring(0, 50)}`;
                  const isDuplicate = existingSignatures.has(signature);
                  
                  if (isDuplicate) {
                    duplicateCount++;
                  } else {
                    existingSignatures.add(signature);
                  }
                  
                  // Track date range
                  if (!minDate || date < minDate) minDate = date;
                  if (!maxDate || date > maxDate) maxDate = date;
                  
                  transaction = {
                    date,
                    valueDate: date,
                    direction: direction as 'credit' | 'debit',
                    amount: Math.abs(amount),
                    balanceAfter: 0, // Bank format doesn't include running balance
                    category,
                    subcategory,
                    merchant,
                    merchantOriginal: merchant, // Store original for rule matching
                    paymentMethod,
                    description,
                    isRecurring,
                    accountId,
                    createdAt: now,
                    updatedAt: now,
                    isDuplicate,
                  };
                } else {
                  // Parse LLM-extracted format
                  const llmRow = row as unknown as LLMExtractedRow;
                  if (!llmRow.date || !llmRow.amount) continue;
                  
                  const amount = parseFloat(llmRow.amount.replace(',', '.'));
                  const balanceAfter = parseFloat(llmRow.balance_after?.replace(',', '.') || '0');
                  const description = llmRow.description || '';
                  const merchantName = llmRow.merchant || 'Unknown';
                  
                  // Check for duplicate
                  const signature = `${llmRow.date}|${amount}|${description.substring(0, 50)}`;
                  const isDuplicate = existingSignatures.has(signature);
                  
                  if (isDuplicate) {
                    duplicateCount++;
                  } else {
                    existingSignatures.add(signature);
                  }
                  
                  // Track date range
                  if (!minDate || llmRow.date < minDate) minDate = llmRow.date;
                  if (!maxDate || llmRow.date > maxDate) maxDate = llmRow.date;
                  
                  const { category, subcategory } = mapCategory(llmRow.category || '', llmRow.subcategory || '');
                  
                  transaction = {
                    date: llmRow.date,
                    valueDate: llmRow.value_date || llmRow.date,
                    direction: llmRow.direction === 'credit' ? 'credit' : 'debit',
                    amount: Math.abs(amount),
                    balanceAfter,
                    category,
                    subcategory,
                    merchant: merchantName,
                    merchantOriginal: merchantName, // Store original for rule matching
                    paymentMethod: llmRow.payment_method || 'other',
                    description,
                    isRecurring: llmRow.is_recurring_guess === 'True',
                    accountId,
                    createdAt: now,
                    updatedAt: now,
                    isDuplicate,
                  };
                }
                
                transactions.push(transaction);
              }
              
              // Sort by date descending
              transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              
              resolve({
                transactions,
                totalRows: transactions.length,
                newCount: transactions.length - duplicateCount,
                duplicateCount,
                dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
              });
            } catch (error) {
              reject(error);
            }
          },
          error: (error: Error) => {
            reject(error);
          },
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'ISO-8859-1'); // Use Latin-1 encoding for French bank files
  });
}

export async function importTransactions(transactions: Omit<Transaction, 'id'>[]): Promise<number> {
  const ids = await db.transactions.bulkAdd(transactions as Transaction[]);
  
  // Recalculate balances for all affected accounts
  const accountIds = new Set(transactions.map(t => t.accountId));
  const { recalculateBalances } = await import('./balance');
  
  for (const accountId of accountIds) {
    await recalculateBalances(accountId);
  }
  
  return Array.isArray(ids) ? ids.length : 1;
}

export async function detectRecurringTransactions(): Promise<void> {
  const transactions = await db.transactions.orderBy('date').toArray();
  
  // Group by merchant and approximate amount (within 10% variance)
  const merchantGroups: Record<string, Transaction[]> = {};
  
  for (const tx of transactions) {
    const key = `${tx.merchant}|${Math.round(Math.abs(tx.amount) / 5) * 5}`; // Round to nearest 5
    if (!merchantGroups[key]) {
      merchantGroups[key] = [];
    }
    merchantGroups[key].push(tx);
  }
  
  // Find recurring patterns (at least 2 occurrences with regular gaps)
  for (const [key, txs] of Object.entries(merchantGroups)) {
    if (txs.length >= 2) {
      const sortedTxs = [...txs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const dates = sortedTxs.map(t => new Date(t.date).getTime());
      const gaps = [];
      
      for (let i = 1; i < dates.length; i++) {
        gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24));
      }
      
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      
      // Determine frequency based on gap
      let frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | null = null;
      if (avgGap >= 5 && avgGap <= 10) frequency = 'weekly';
      else if (avgGap >= 12 && avgGap <= 18) frequency = 'biweekly';
      else if (avgGap >= 25 && avgGap <= 40) frequency = 'monthly';
      else if (avgGap >= 80 && avgGap <= 100) frequency = 'quarterly';
      else if (avgGap >= 350 && avgGap <= 380) frequency = 'yearly';
      
      if (frequency) {
        const existing = await db.recurringTransactions.where('name').equals(sortedTxs[0].merchant).first();
        
        // Build occurrences from all matched transactions
        const occurrences = sortedTxs.map(tx => ({
          id: crypto.randomUUID(),
          transactionId: tx.id,
          date: tx.date,
          amount: tx.amount,
          status: 'paid' as const,
        }));
        
        // Calculate average amount
        const amounts = sortedTxs.map(t => Math.abs(t.amount));
        const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const minAmount = Math.min(...amounts);
        const maxAmount = Math.max(...amounts);
        const isVariable = (maxAmount - minAmount) / averageAmount > 0.05; // 5% variance
        
        const lastTx = sortedTxs[sortedTxs.length - 1];
        const nextDate = new Date(lastTx.date);
        
        // Calculate next expected date based on frequency
        switch (frequency) {
          case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
          case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
          case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
          case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
          case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
        }
        
        // Determine type based on amount direction
        const isIncome = sortedTxs[0].amount > 0;
        const type = isIncome ? 'income' : 'subscription';
        
        if (existing) {
          // Update existing with new occurrences
          const existingOccurrences = existing.occurrences || [];
          const existingTxIds = new Set(existingOccurrences.map(o => o.transactionId));
          const newOccurrences = occurrences.filter(o => !existingTxIds.has(o.transactionId));
          
          if (newOccurrences.length > 0) {
            await db.recurringTransactions.update(existing.id!, {
              occurrences: [...existingOccurrences, ...newOccurrences],
              averageAmount: isIncome ? averageAmount : -averageAmount,
              isVariable,
              lastDetected: lastTx.date,
              nextExpected: nextDate.toISOString().split('T')[0],
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          await db.recurringTransactions.add({
            name: sortedTxs[0].merchant,
            merchant: sortedTxs[0].merchant,
            amount: isIncome ? averageAmount : -averageAmount,
            averageAmount: isIncome ? averageAmount : -averageAmount,
            category: sortedTxs[0].category,
            subcategory: sortedTxs[0].subcategory,
            frequency,
            expectedDay: new Date(lastTx.date).getDate(),
            dayOfMonth: new Date(lastTx.date).getDate(),
            type,
            status: 'active',
            isActive: true,
            isVariable,
            occurrences,
            lastDetected: lastTx.date,
            nextExpected: nextDate.toISOString().split('T')[0],
            accountId: sortedTxs[0].accountId,
            startDate: sortedTxs[0].date,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  }
}

// Link a transaction to an existing recurring item
export async function linkTransactionToRecurring(
  transactionId: number,
  recurringId: number
): Promise<void> {
  const [transaction, recurring] = await Promise.all([
    db.transactions.get(transactionId),
    db.recurringTransactions.get(recurringId),
  ]);
  
  if (!transaction || !recurring) {
    throw new Error('Transaction or recurring item not found');
  }
  
  const existingOccurrences = recurring.occurrences || [];
  
  // Check if already linked
  if (existingOccurrences.some(o => o.transactionId === transactionId)) {
    return; // Already linked
  }
  
  const newOccurrence = {
    id: crypto.randomUUID(),
    transactionId: transaction.id,
    date: transaction.date,
    amount: transaction.amount,
    status: 'paid' as const,
  };
  
  // Recalculate average
  const allAmounts = [...existingOccurrences.map(o => Math.abs(o.amount)), Math.abs(transaction.amount)];
  const newAverage = allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length;
  const isIncome = recurring.type === 'income';
  
  await db.recurringTransactions.update(recurringId, {
    occurrences: [...existingOccurrences, newOccurrence],
    averageAmount: isIncome ? newAverage : -newAverage,
    lastDetected: transaction.date > (recurring.lastDetected || '') ? transaction.date : recurring.lastDetected,
    updatedAt: new Date().toISOString(),
  });
  
  // Mark transaction as recurring
  await db.transactions.update(transactionId, { isRecurring: true });
}

// Merge two recurring items into one
export async function mergeRecurringItems(
  targetId: number,
  sourceId: number
): Promise<void> {
  const [target, source] = await Promise.all([
    db.recurringTransactions.get(targetId),
    db.recurringTransactions.get(sourceId),
  ]);
  
  if (!target || !source) {
    throw new Error('Recurring items not found');
  }
  
  // Combine occurrences
  const targetOccurrences = target.occurrences || [];
  const sourceOccurrences = source.occurrences || [];
  const targetTxIds = new Set(targetOccurrences.map(o => o.transactionId));
  const newOccurrences = sourceOccurrences.filter(o => !targetTxIds.has(o.transactionId));
  const mergedOccurrences = [...targetOccurrences, ...newOccurrences];
  
  // Recalculate average
  const allAmounts = mergedOccurrences.map(o => Math.abs(o.amount));
  const newAverage = allAmounts.length > 0 
    ? allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length 
    : Math.abs(target.amount);
  const isIncome = target.type === 'income';
  
  await db.recurringTransactions.update(targetId, {
    occurrences: mergedOccurrences,
    averageAmount: isIncome ? newAverage : -newAverage,
    updatedAt: new Date().toISOString(),
  });
  
  // Delete the source
  await db.recurringTransactions.delete(sourceId);
}

// ============================================================================
// SYNC & REPAIR FUNCTIONS
// ============================================================================

export interface SyncResult {
  recurringUpdated: number;
  transactionsLinked: number;
  newRecurringCreated: number;
  errors: string[];
}

/**
 * Sync existing recurring items with their matching transactions.
 * This repairs the occurrences array by finding all transactions that match each recurring item.
 */
export async function syncRecurringWithTransactions(): Promise<SyncResult> {
  const result: SyncResult = {
    recurringUpdated: 0,
    transactionsLinked: 0,
    newRecurringCreated: 0,
    errors: [],
  };

  try {
    const allRecurring = await db.recurringTransactions.toArray();
    const allTransactions = await db.transactions.orderBy('date').toArray();

    for (const recurring of allRecurring) {
      if (!recurring.id) continue;

      // Find transactions that match this recurring item
      const matchingTransactions = allTransactions.filter(tx => {
        // Match by merchant name (case-insensitive, partial match)
        const recurringName = (recurring.name || '').toLowerCase();
        const recurringMerchant = (recurring.merchant || '').toLowerCase();
        const txMerchant = (tx.merchant || '').toLowerCase();
        const txMerchantOriginal = (tx.merchantOriginal || '').toLowerCase();

        const nameMatch = txMerchant.includes(recurringName) || 
                         txMerchantOriginal.includes(recurringName) ||
                         recurringName.includes(txMerchant);
        const merchantMatch = recurringMerchant && (
          txMerchant.includes(recurringMerchant) || 
          txMerchantOriginal.includes(recurringMerchant) ||
          recurringMerchant.includes(txMerchant)
        );

        // Match by similar amount (within 20% tolerance)
        const amountTolerance = 0.2;
        const recurringAmount = Math.abs(recurring.amount);
        const txAmount = Math.abs(tx.amount);
        const amountDiff = Math.abs(recurringAmount - txAmount) / recurringAmount;
        const amountMatch = amountDiff <= amountTolerance;

        return (nameMatch || merchantMatch) && amountMatch;
      });

      if (matchingTransactions.length > 0) {
        // Build new occurrences array
        const existingOccurrences = recurring.occurrences || [];
        const existingTxIds = new Set(existingOccurrences.map(o => o.transactionId).filter(Boolean));

        const newOccurrences = matchingTransactions
          .filter(tx => tx.id && !existingTxIds.has(tx.id))
          .map(tx => ({
            id: crypto.randomUUID(),
            transactionId: tx.id,
            date: tx.date,
            amount: tx.amount,
            status: 'paid' as const,
          }));

        if (newOccurrences.length > 0) {
          const allOccurrences = [...existingOccurrences, ...newOccurrences]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Calculate new average
          const amounts = allOccurrences.map(o => Math.abs(o.amount));
          const averageAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
          const isIncome = recurring.type === 'income';

          // Find next expected date
          const lastOccurrence = allOccurrences[allOccurrences.length - 1];
          const nextDate = new Date(lastOccurrence.date);
          switch (recurring.frequency) {
            case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
            case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
            case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
            case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
            case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + 1); break;
          }

          await db.recurringTransactions.update(recurring.id, {
            occurrences: allOccurrences,
            averageAmount: isIncome ? averageAmount : -averageAmount,
            lastDetected: lastOccurrence.date,
            nextExpected: nextDate.toISOString().split('T')[0],
            updatedAt: new Date().toISOString(),
          });

          // Mark transactions as recurring
          const txIdsToUpdate = newOccurrences.map(o => o.transactionId).filter(Boolean) as number[];
          for (const txId of txIdsToUpdate) {
            await db.transactions.update(txId, { isRecurring: true });
          }

          result.recurringUpdated++;
          result.transactionsLinked += newOccurrences.length;
        }
      }
    }
  } catch (error) {
    result.errors.push(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Full repair: Re-detect all recurring transactions and sync them
 */
export async function fullRepairRecurring(): Promise<SyncResult> {
  const result: SyncResult = {
    recurringUpdated: 0,
    transactionsLinked: 0,
    newRecurringCreated: 0,
    errors: [],
  };

  try {
    // First, run the detection to find/create recurring items
    await detectRecurringTransactions();
    
    // Count what was created
    const afterDetect = await db.recurringTransactions.count();
    
    // Then sync all transactions with recurring items
    const syncResult = await syncRecurringWithTransactions();
    
    result.recurringUpdated = syncResult.recurringUpdated;
    result.transactionsLinked = syncResult.transactionsLinked;
    result.newRecurringCreated = afterDetect;
    result.errors = syncResult.errors;
  } catch (error) {
    result.errors.push(`Repair error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}
