"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db, initializeDatabase } from "@/lib/db";
import { logger } from "@/lib/logger";

export type DatabaseStatus = "initializing" | "ready" | "blocked" | "error";

interface DatabaseContextValue {
  status: DatabaseStatus;
  error: string | null;
  retry: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue | undefined>(undefined);

function formatDbError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DatabaseStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const initializationRef = useRef<Promise<void> | null>(null);

  const retry = useCallback(() => {
    logger.log("[WealthPilot] Manual retry requested");
    initializationRef.current = null;
    setStatus("initializing");
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    const handleBlocked = () => {
      logger.warn("[WealthPilot] Database upgrade blocked by another tab/window");
      setStatus("blocked");
    };

    db.on("blocked", handleBlocked);
    return () => db.on("blocked").unsubscribe(handleBlocked);
  }, []);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      logger.log("[WealthPilot] Starting database initialization...");

      if (!db.isOpen()) {
        logger.log("[WealthPilot] Opening Dexie database...");
        await db.open();
        logger.log("[WealthPilot] Dexie database opened successfully");
      } else {
        logger.log("[WealthPilot] Database already open");
      }

      logger.log("[WealthPilot] Running initializeDatabase...");
      await initializeDatabase();
      logger.log("[WealthPilot] Database initialization complete");
    };

    // React Strict Mode remounts effects in development. Reuse the same pending
    // initialization so the second effect can observe its completion instead of
    // skipping it and leaving the provider permanently in `initializing`.
    initializationRef.current ??= initialize();
    const pendingInitialization = initializationRef.current;

    pendingInitialization.then(
      () => {
        if (!active) return;
        setStatus("ready");
        setError(null);
      },
      (err: unknown) => {
        logger.error("[WealthPilot] Database init failed:", err);
        if (!active) return;
        setStatus("error");
        setError(formatDbError(err));
      }
    );

    return () => {
      active = false;
    };
  }, [attempt]);

  const value = useMemo<DatabaseContextValue>(
    () => ({ status, error, retry }),
    [status, error, retry]
  );

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    throw new Error("useDatabase must be used within DatabaseProvider");
  }
  return ctx;
}
