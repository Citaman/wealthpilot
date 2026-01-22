"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PilotOrb } from "@/components/brand/pilot-orb";

type EmptyAction = {
  label: string;
  onClick: () => void;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  primaryAction?: EmptyAction;
  secondaryAction?: EmptyAction;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-border/70 bg-card/80 px-6 py-12 text-center shadow-[0_20px_60px_-40px_rgba(11,17,24,0.4)]",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        {icon || <PilotOrb className="h-7 w-7" />}
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {primaryAction && (
            <Button onClick={primaryAction.onClick} className="gap-2">
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
