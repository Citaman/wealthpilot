"use client";

import { usePrivacy } from "@/contexts";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PrivacyBlurProps {
  children: ReactNode;
  className?: string;
  /** 
   * 'inline' (default): blurs the text itself
   * 'block': blurs the entire container
   */
  display?: "inline" | "block";
}

export function PrivacyBlur({ children, className, display = "inline" }: PrivacyBlurProps) {
  const { isPrivacyMode } = usePrivacy();

  if (!isPrivacyMode) return <>{children}</>;

  return (
    <span
      className={cn(
        "blur-[8px] select-none pointer-events-none opacity-40 transition-all duration-300",
        display === "inline" ? "inline-block" : "block w-full h-full",
        className
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
