"use client";

import { Globe, RefreshCw, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/contexts";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function CurrencySettings() {
  const { baseCurrency, setBaseCurrency, rates, refreshRates, isRefreshingRates } = useCurrency();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Devise de référence
        </CardTitle>
        <CardDescription>
          Choisissez la devise utilisée pour agréger les comptes et les analyses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <Label>Devise de référence</Label>
            <p className="text-sm text-muted-foreground">
              Les synthèses convertissent les comptes dans cette devise, sans modifier leur devise d’origine.
            </p>
          </div>
          <Select value={baseCurrency} onValueChange={setBaseCurrency}>
            <SelectTrigger aria-label="Devise de référence" className="w-full sm:w-[180px]">
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
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">Taux de conversion enregistrés</span>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                Mis à jour le {format(new Date(rates.updatedAt), "Pp", { locale: fr })}
              </div>
            </div>
            <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
              <p className="text-xs text-muted-foreground">
                {rates.source === 'external'
                  ? 'Taux récupérés explicitement depuis exchangerate-api.com.'
                  : 'Taux hors ligne intégrés. Aucun appel réseau automatique n’est effectué.'}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={refreshRates} disabled={isRefreshingRates} className="gap-2">
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingRates ? 'animate-spin' : ''}`} />
                {isRefreshingRates ? 'Actualisation…' : 'Actualiser en ligne'}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SUPPORTED_CURRENCIES.filter(c => c.code !== baseCurrency).map((c) => {
                const rate = rates.rates[c.code];
                return (
                  <div key={c.code} className="p-2 rounded-lg bg-muted border text-center">
                    <p className="text-xs text-muted-foreground uppercase">{c.code}</p>
                    <p className="text-sm font-bold">
                      {rate ? rate.toFixed(4) : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-muted/30 border border-muted flex gap-3">
          <Info className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-foreground">
            La conversion s’applique au <strong>solde total</strong> et aux <strong>analyses</strong>. Chaque compte conserve sa devise d’origine. Vérifiez la date du taux avant une décision importante.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
