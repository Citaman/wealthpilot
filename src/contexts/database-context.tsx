"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { db, initializeDatabase } from "@/lib/db";

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
  const isOpening = useRef(false);

  const retry = useCallback(() => {
    console.log("[WealthPilot] Manual retry requested");
    isOpening.current = false;
    setStatus("initializing");
    setError(null);
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const openAndInit = async () => {
      // Prevent concurrent opens
      if (isOpening.current) {
        console.log("[WealthPilot] Already opening, skipping duplicate call");
        return;
      }
      isOpening.current = true;

      console.log("[WealthPilot] Starting database initialization...");
      
      try {
        // Check if DB is already open
        if (!db.isOpen()) {
          console.log("[WealthPilot] Opening Dexie database...");
          
          // Set up blocked handler BEFORE opening
          db.on("blocked", () => {
            console.warn("[WealthPilot] Database upgrade blocked by another tab/window");
            if (!cancelled) {
              setStatus("blocked");
            }
          });

          await db.open();
          console.log("[WealthPilot] Dexie database opened successfully");
        } else {
          console.log("[WealthPilot] Database already open");
        }

        // Initialize default data
        console.log("[WealthPilot] Running initializeDatabase...");
        await initializeDatabase();
        console.log("[WealthPilot] Database initialization complete");

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (err) {
        console.error("[WealthPilot] Database init failed:", err);
        if (!cancelled) {
          setStatus("error");
          setError(formatDbError(err));
        }
      } finally {
        isOpening.current = false;
      }
    };

    openAndInit();

    return () => {
      cancelled = true;
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
