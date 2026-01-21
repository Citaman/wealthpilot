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
        title: "Saved",
        description: "Financial month settings updated.",
      });
    } catch (error) {
      console.error("Failed to save financial month settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save financial month settings.",
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
          Financial Month
        </CardTitle>
        <CardDescription>Configure how your monthly budget periods are calculated</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Month Calculation Mode</Label>
          <Select
            value={fmSettings.mode}
            onValueChange={(value) =>
              setFmSettings({ ...fmSettings, mode: value as FinancialMonthSettings["mode"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <div className="flex flex-col">
                  <span>Auto-detect salary</span>
                  <span className="text-xs text-muted-foreground">Month starts when your salary arrives</span>
                </div>
              </SelectItem>
              <SelectItem value="fixed">
                <div className="flex flex-col">
                  <span>Fixed day of month</span>
                  <span className="text-xs text-muted-foreground">Always start on the same day</span>
                </div>
              </SelectItem>
              <SelectItem value="calendar">
                <div className="flex flex-col">
                  <span>Calendar month</span>
                  <span className="text-xs text-muted-foreground">Traditional 1st to 31st</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {fmSettings.mode === "fixed" && (
          <div className="space-y-2">
            <Label>Day of Month</Label>
            <Select value={fixedDay} onValueChange={setFixedDay}>
              <SelectTrigger className="w-32">
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
            <p className="text-xs text-muted-foreground">Your financial month will start on this day</p>
          </div>
        )}

        {fmSettings.mode === "auto" && (
          <div className="space-y-2">
            <Label>Minimum Salary Amount (€)</Label>
            <Input
              type="number"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              placeholder="1000"
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">Only income above this amount will be detected as salary</p>
          </div>
        )}

        <Button onClick={handleSaveFinancialMonthSettings} disabled={savingFm}>
          {savingFm ? "Saving..." : "Save Changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
