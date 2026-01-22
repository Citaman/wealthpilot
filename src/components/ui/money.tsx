"use client";

import type { ElementType } from "react";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { useMoney, type MoneyFormatOptions } from "@/hooks/use-money";
import { cn } from "@/lib/utils";

interface MoneyProps extends Omit<MoneyFormatOptions, "currency"> {
  amount: number;
  currency?: string;
  className?: string;
  as?: ElementType;
  blurDisplay?: "inline" | "block";
}

export function Money({
  amount,
  currency,
  className,
  as: Comp = "span",
  blurDisplay = "inline",
  minimumFractionDigits,
  maximumFractionDigits,
}: MoneyProps) {
  const { baseCurrency, format } = useMoney();
  const formatted = format(amount, {
    currency: currency || baseCurrency,
    minimumFractionDigits,
    maximumFractionDigits,
  });

  return (
    <Comp className={cn(className)}>
      <PrivacyBlur display={blurDisplay}>{formatted}</PrivacyBlur>
    </Comp>
  );
}
