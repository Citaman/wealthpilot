"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode, useRef } from "react";

interface SecurityContextValue {
  isLocked: boolean;
  hasPin: boolean;
  lock: () => void;
  unlock: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  clearPin: () => void;
  autoLockTimeout: number; // minutes
  setAutoLockTimeout: (minutes: number) => void;
}

const SecurityContext = createContext<SecurityContextValue | undefined>(undefined);

// Helper to hash PIN
async function hashPin(pin: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(pin + "wealthpilot-salt"); 
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [autoLockTimeout, setAutoLockTimeoutState] = useState(5); // Default 5 mins
  const [mounted, setMounted] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Initialize from localStorage
  useEffect(() => {
    const pinHash = localStorage.getItem("app_pin_hash");
    const timeout = localStorage.getItem("app_lock_timeout");
    
    if (pinHash) {
      setHasPin(true);
      setIsLocked(true); // Lock on load if PIN exists
    }
    
    if (timeout) {
      setAutoLockTimeoutState(parseInt(timeout, 10));
    }
    
    setMounted(true);
  }, []);

  const lock = useCallback(() => {
    if (hasPin) setIsLocked(true);
  }, [hasPin]);

  const unlock = useCallback(async (pin: string) => {
    const pinHash = localStorage.getItem("app_pin_hash");
    if (!pinHash) return true;

    const inputHash = await hashPin(pin);
    if (inputHash === pinHash) {
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      return true;
    }
    return false;
  }, []);

  const setPin = useCallback(async (pin: string) => {
    const hash = await hashPin(pin);
    localStorage.setItem("app_pin_hash", hash);
    setHasPin(true);
  }, []);

  const clearPin = useCallback(() => {
    localStorage.removeItem("app_pin_hash");
    setHasPin(false);
    setIsLocked(false);
  }, []);

  const setAutoLockTimeout = useCallback((minutes: number) => {
    setAutoLockTimeoutState(minutes);
    localStorage.setItem("app_lock_timeout", String(minutes));
  }, []);

  // Inactivity and Background Locking
  useEffect(() => {
    if (!hasPin || isLocked) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = setInterval(() => {
      if (autoLockTimeout === 0) return; // Never lock
      
      const now = Date.now();
      if (now - lastActivityRef.current > autoLockTimeout * 60 * 1000) {
        lock();
      }
    }, 10000); // Check every 10s

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Optional: lock immediately or after short delay when backgrounded
        // For now, let's just update activity
        lastActivityRef.current = Date.now();
      }
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(checkInactivity);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasPin, isLocked, autoLockTimeout, lock]);

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        hasPin,
        lock,
        unlock,
        setPin,
        clearPin,
        autoLockTimeout,
        setAutoLockTimeout,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error("useSecurity must be used within a SecurityProvider");
  }
  return context;
}
