export interface Currency {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  updatedAt: string;
}

// In a real 100x app, we'd fetch these from an API like Frankfurter or ExchangeRate-API
// For this offline-first prototype, we use hardcoded rates if API fails or is unavailable.
export const FALLBACK_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  CHF: 0.95,
  JPY: 162.50,
};

export async function fetchExchangeRates(base: string = 'EUR'): Promise<ExchangeRates> {
  try {
    // Try to fetch from a free API
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
    const data = await response.json();
    return {
      base: data.base,
      rates: data.rates,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("Failed to fetch FX rates, using fallbacks:", error);
    return {
      base: 'EUR',
      rates: FALLBACK_RATES,
      updatedAt: new Date().toISOString(),
    };
  }
}
