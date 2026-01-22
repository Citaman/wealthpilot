"use client";

import { useMemo, useCallback } from "react";
import { useAccount } from "@/contexts/account-context";
import { useCurrency, usePrivacy } from "@/contexts";

export interface MoneyFormatOptions {
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

const DEFAULT_MIN_FRACTION = 0;

export function useMoney() {
  const { baseCurrency, convert } = useCurrency();
  const { accounts } = useAccount();
  const { isPrivacyMode } = usePrivacy();

  const accountCurrencyById = useMemo(() => {
    return new Map<number, string>(
      accounts.map((account) => [account.id!, account.currency || baseCurrency])
    );
  }, [accounts, baseCurrency]);

  const getAccountCurrency = useCallback(
    (accountId?: number) => {
      if (!accountId) return baseCurrency;
      return accountCurrencyById.get(accountId) || baseCurrency;
    },
    [accountCurrencyById, baseCurrency]
  );

  const convertToBase = useCallback(
    (amount: number, fromCurrency?: string) => {
      const from = fromCurrency || baseCurrency;
      return convert(amount, from, baseCurrency);
    },
    [convert, baseCurrency]
  );

  const convertFromAccount = useCallback(
    (amount: number, accountId?: number) => {
      return convertToBase(amount, getAccountCurrency(accountId));
    },
    [convertToBase, getAccountCurrency]
  );

  const format = useCallback(
    (amount: number, options?: MoneyFormatOptions) => {
      const currency = options?.currency || baseCurrency;
      const minimumFractionDigits =
        options?.minimumFractionDigits ?? DEFAULT_MIN_FRACTION;
      const maximumFractionDigits =
        options?.maximumFractionDigits ?? minimumFractionDigits;

      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(amount);
    },
    [baseCurrency]
  );

  const formatMasked = useCallback(
    (amount: number, options?: MoneyFormatOptions) => {
      if (isPrivacyMode) return "•••";
      return format(amount, options);
    },
    [format, isPrivacyMode]
  );

  const formatBase = useCallback(
    (amount: number, options?: Omit<MoneyFormatOptions, "currency">) => {
      return formatMasked(amount, { ...options, currency: baseCurrency });
    },
    [formatMasked, baseCurrency]
  );

  const formatBaseRaw = useCallback(
    (amount: number, options?: Omit<MoneyFormatOptions, "currency">) => {
      return format(amount, { ...options, currency: baseCurrency });
    },
    [format, baseCurrency]
  );

  const formatFromAccount = useCallback(
    (amount: number, accountId?: number, options?: Omit<MoneyFormatOptions, "currency">) => {
      const converted = convertFromAccount(amount, accountId);
      return formatMasked(converted, { ...options, currency: baseCurrency });
    },
    [convertFromAccount, formatMasked, baseCurrency]
  );

  const formatFromAccountRaw = useCallback(
    (amount: number, accountId?: number, options?: Omit<MoneyFormatOptions, "currency">) => {
      const converted = convertFromAccount(amount, accountId);
      return format(converted, { ...options, currency: baseCurrency });
    },
    [convertFromAccount, format, baseCurrency]
  );

  const formatCompact = useCallback(
    (amount: number) => {
      if (isPrivacyMode) return "•••";

      const absValue = Math.abs(amount);
      const sign = amount < 0 ? "-" : "";
      if (absValue >= 1_000_000) {
        return `${sign}${(absValue / 1_000_000).toFixed(1)}m`;
      }
      if (absValue >= 1_000) {
        return `${sign}${(absValue / 1_000).toFixed(1)}k`;
      }
      return `${sign}${Math.round(absValue)}`;
    },
    [isPrivacyMode]
  );

  const formatCompactCurrency = useCallback(
    (amount: number, options?: MoneyFormatOptions) => {
      if (isPrivacyMode) return "•••";
      const currency = options?.currency || baseCurrency;
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(amount);
    },
    [baseCurrency, isPrivacyMode]
  );

  return {
    baseCurrency,
    isPrivacyMode,
    getAccountCurrency,
    convertToBase,
    convertFromAccount,
    format,
    formatMasked,
    formatBase,
    formatBaseRaw,
    formatFromAccount,
    formatFromAccountRaw,
    formatCompact,
    formatCompactCurrency,
  };
}
