"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InlineErrorProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
};

export function InlineError({ title = "Something went wrong", message, onRetry, className }: InlineErrorProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive",
        className
      )}
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4" />
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-destructive/80">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
