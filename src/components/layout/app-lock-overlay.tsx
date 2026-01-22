"use client";

import { useState, useEffect } from "react";
import { useSecurity } from "@/contexts";
import { Lock, Delete, ArrowRight, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppLockOverlay() {
  const { isLocked, unlock } = useSecurity();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Reset pin if error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(false);
        setPin("");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isLocked) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < 4) return;
    
    setIsVerifying(true);
    const success = await unlock(pin);
    if (!success) {
      setError(true);
    }
    setIsVerifying(false);
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLocked) return;
      if (e.key >= "0" && e.key <= "9") handleKeyPress(e.key);
      if (e.key === "Backspace") handleDelete();
      if (e.key === "Enter") handleSubmit();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocked, pin]);

  // Auto submit if pin length is 4 or 6 (optional logic)
  useEffect(() => {
    if (pin.length === 4 || pin.length === 6) {
      // In a real app, you might want to wait for "Enter" or auto-submit
      // Let's stick to manual Enter or click for better UX feedback
    }
  }, [pin]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="flex flex-col items-center max-w-sm w-full px-6 text-center">
        {/* Logo/Icon */}
        <div className="mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20">
            <TrendingUp className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">WealthPilot Locked</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your PIN to continue</p>
        </div>

        {/* PIN Display */}
        <div className="flex gap-3 mb-12">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-all duration-200",
                pin.length > i ? "bg-primary border-primary scale-110" : "border-muted-foreground/30",
                error && "border-destructive bg-destructive animate-bounce"
              )}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <Button
              key={num}
              variant="outline"
              size="lg"
              className="h-16 w-16 rounded-full text-xl font-medium border-muted-foreground/10 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => handleKeyPress(num)}
            >
              {num}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="lg"
            className="h-16 w-16 rounded-full text-muted-foreground"
            onClick={handleDelete}
          >
            <Delete className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-16 w-16 rounded-full text-xl font-medium border-muted-foreground/10"
            onClick={() => handleKeyPress("0")}
          >
            0
          </Button>
          <Button
            variant="default"
            size="lg"
            className="h-16 w-16 rounded-full shadow-lg shadow-primary/20"
            onClick={handleSubmit}
            disabled={pin.length < 4 || isVerifying}
          >
            <ArrowRight className="h-6 w-6" />
          </Button>
        </div>

        {error && (
          <p className="mt-6 text-sm font-medium text-destructive animate-pulse">
            Incorrect PIN. Please try again.
          </p>
        )}

        <div className="mt-12">
          <p className="text-xs text-muted-foreground max-w-[200px]">
            WealthPilot uses on-device encryption. Your PIN never leaves this device.
          </p>
        </div>
      </div>
    </div>
  );
}
