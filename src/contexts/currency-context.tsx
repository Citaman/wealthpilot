"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { fetchExchangeRates, SUPPORTED_CURRENCIES, type ExchangeRates, FALLBACK_RATES } from "@/lib/currencies";

interface CurrencyContextValue {
  baseCurrency: string;
  setBaseCurrency: (code: string) => void;
  convert: (amount: number, from: string, to?: string) => number;
  format: (amount: number, code?: string) => string;
  rates: ExchangeRates | null;
  refreshRates: () => Promise<void>;
  isRefreshingRates: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);
const supportedCodes = new Set(SUPPORTED_CURRENCIES.map((currency) => currency.code));

function isSupportedCurrency(code: string | null): code is string {
  return Boolean(code && supportedCodes.has(code));
}

function isExchangeRates(value: unknown): value is ExchangeRates {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExchangeRates>;
  return typeof candidate.base === "string"
    && typeof candidate.updatedAt === "string"
    && Boolean(candidate.rates)
    && typeof candidate.rates === "object";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [baseCurrency, setBaseCurrencyState] = useState("EUR");
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("base_currency");
    if (isSupportedCurrency(saved)) setBaseCurrencyState(saved);

    const loadRates = () => {
      const savedRates = localStorage.getItem("fx_rates");
      if (savedRates) {
        try {
          const parsed: unknown = JSON.parse(savedRates);
          if (isExchangeRates(parsed)) {
            const age = Date.now() - new Date(parsed.updatedAt).getTime();
            if (Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000) {
              setRates(parsed);
              return;
            }
          }
        } catch {
          localStorage.removeItem("fx_rates");
        }
      }
      
      setRates({ base: 'EUR', rates: FALLBACK_RATES, updatedAt: new Date().toISOString(), source: 'fallback' });
    };

    loadRates();
  }, []);

  const refreshRates = useCallback(async () => {
    setIsRefreshingRates(true);
    try {
      const newRates = await fetchExchangeRates('EUR');
      setRates(newRates);
      localStorage.setItem('fx_rates', JSON.stringify(newRates));
    } finally {
      setIsRefreshingRates(false);
    }
  }, []);

  const setBaseCurrency = useCallback((code: string) => {
    if (!isSupportedCurrency(code)) return;
    setBaseCurrencyState(code);
    localStorage.setItem("base_currency", code);
  }, []);

  const convert = useCallback((amount: number, from: string, to: string = baseCurrency) => {
    if (from === to) return amount;
    const effectiveRates = rates?.rates ?? FALLBACK_RATES;

    // Convert to EUR first (our API base)
    const rateToEur = effectiveRates[from] || FALLBACK_RATES[from] || 1;
    const amountInEur = amount / rateToEur;

    // Then convert to target
    const rateToTarget = effectiveRates[to] || FALLBACK_RATES[to] || 1;
    return amountInEur * rateToTarget;
  }, [rates, baseCurrency]);

  const format = useCallback((amount: number, code: string = baseCurrency) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }, [baseCurrency]);

  return (
    <CurrencyContext.Provider
      value={{
        baseCurrency,
        setBaseCurrency,
        convert,
        format,
        rates,
        refreshRates,
        isRefreshingRates,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
