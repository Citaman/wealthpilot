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
import { getStringSetting, setStringSetting } from "@/lib/backups";
import { useToast } from "@/hooks/use-toast";

export function NotificationsSettings() {
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [budgetAlertThreshold, setBudgetAlertThreshold] = useState("80");

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }

    getStringSetting("budgetAlertThreshold")
      .then((value) => {
        if (value) setBudgetAlertThreshold(value);
      })
      .catch(() => undefined);
  }, []);

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      toast({
        variant: "default",
        title: "Not Supported",
        description: "This browser does not support notifications.",
      });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");

    if (permission === "granted") {
      new Notification("WealthPilot", {
        body: "Notifications are now enabled!",
        icon: "/favicon.ico",
      });

      toast({
        variant: "success",
        title: "Enabled",
        description: "Browser notifications enabled.",
      });
    } else {
      toast({
        variant: "warning",
        title: "Permission Denied",
        description: "Notification permission was not granted.",
      });
    }
  };

  const handleBudgetAlertThresholdChange = async (value: string) => {
    setBudgetAlertThreshold(value);
    try {
      await setStringSetting("budgetAlertThreshold", value);
    } catch {
      // Non-blocking
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>Configure alert preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Browser Notifications</p>
            <p className="text-sm text-muted-foreground">Get alerts for budget warnings and goals</p>
          </div>
          {notificationsEnabled ? (
            <div className="flex items-center gap-2 text-emerald-600">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Enabled</span>
            </div>
          ) : (
            <Button variant="outline" onClick={handleEnableNotifications}>
              Enable
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Budget Alert Threshold</p>
            <p className="text-sm text-muted-foreground">
              Get notified when spending reaches this percentage
            </p>
          </div>
          <Select value={budgetAlertThreshold} onValueChange={handleBudgetAlertThresholdChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50%</SelectItem>
              <SelectItem value="75">75%</SelectItem>
              <SelectItem value="80">80%</SelectItem>
              <SelectItem value="90">90%</SelectItem>
              <SelectItem value="100">100%</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
