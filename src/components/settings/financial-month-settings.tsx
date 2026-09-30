"use client";

import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useCallback } from "react";
import { FinancialMonthSettings, DEFAULT_FINANCIAL_MONTH_SETTINGS } from "@/lib/db";
import { getFinancialMonthSettings, saveFinancialMonthSettings } from "@/lib/financial-month";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

export function FinancialMonthSettingsCard() {
  const { toast } = useToast();
  const [fmSettings, setFmSettings] = useState<FinancialMonthSettings>(DEFAULT_FINANCIAL_MONTH_SETTINGS);
  const [fixedDay, setFixedDay] = useState("24");
  const [minSalary, setMinSalary] = useState("1000");
  const [savingFm, setSavingFm] = useState(false);

  const loadFinancialMonthSettings = useCallback(async () => {
    const settings = await getFinancialMonthSettings();
    setFmSettings(settings);
    setFixedDay(settings.fixedDay?.toString() || "24");
    setMinSalary(settings.minimumSalaryAmount.toString());
  }, []);

  useEffect(() => {
    loadFinancialMonthSettings();
  }, [loadFinancialMonthSettings]);

  const handleSaveFinancialMonthSettings = async () => {
    setSavingFm(true);
    try {
      const newSettings: FinancialMonthSettings = {
        ...fmSettings,
        fixedDay: fmSettings.mode === "fixed" ? parseInt(fixedDay) : undefined,
        minimumSalaryAmount: parseFloat(minSalary) || 1000,
      };
      await saveFinancialMonthSettings(newSettings);
      setFmSettings(newSettings);
      toast({
        variant: "success",
        title: "Mois financier enregistré",
        description: "La préférence est conservée. Les écrans compatibles utiliseront cette période.",
      });
    } catch (error) {
      logger.error("Failed to save financial month settings:", error);
      toast({
        variant: "destructive",
        title: "Enregistrement impossible",
        description: "Le mois financier n’a pas été modifié. Réessayez.",
      });
    } finally {
      setSavingFm(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Mois financier
        </CardTitle>
        <CardDescription>Définissez le début de vos périodes mensuelles. La période calendrier reste utilisée par certains écrans tant que leur migration n’est pas terminée.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Mode de calcul</Label>
          <Select
            value={fmSettings.mode}
            onValueChange={(value) =>
              setFmSettings({ ...fmSettings, mode: value as FinancialMonthSettings["mode"] })
            }
          >
            <SelectTrigger aria-label="Mode de calcul du mois financier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <div className="flex flex-col">
                  <span>Détecter le salaire</span>
                  <span className="text-sm text-muted-foreground">La période commence à la réception du salaire</span>
                </div>
              </SelectItem>
              <SelectItem value="fixed">
                <div className="flex flex-col">
                  <span>Jour fixe</span>
                  <span className="text-sm text-muted-foreground">La période commence toujours le même jour</span>
                </div>
              </SelectItem>
              <SelectItem value="calendar">
                <div className="flex flex-col">
                  <span>Mois calendrier</span>
                  <span className="text-sm text-muted-foreground">Du premier au dernier jour du mois</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {fmSettings.mode === "fixed" && (
          <div className="space-y-2">
            <Label>Jour de début</Label>
            <Select value={fixedDay} onValueChange={setFixedDay}>
              <SelectTrigger aria-label="Jour de début du mois financier" className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">La période commencera ce jour chaque mois.</p>
          </div>
        )}

        {fmSettings.mode === "auto" && (
          <div className="space-y-2">
            <Label htmlFor="minimum-salary">Montant minimal d’un salaire (€)</Label>
            <Input
              type="number"
              id="minimum-salary"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              placeholder="1000"
              className="w-full sm:w-40"
            />
            <p className="text-sm text-muted-foreground">Seuls les revenus au-dessus de ce montant pourront être reconnus comme salaire.</p>
          </div>
        )}

        <Button onClick={handleSaveFinancialMonthSettings} loading={savingFm}>
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
