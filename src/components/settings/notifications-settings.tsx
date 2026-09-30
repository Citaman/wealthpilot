"use client";

import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { BUDGET_ALERT_THRESHOLDS, getBudgetAlertThreshold, setBudgetAlertThreshold as persistBudgetAlertThreshold, type BudgetAlertThreshold } from "./preferences";

export function NotificationsSettings() {
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [budgetAlertThreshold, setBudgetAlertThresholdState] = useState("80");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
      setNotificationsEnabled(Notification.permission === "granted");
    } else {
      setPermission("unsupported");
    }

    getBudgetAlertThreshold()
      .then((value) => setBudgetAlertThresholdState(String(value)))
      .catch(() => undefined);
  }, []);

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      toast({
        variant: "default",
        title: "Notifications indisponibles",
        description: "Ce navigateur ne prend pas en charge les notifications.",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    setPermission(permission);
    setNotificationsEnabled(permission === "granted");

    if (permission === "granted") {
      new Notification("WealthPilot", {
        body: "Les notifications sont maintenant activées.",
        icon: "/favicon.ico",
      });

      toast({
        variant: "success",
        title: "Notifications activées",
        description: "Les alertes du navigateur sont actives.",
      });
    } else {
      toast({
        variant: "warning",
        title: "Autorisation refusée",
        description: "Vous pourrez réactiver cette permission dans les réglages du navigateur.",
      });
    }
  };

  const handleBudgetAlertThresholdChange = async (value: string) => {
    setBudgetAlertThresholdState(value);
    try {
      await persistBudgetAlertThreshold(Number(value) as BudgetAlertThreshold);
      toast({ variant: "success", title: "Seuil enregistré", description: `Les alertes seront préparées à ${value} % du budget.` });
    } catch {
      // Non-blocking
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications du navigateur
        </CardTitle>
        <CardDescription>Choisissez quand WealthPilot doit attirer votre attention. Les données restent locales.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Notifications du navigateur</p>
            <p className="text-sm text-muted-foreground">La permission n’est demandée qu’après votre action.</p>
          </div>
          {notificationsEnabled ? (
            <div className="flex items-center gap-2 text-foreground">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Activées</span>
            </div>
          ) : permission === "denied" ? (
            <p className="text-sm font-medium text-warning">Bloquées dans le navigateur</p>
          ) : permission === "unsupported" ? (
            <p className="text-sm text-muted-foreground">Non prises en charge</p>
          ) : (
            <Button variant="outline" onClick={handleEnableNotifications}>
              Activer
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Seuil d’alerte du budget</p>
            <p className="text-sm text-muted-foreground">
              Prépare une alerte lorsque les dépenses atteignent ce pourcentage.
            </p>
          </div>
          <Select value={budgetAlertThreshold} onValueChange={handleBudgetAlertThresholdChange}>
            <SelectTrigger aria-label="Seuil d’alerte du budget" className="w-full sm:w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_ALERT_THRESHOLDS.map((threshold) => <SelectItem key={threshold} value={String(threshold)}>{threshold} %</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
