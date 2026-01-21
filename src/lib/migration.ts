// Migration System - Analyze historical data and build merchant mappings
import { db, Transaction, CATEGORIES } from './db';

// Known salary patterns (employer names)
export const SALARY_EMPLOYERS = [
  'DIGITAL CLASSIFIEDS',
  'DIGITAL CLASSIFIEDS FRANCE',
];

// Known rent/transfer patterns that shouldn't be "Other"
export const KNOWN_TRANSFERS = {
  // Pattern -> { category, subcategory, merchant }
  'VIR.*LOYER|LOYER': { category: 'Housing', subcategory: 'Rent', merchant: 'Rent' },
  'VIR.*EPARGNE|LIVRET': { category: 'Transfers', subcategory: 'To Savings', merchant: 'Savings Transfer' },
  'VIR.*EUROPEEN EMIS.*SG\\s*\\d+\\s*CPT': { category: 'Transfers', subcategory: 'To Others', merchant: 'Internal Transfer' },
  'VIR INSTANTANE EMIS': { category: 'Transfers', subcategory: 'To Others', merchant: 'Instant Transfer' },
};

// Bulletproof merchant detection rules
// Priority order - first match wins
export const MERCHANT_RULES: Array<{
  pattern: RegExp;
  category: string;
  subcategory: string;
  merchant: string;
  isRecurring?: boolean;
}> = [
  // === INCOME ===
  { pattern: /DIGITAL CLASSIFIEDS|VIREMENT.*SALAIRE/i, category: 'Income', subcategory: 'Salary', merchant: 'Salary', isRecurring: true },
  { pattern: /DGFIP|FINANCES PUBLIQUES|D\.G\.F\.I\.P/i, category: 'Income', subcategory: 'Refunds', merchant: 'Tax Refund' },
  { pattern: /GENERATION.*MOTIF:/i, category: 'Income', subcategory: 'Other', merchant: 'Generation' },
  { pattern: /VIR RECU.*DE:/i, category: 'Income', subcategory: 'Other', merchant: 'Transfer In' },
  { pattern: /REMBT|REMBOURSEMENT/i, category: 'Income', subcategory: 'Refunds', merchant: 'Refund' },

  // === HOUSING ===
  { pattern: /\bEDF\b.*particuliers/i, category: 'Housing', subcategory: 'Utilities', merchant: 'EDF Electricity', isRecurring: true },
  { pattern: /VEOLIA|COMPAGNIE GENERALE DES EAUX/i, category: 'Housing', subcategory: 'Utilities', merchant: 'Veolia Water', isRecurring: true },
  { pattern: /LOYER|VIR.*LOYER/i, category: 'Housing', subcategory: 'Rent', merchant: 'Rent', isRecurring: true },
  { pattern: /LEROY MERLIN|ADEO/i, category: 'Housing', subcategory: 'Repairs', merchant: 'Leroy Merlin' },
  { pattern: /\bBUT\b(?!\s*(?:WINE|BUTTER))/i, category: 'Housing', subcategory: 'Furniture', merchant: 'BUT' },
  { pattern: /IKEA/i, category: 'Housing', subcategory: 'Furniture', merchant: 'IKEA' },
  { pattern: /BRICO|CASTORAMA/i, category: 'Housing', subcategory: 'Repairs', merchant: 'Hardware Store' },

  // === FOOD - GROCERIES ===
  { pattern: /\bALDI\b/i, category: 'Food', subcategory: 'Groceries', merchant: 'Aldi' },
  { pattern: /E\.?LECLERC/i, category: 'Food', subcategory: 'Groceries', merchant: 'E.Leclerc' },
  { pattern: /CARREFOUR/i, category: 'Food', subcategory: 'Groceries', merchant: 'Carrefour' },
  { pattern: /\bLIDL\b/i, category: 'Food', subcategory: 'Groceries', merchant: 'Lidl' },
  { pattern: /BADIS\s*DISTRIB/i, category: 'Food', subcategory: 'Groceries', merchant: 'Badis' },
  { pattern: /KAVI\s*KND|KAVI/i, category: 'Food', subcategory: 'Groceries', merchant: 'Kavi' },
  { pattern: /PICARD/i, category: 'Food', subcategory: 'Groceries', merchant: 'Picard' },
  { pattern: /RELAIS\s*BONNEUIL/i, category: 'Food', subcategory: 'Groceries', merchant: 'Relais Bonneuil' },
  { pattern: /MONOPRIX/i, category: 'Food', subcategory: 'Groceries', merchant: 'Monoprix' },
  { pattern: /FRANPRIX/i, category: 'Food', subcategory: 'Groceries', merchant: 'Franprix' },
  { pattern: /INTERMARCHE/i, category: 'Food', subcategory: 'Groceries', merchant: 'Intermarché' },

  // === FOOD - FAST FOOD ===
  { pattern: /MCDONALD|MC\s*DONALD/i, category: 'Food', subcategory: 'Fast Food', merchant: "McDonald's" },
  { pattern: /\bKFC\b/i, category: 'Food', subcategory: 'Fast Food', merchant: 'KFC' },
  { pattern: /BURGER\s*KING|\bBK\b\s+\w+/i, category: 'Food', subcategory: 'Fast Food', merchant: 'Burger King' },
  { pattern: /QUICK(?!\s*PARK)/i, category: 'Food', subcategory: 'Fast Food', merchant: 'Quick' },
  { pattern: /SUBWAY/i, category: 'Food', subcategory: 'Fast Food', merchant: 'Subway' },
  { pattern: /FIVE\s*GUYS/i, category: 'Food', subcategory: 'Fast Food', merchant: 'Five Guys' },

  // === FOOD - DELIVERY ===
  { pattern: /UBER\s*\*?\s*EATS/i, category: 'Food', subcategory: 'Delivery', merchant: 'Uber Eats' },
  { pattern: /DELIVEROO/i, category: 'Food', subcategory: 'Delivery', merchant: 'Deliveroo' },
  { pattern: /JUST\s*EAT/i, category: 'Food', subcategory: 'Delivery', merchant: 'Just Eat' },

  // === FOOD - RESTAURANTS ===
  { pattern: /HIPPOPOTAMUS/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Hippopotamus' },
  { pattern: /TAILLEVENT/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Taillevent' },
  { pattern: /CUCINA\s*DA\s*MARIO/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Cucina Da Mario' },
  { pattern: /COTE\s*WOK/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Côté Wok' },
  { pattern: /FLUNCH/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Flunch' },
  { pattern: /BUFFALO\s*GRILL/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Buffalo Grill' },
  { pattern: /POCHA\s*OPERA/i, category: 'Food', subcategory: 'Restaurants', merchant: 'Pocha Opera' },
  { pattern: /LA\s*COTE\b/i, category: 'Food', subcategory: 'Restaurants', merchant: 'La Côte' },

  // === FOOD - BAKERY & COFFEE ===
  { pattern: /LEVAIN|BOULANGERIE|FOURNIL|FEUILLETTE/i, category: 'Food', subcategory: 'Coffee & Bakery', merchant: 'Bakery' },
  { pattern: /\bPAUL\b(?!\s*(?:STREET|SMITH))/i, category: 'Food', subcategory: 'Coffee & Bakery', merchant: 'Paul' },
  { pattern: /STARBUCKS/i, category: 'Food', subcategory: 'Coffee & Bakery', merchant: 'Starbucks' },
  { pattern: /COLOMBUS|COLUMBUS/i, category: 'Food', subcategory: 'Coffee & Bakery', merchant: 'Columbus Café' },

  // === TRANSPORT ===
  { pattern: /NAVIGO|COMUTITRES|SERVICE\s*NAVIGO/i, category: 'Transport', subcategory: 'Public Transit', merchant: 'Navigo Pass', isRecurring: true },
  { pattern: /RATP/i, category: 'Transport', subcategory: 'Public Transit', merchant: 'RATP' },
  { pattern: /SNCF(?!\s*RESEAU)/i, category: 'Transport', subcategory: 'Public Transit', merchant: 'SNCF' },
  { pattern: /\bELF\b|TOTAL\s*ENERGIES|\bSHELL\b|\bBP\b(?!\s*FRANCE)|RELAIS\s*(?!BONNEUIL)/i, category: 'Transport', subcategory: 'Fuel', merchant: 'Gas Station' },
  { pattern: /\bUBER\b(?!\s*\*?\s*EATS)/i, category: 'Transport', subcategory: 'Ride-hailing', merchant: 'Uber' },
  { pattern: /\bBOLT\b/i, category: 'Transport', subcategory: 'Ride-hailing', merchant: 'Bolt' },
  { pattern: /APRR|SANEF|VINCI.*AUTO/i, category: 'Transport', subcategory: 'Parking', merchant: 'Toll' },
  { pattern: /PARKING|STATTELPAYBYPHON|EFFIA/i, category: 'Transport', subcategory: 'Parking', merchant: 'Parking' },
  { pattern: /AUTOBACS/i, category: 'Transport', subcategory: 'Car Service', merchant: 'Autobacs' },
  { pattern: /NORAUTO|MIDAS|SPEEDY|FEU\s*VERT/i, category: 'Transport', subcategory: 'Car Service', merchant: 'Auto Service' },

  // === SHOPPING - ONLINE ===
  { pattern: /AMAZON(?!\s*PRIME)/i, category: 'Shopping', subcategory: 'Online', merchant: 'Amazon' },
  { pattern: /AMAZON\s*PRIME/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Amazon Prime', isRecurring: true },
  { pattern: /ALIEXPRESS/i, category: 'Shopping', subcategory: 'Online', merchant: 'AliExpress' },
  { pattern: /CDISCOUNT/i, category: 'Shopping', subcategory: 'Online', merchant: 'Cdiscount' },

  // === SHOPPING - CLOTHING ===
  { pattern: /H&M|HETM|H\s*ET\s*M/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'H&M' },
  { pattern: /ZARA/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'Zara' },
  { pattern: /PRIMARK/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'Primark' },
  { pattern: /KIABI/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'Kiabi' },
  { pattern: /UNIQLO/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'Uniqlo' },
  { pattern: /PUMA|NIKE|ADIDAS|INTERSPORT|DECATHLON/i, category: 'Shopping', subcategory: 'Clothing', merchant: 'Sports Store' },

  // === SHOPPING - ELECTRONICS ===
  { pattern: /FNAC(?!\s*DARTY\s*SERVICES)|DARTY(?!\s*SERVICES)/i, category: 'Shopping', subcategory: 'Electronics', merchant: 'Fnac Darty' },
  { pattern: /BOULANGER/i, category: 'Shopping', subcategory: 'Electronics', merchant: 'Boulanger' },
  { pattern: /APPLE\s*STORE/i, category: 'Shopping', subcategory: 'Electronics', merchant: 'Apple Store' },

  // === SHOPPING - OTHER ===
  { pattern: /HISTOIRE\s*D\s*OR/i, category: 'Shopping', subcategory: 'Retail', merchant: "Histoire d'Or" },
  { pattern: /LINDT/i, category: 'Shopping', subcategory: 'Retail', merchant: 'Lindt' },
  { pattern: /CRETEIL\s*SOLEIL/i, category: 'Shopping', subcategory: 'Retail', merchant: 'Créteil Soleil' },
  { pattern: /SEPHORA/i, category: 'Shopping', subcategory: 'Beauty', merchant: 'Sephora' },
  { pattern: /YVES\s*ROCHER/i, category: 'Shopping', subcategory: 'Beauty', merchant: 'Yves Rocher' },

  // === BILLS - PHONE & INTERNET ===
  { pattern: /FREE\s*MOBILE/i, category: 'Bills', subcategory: 'Phone', merchant: 'Free Mobile', isRecurring: true },
  { pattern: /FREE.*HAUT.*DEBIT|FREE\s*TELECOM/i, category: 'Bills', subcategory: 'Internet', merchant: 'Free Internet', isRecurring: true },
  { pattern: /ORANGE(?!\s*BLEUE)/i, category: 'Bills', subcategory: 'Phone', merchant: 'Orange', isRecurring: true },
  { pattern: /SFR|BOUYGUES/i, category: 'Bills', subcategory: 'Phone', merchant: 'Mobile Carrier', isRecurring: true },

  // === BILLS - SUBSCRIPTIONS ===
  { pattern: /SPOTIFY/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Spotify', isRecurring: true },
  { pattern: /NETFLIX/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Netflix', isRecurring: true },
  { pattern: /DISNEY\s*PLUS/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Disney+', isRecurring: true },
  { pattern: /APPLE\.COM\/BILL/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Apple Services', isRecurring: true },
  { pattern: /ADOBE/i, category: 'Bills', subcategory: 'Software', merchant: 'Adobe', isRecurring: true },
  { pattern: /FNAC\s*DARTY\s*SERVICES/i, category: 'Bills', subcategory: 'Subscriptions', merchant: 'Fnac Darty+', isRecurring: true },

  // === BILLS - INSURANCE ===
  { pattern: /SOGESSUR/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Sogessur Insurance', isRecurring: true },
  { pattern: /\bMAIF\b(?!\s*VIE)/i, category: 'Bills', subcategory: 'Insurance', merchant: 'MAIF Insurance', isRecurring: true },
  { pattern: /MAIF\s*VIE/i, category: 'Bills', subcategory: 'Insurance', merchant: 'MAIF Life Insurance', isRecurring: true },
  { pattern: /MATMUT/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Matmut Insurance', isRecurring: true },
  { pattern: /PAPERNEST|MRH/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Home Insurance', isRecurring: true },
  { pattern: /HOMESERVE|DOMEO/i, category: 'Bills', subcategory: 'Insurance', merchant: 'HomeServe', isRecurring: true },
  { pattern: /CARDIF/i, category: 'Bills', subcategory: 'Insurance', merchant: 'Cardif Life Insurance', isRecurring: true },

  // === BILLS - BANK FEES ===
  { pattern: /JAZZ\s*JEUNE\s*ACTIF/i, category: 'Bills', subcategory: 'Bank Fees', merchant: 'SG Bank Fees', isRecurring: true },
  { pattern: /INTERETS\s*DEBITEURS/i, category: 'Bills', subcategory: 'Bank Fees', merchant: 'Overdraft Interest' },
  { pattern: /FRAIS\s*TENUE|COTISATION/i, category: 'Bills', subcategory: 'Bank Fees', merchant: 'Bank Fees' },

  // === HEALTH ===
  { pattern: /PHARMACIE|PH[A]?IE\s/i, category: 'Health', subcategory: 'Pharmacy', merchant: 'Pharmacy' },
  { pattern: /QARE|DOCTOLIB|CDS\s*QARE/i, category: 'Health', subcategory: 'Doctor', merchant: 'Online Doctor' },
  { pattern: /\bDR\b\s|DOCTEUR|MEDECIN|CABINET\s*MEDICAL/i, category: 'Health', subcategory: 'Doctor', merchant: 'Doctor' },
  { pattern: /OPTICIEN|AFFLELOU|KRYS/i, category: 'Health', subcategory: 'Doctor', merchant: 'Optician' },

  // === ENTERTAINMENT ===
  { pattern: /EURO\s*DISNEY|DISNEYLAND/i, category: 'Entertainment', subcategory: 'Events', merchant: 'Disneyland' },
  { pattern: /PARC\s*AST[EÉ]?RIX/i, category: 'Entertainment', subcategory: 'Events', merchant: 'Parc Astérix' },
  { pattern: /PATHE|CINEMA|UGC|GAUMONT/i, category: 'Entertainment', subcategory: 'Cinema', merchant: 'Cinema' },
  { pattern: /CIRQUE|PINDER/i, category: 'Entertainment', subcategory: 'Events', merchant: 'Circus' },
  { pattern: /BOWLING/i, category: 'Entertainment', subcategory: 'Hobbies', merchant: 'Bowling' },

  // === FAMILY ===
  { pattern: /REGIE\s*ENFANCE|CRECHE|HALTE.?GARDERIE/i, category: 'Family', subcategory: 'Childcare', merchant: 'Childcare', isRecurring: true },
  { pattern: /ECOLE|COLLEGE|LYCEE/i, category: 'Family', subcategory: 'Education', merchant: 'School' },

  // === SERVICES ===
  { pattern: /5\s*A\s*SEC|PRESSING/i, category: 'Services', subcategory: 'Laundry', merchant: '5 à Sec' },
  { pattern: /LA\s*POSTE|COLISSIMO/i, category: 'Services', subcategory: 'Other', merchant: 'La Poste' },

  // === TRANSFERS ===
  { pattern: /VIR\s*EUROPEEN\s*EMIS/i, category: 'Transfers', subcategory: 'To Others', merchant: 'Transfer Out' },
  { pattern: /VIR\s*INSTANTANE\s*EMIS/i, category: 'Transfers', subcategory: 'To Others', merchant: 'Instant Transfer' },
  { pattern: /RETRAIT\s*DAB/i, category: 'Transfers', subcategory: 'To Others', merchant: 'ATM Withdrawal' },

  // === TAXES ===
  { pattern: /IMPOT|TRESOR\s*PUBLIC/i, category: 'Taxes', subcategory: 'Income Tax', merchant: 'Tax Payment' },
  { pattern: /AMENDE|ANTAI/i, category: 'Taxes', subcategory: 'Fines', merchant: 'Fine' },
];

// Analysis result for historical data
export interface DataAnalysisResult {
  totalTransactions: number;
  dateRange: { start: string; end: string };
  categoryCounts: Record<string, number>;
  subcategoryCounts: Record<string, number>;
  merchantCounts: Record<string, number>;
  issuesList: DataIssue[];
  salaryTransactions: Array<{ date: string; amount: number; merchant: string }>;
  potentialDuplicates: Array<{ tx1: Partial<Transaction>; tx2: Partial<Transaction>; confidence: number }>;
}

export interface DataIssue {
  type: 'missing_merchant' | 'generic_category' | 'inconsistent_merchant' | 'missing_category' | 'wrong_salary' | 'wrong_transfer';
  description: string;
  count: number;
  examples: string[];
}

// Category mapping from old CSV format to new simplified format
export const CATEGORY_SIMPLIFICATION: Record<string, { category: string; subcategory: string }> = {
  // Food
  'Food|Groceries': { category: 'Food', subcategory: 'Groceries' },
  'Food|Groceries (local/ethnic)': { category: 'Food', subcategory: 'Groceries' },
  'Food|Restaurant': { category: 'Food', subcategory: 'Restaurants' },
  'Food|Fast food': { category: 'Food', subcategory: 'Fast Food' },
  'Food|Delivery': { category: 'Food', subcategory: 'Delivery' },
  'Food|Bakery & coffee': { category: 'Food', subcategory: 'Coffee & Bakery' },
  'Food|Bakery / Convenience': { category: 'Food', subcategory: 'Coffee & Bakery' },
  'Food|Delivery & meal prep': { category: 'Food', subcategory: 'Delivery' },
  'Food|Convenience & snacks': { category: 'Food', subcategory: 'Groceries' },
  'Food|Snacks & convenience': { category: 'Food', subcategory: 'Groceries' },
  
  // Bills & Subscriptions -> Bills
  'Bills & Subscriptions|Mobile': { category: 'Bills', subcategory: 'Phone' },
  'Bills & Subscriptions|Insurance': { category: 'Bills', subcategory: 'Insurance' },
  'Bills & Subscriptions|Streaming & music': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|App store & Apple': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Software': { category: 'Bills', subcategory: 'Software' },
  'Bills & Subscriptions|Direct debit': { category: 'Bills', subcategory: 'Subscriptions' },
  'Bills & Subscriptions|Bank fees & interest': { category: 'Bills', subcategory: 'Bank Fees' },
  'Bills & Subscriptions|Digital subscriptions': { category: 'Bills', subcategory: 'Subscriptions' },
  
  // Shopping
  'Shopping|Clothing & accessories': { category: 'Shopping', subcategory: 'Clothing' },
  'Shopping|Clothing': { category: 'Shopping', subcategory: 'Clothing' },
  'Shopping|Online shopping': { category: 'Shopping', subcategory: 'Online' },
  'Shopping|Local retail': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Jewelry': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|Electronics & media': { category: 'Shopping', subcategory: 'Electronics' },
  'Shopping|Sports': { category: 'Shopping', subcategory: 'Retail' },
  'Shopping|BNPL (Klarna)': { category: 'Shopping', subcategory: 'Online' },
  'Shopping|Beauty': { category: 'Shopping', subcategory: 'Beauty' },
  'Shopping|Beauty & personal items': { category: 'Shopping', subcategory: 'Beauty' },
  'Shopping|Toys': { category: 'Shopping', subcategory: 'Retail' },
  
  // Transport
  'Transport|Car services': { category: 'Transport', subcategory: 'Car Service' },
  'Transport|Parking & tolls': { category: 'Transport', subcategory: 'Parking' },
  'Transport|Fuel': { category: 'Transport', subcategory: 'Fuel' },
  'Transport|Ride-hailing': { category: 'Transport', subcategory: 'Ride-hailing' },
  'Transport|Car admin': { category: 'Transport', subcategory: 'Insurance' },
  
  // Entertainment
  'Entertainment|Cinema': { category: 'Entertainment', subcategory: 'Cinema' },
  'Entertainment|Attractions': { category: 'Entertainment', subcategory: 'Events' },
  'Entertainment|Attractions / Cinema': { category: 'Entertainment', subcategory: 'Events' },
  'Entertainment|Theme park': { category: 'Entertainment', subcategory: 'Events' },
  'Entertainment|Leisure activities': { category: 'Entertainment', subcategory: 'Hobbies' },
  'Entertainment|Games': { category: 'Entertainment', subcategory: 'Games' },
  
  // Health
  'Health|Pharmacy': { category: 'Health', subcategory: 'Pharmacy' },
  'Health|Doctor': { category: 'Health', subcategory: 'Doctor' },
  'Health|Doctor & medical': { category: 'Health', subcategory: 'Doctor' },
  'Health|Optical': { category: 'Health', subcategory: 'Doctor' },
  
  // Services
  'Services|General services': { category: 'Services', subcategory: 'Other' },
  'Services|Laundry / Dry cleaning': { category: 'Services', subcategory: 'Laundry' },
  'Services|Postage & shipping': { category: 'Services', subcategory: 'Other' },
  'Services|Card payment (merchant unclear)': { category: 'Services', subcategory: 'Other' },
  'Personal Care|Hair & grooming': { category: 'Services', subcategory: 'Other' },
  
  // Housing
  'Housing|Utilities': { category: 'Housing', subcategory: 'Utilities' },
  'Housing|Repairs & maintenance': { category: 'Housing', subcategory: 'Repairs' },
  'Housing|Home goods / Furniture / Electronics': { category: 'Housing', subcategory: 'Furniture' },
  'Housing|Furniture & home goods': { category: 'Housing', subcategory: 'Furniture' },
  'Housing|Home improvement': { category: 'Housing', subcategory: 'Repairs' },
  'Housing|Furniture & appliances': { category: 'Housing', subcategory: 'Furniture' },
  
  // Income
  'Income|Salary': { category: 'Income', subcategory: 'Salary' },
  'Income|Refunds': { category: 'Income', subcategory: 'Refunds' },
  'Income|Meal allowance': { category: 'Income', subcategory: 'Benefits' },
  'Income|Insurance reimbursement': { category: 'Income', subcategory: 'Refunds' },
  'Income|Tax refund': { category: 'Income', subcategory: 'Refunds' },
  'Income|Other income': { category: 'Income', subcategory: 'Other' },
  
  // Transfers
  'Transfers|Transfer out': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Transfer in': { category: 'Transfers', subcategory: 'From Others' },
  'Transfers|Transfer out (reimbursement)': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Car fund transfer': { category: 'Transfers', subcategory: 'To Savings' },
  'Transfers|Cheque payment': { category: 'Transfers', subcategory: 'To Others' },
  'Transfers|Savings transfer': { category: 'Transfers', subcategory: 'To Savings' },
  'Cash|ATM withdrawal': { category: 'Transfers', subcategory: 'To Others' },
  
  // Taxes
  'Taxes & Government|Fines': { category: 'Taxes', subcategory: 'Fines' },
  
  // Family
  'Family|Childcare': { category: 'Family', subcategory: 'Childcare' },
  'Education|Training': { category: 'Family', subcategory: 'Education' },
  
  // Other mappings
  'Finance|Installments / BNPL': { category: 'Bills', subcategory: 'Subscriptions' },
  'Travel|Tours & activities': { category: 'Entertainment', subcategory: 'Events' },
  'Lifestyle|Fitness': { category: 'Entertainment', subcategory: 'Sports' },
};

/**
 * Apply merchant rules to get category/subcategory/merchant
 */
export function applyMerchantRules(description: string): { category: string; subcategory: string; merchant: string; isRecurring: boolean } | null {
  const upperDesc = description.toUpperCase();
  
  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(upperDesc)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        merchant: rule.merchant,
        isRecurring: rule.isRecurring || false,
      };
    }
  }
  
  return null;
}

/**
 * Simplify category from old format to new
 */
export function simplifyCategory(category: string, subcategory: string): { category: string; subcategory: string } {
  const key = `${category}|${subcategory}`;
  
  if (CATEGORY_SIMPLIFICATION[key]) {
    return CATEGORY_SIMPLIFICATION[key];
  }
  
  // Try category-only match
  const categoryMatch = Object.entries(CATEGORY_SIMPLIFICATION).find(
    ([k]) => k.startsWith(`${category}|`)
  );
  
  if (categoryMatch) {
    return categoryMatch[1];
  }
  
  // Return as-is if category is valid
  if (CATEGORIES[category]) {
    return { category, subcategory: subcategory || CATEGORIES[category].subcategories[0] };
  }
  
  return { category: 'Services', subcategory: 'Other' };
}

/**
 * Check if two transactions are likely duplicates
 */
export function areLikelyDuplicates(
  tx1: { date: string; amount: number; description?: string; merchant?: string },
  tx2: { date: string; amount: number; description?: string; merchant?: string }
): { isDuplicate: boolean; confidence: number; reason: string } {
  // Must be same date or within 1 day
  const date1 = new Date(tx1.date);
  const date2 = new Date(tx2.date);
  const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
  
  if (daysDiff > 1) {
    return { isDuplicate: false, confidence: 0, reason: 'dates too far apart' };
  }
  
  // Must be same amount (with small tolerance)
  const amountDiff = Math.abs(tx1.amount - tx2.amount);
  if (amountDiff > 0.01) {
    return { isDuplicate: false, confidence: 0, reason: 'amounts different' };
  }
  
  // If exact date and amount match
  if (daysDiff === 0 && amountDiff < 0.01) {
    // Check merchant similarity
    const m1 = (tx1.merchant || '').toLowerCase();
    const m2 = (tx2.merchant || '').toLowerCase();
    
    if (m1 && m2 && (m1.includes(m2) || m2.includes(m1) || m1 === m2)) {
      return { isDuplicate: true, confidence: 0.95, reason: 'exact date + amount + similar merchant' };
    }
    
    return { isDuplicate: true, confidence: 0.85, reason: 'exact date + amount' };
  }
  
  // Within 1 day with same amount
  return { isDuplicate: true, confidence: 0.7, reason: 'same amount within 1 day' };
}

/**
 * Extract clean merchant name from bank description
 */
export function extractMerchantFromDescription(description: string): string {
  // Remove CARTE X#### pattern
  let cleaned = description.replace(/CARTE\s*X\d+\s*\d+\/\d+\s*/i, '').trim();
  
  // Remove trailing numbers and reference codes
  cleaned = cleaned.replace(/\s+\d+[A-Z]*\s*$/, '').trim();
  cleaned = cleaned.replace(/\s+COMMERCE\s+ELECTRONIQUE.*$/i, '').trim();
  cleaned = cleaned.replace(/\s+IOPD\s*$/i, '').trim();
  
  // Remove PRELEVEMENT pattern
  cleaned = cleaned.replace(/PRELEVEMENT\s+EUROPE[E]?N\s+\d+\s*/i, '').trim();
  
  // Take only the merchant part before DE: or MOTIF:
  const deMatch = cleaned.match(/^(.*?)\s+DE:/i);
  if (deMatch) {
    cleaned = deMatch[1].trim();
  }
  
  // Limit length
  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30);
  }
  
  return cleaned || 'Unknown';
}
