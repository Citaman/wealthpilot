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
          <AlertTitle>Loading your local data…</AlertTitle>
          <AlertDescription>
            If this takes more than a few seconds, the database upgrade may be waiting on another tab.
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
          <AlertTitle>Database is blocked</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              WealthPilot stores your data in your browser (IndexedDB). A schema upgrade may be waiting on another open tab.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => retry()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Tip: close other WealthPilot tabs/windows (and the PWA) then retry.
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
        <AlertTitle>Couldn’t open the local database</AlertTitle>
        <AlertDescription>
          <p className="mb-2">Your data may still be present, but the app can’t access it right now.</p>
          {error ? <p className="mb-2 text-xs">Error: {error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => retry()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
