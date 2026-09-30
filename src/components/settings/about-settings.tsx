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
          À propos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">WealthPilot</strong> — Pilotage financier du foyer
        </p>
        <p>Version {process.env.NEXT_PUBLIC_APP_VERSION ?? "0.12.1"}</p>
        <p>
          Vos données sont conservées localement dans ce navigateur avec IndexedDB. Rien n’est envoyé à un serveur.
        </p>
      </CardContent>
    </Card>
  );
}
