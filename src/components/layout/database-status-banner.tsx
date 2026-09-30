"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDatabase } from "@/contexts/database-context";
import { AlertTriangle, Database, RefreshCw } from "lucide-react";

export function DatabaseStatusBanner() {
  const { status, error, retry } = useDatabase();

  if (status === "ready") return null;

  if (status === "initializing") {
    return (
      <div className="mb-4">
        <Alert>
          <Database className="h-4 w-4" />
          <AlertTitle>Chargement de vos données locales…</AlertTitle>
          <AlertDescription>
            Si cela dure plus de quelques secondes, fermez les autres onglets WealthPilot puis réessayez.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className="mb-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>La base locale est bloquée</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              WealthPilot conserve les données dans ce navigateur. Une mise à niveau attend peut-être la fermeture d’un autre onglet.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => retry()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Recharger
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Fermez les autres fenêtres WealthPilot, puis réessayez.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Impossible d’ouvrir la base locale</AlertTitle>
        <AlertDescription>
          <p className="mb-2">Vos données sont probablement toujours présentes, mais l’application ne peut pas y accéder pour le moment.</p>
          {error ? <details className="mb-2 text-sm"><summary>Détail technique</summary><p className="mt-1 break-words">{error}</p></details> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => retry()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Recharger
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
