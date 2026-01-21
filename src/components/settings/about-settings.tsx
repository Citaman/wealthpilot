"use client";

import { Settings as SettingsIcon } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

export function AboutSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          About
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">WealthPilot</strong> - Personal Finance Dashboard
        </p>
        <p>Version {process.env.NEXT_PUBLIC_APP_VERSION ?? "0.12.1"}</p>
        <p>
          Your data is stored locally in your browser using IndexedDB. Nothing is sent to any server.
        </p>
      </CardContent>
    </Card>
  );
}
