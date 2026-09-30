"use client";

import { useEffect, useState } from "react";
import { AppWindow, CheckCircle2, Download, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function InstallationSettings() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setInstalled(isStandalone());
    setOnline(navigator.onLine);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const refresh = () => setInstalled(isStandalone());
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", refresh);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", refresh);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AppWindow className="h-5 w-5" /> Application sur le Dock</CardTitle>
          <CardDescription>Ouvrez WealthPilot comme une application indépendante, sans barre de navigateur.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border p-4">
            {installed ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <Download className="mt-0.5 h-5 w-5 text-primary" />}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{installed ? "WealthPilot est ouvert en mode application" : "Installation prête"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {prompt
                  ? "Le navigateur peut installer l’application maintenant."
                  : "Dans Safari sur macOS : Fichier → Ajouter au Dock. Dans Chrome ou Edge : utilisez l’icône Installer dans la barre d’adresse."}
              </p>
            </div>
            {prompt && !installed ? <Button onClick={install}>Installer</Button> : null}
          </div>
          <p className="text-sm text-muted-foreground">L’application installée démarre sur la vue Aujourd’hui et expose des raccourcis vers Import, Plan et Transactions. Vos données restent dans IndexedDB sur ce profil navigateur.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">{online ? <RefreshCw className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />} État hors connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{online ? "Connexion disponible. Le cache applicatif sera actualisé sans conserver d’anciennes données financières." : "Vous êtes hors connexion. Le shell reste disponible ; les données locales déjà importées restent sur cet appareil."}</p>
        </CardContent>
      </Card>
    </div>
  );
}
