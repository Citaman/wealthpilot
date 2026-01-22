"use client";

import { cn } from "@/lib/utils";

type PilotOrbProps = {
  className?: string;
};

export function PilotOrb({ className }: PilotOrbProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("h-6 w-6 text-primary", className)}
      fill="none"
    >
      <circle cx="16" cy="16" r="12" fill="currentColor" opacity="0.14" />
      <circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 6c2.9 0 5.5 1.2 7.4 3.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="22.5" cy="9.5" r="2.3" fill="currentColor" />
    </svg>
  );
}
