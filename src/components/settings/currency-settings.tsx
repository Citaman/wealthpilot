"use client";

import { Globe, RefreshCw, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/contexts";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { format } from "date-fns";

export function CurrencySettings() {
  const { baseCurrency, setBaseCurrency, rates } = useCurrency();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Multi-Currency
        </CardTitle>
        <CardDescription>
          Choose your base currency for the dashboard and analytics.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Base Currency</Label>
            <p className="text-xs text-muted-foreground">
              All accounts will be converted to this currency in summaries.
            </p>
          </div>
          <Select value={baseCurrency} onValueChange={setBaseCurrency}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rates && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Live Exchange Rates</span>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Updated {format(new Date(rates.updatedAt), "PPp")}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SUPPORTED_CURRENCIES.filter(c => c.code !== baseCurrency).map((c) => {
                const rate = rates.rates[c.code];
                return (
                  <div key={c.code} className="p-2 rounded-lg bg-muted/50 border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">{c.code}</p>
                    <p className="text-sm font-bold">
                      {rate ? rate.toFixed(4) : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 flex gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0" />
          <p className="text-xs text-blue-800 dark:text-blue-400">
            Currency conversion is applied to the **Total Balance** and **Analytics**. 
            Individual accounts still track their original currency.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
