"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { fetchExchangeRates, SUPPORTED_CURRENCIES, type ExchangeRates, FALLBACK_RATES } from "@/lib/currencies";

interface CurrencyContextValue {
  baseCurrency: string;
  setBaseCurrency: (code: string) => void;
  convert: (amount: number, from: string, to?: string) => number;
  format: (amount: number, code?: string) => string;
  rates: ExchangeRates | null;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [baseCurrency, setBaseCurrencyState] = useState("EUR");
  const [rates, setRates] = useState<ExchangeRates | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("base_currency");
    if (saved) setBaseCurrencyState(saved);

    const loadRates = async () => {
      const savedRates = localStorage.getItem("fx_rates");
      if (savedRates) {
        const parsed = JSON.parse(savedRates);
        const age = Date.now() - new Date(parsed.updatedAt).getTime();
        if (age < 24 * 60 * 60 * 1000) { // 24h cache
          setRates(parsed);
          return;
        }
      }
      
      const newRates = await fetchExchangeRates("EUR");
      setRates(newRates);
      localStorage.setItem("fx_rates", JSON.stringify(newRates));
    };

    loadRates();
  }, []);

  const setBaseCurrency = useCallback((code: string) => {
    setBaseCurrencyState(code);
    localStorage.setItem("base_currency", code);
  }, []);

  const convert = useCallback((amount: number, from: string, to: string = baseCurrency) => {
    if (!rates) return amount;
    if (from === to) return amount;

    // Convert to EUR first (our API base)
    const rateToEur = rates.rates[from] || FALLBACK_RATES[from] || 1;
    const amountInEur = amount / rateToEur;

    // Then convert to target
    const rateToTarget = rates.rates[to] || FALLBACK_RATES[to] || 1;
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
