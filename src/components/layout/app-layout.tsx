"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { CommandDock } from "./command-dock";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

const pageMeta: Record<string, { title: string; subtitle?: string }> = {
  "/": { title: "Dashboard", subtitle: "Your financial command center" },
  "/transactions": { title: "Transactions", subtitle: "Review and tune your activity" },
  "/analytics": { title: "Analytics", subtitle: "Trends, forecasts, and signals" },
  "/budgets": { title: "Budgets", subtitle: "Plan with confidence" },
  "/goals": { title: "Goals", subtitle: "Build toward the future" },
  "/subscriptions": { title: "Subscriptions", subtitle: "Recurring commitments" },
  "/accounts": { title: "Accounts", subtitle: "Balances and checkpoints" },
  "/import": { title: "Import", subtitle: "Bring your transactions in" },
  "/settings": { title: "Settings", subtitle: "Preferences and system status" },
  "/calendar": { title: "Calendar", subtitle: "Bills and cash flow timing" },
  "/categories": { title: "Categories", subtitle: "Organize how you spend" },
};

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const meta = useMemo(() => pageMeta[pathname || "/"], [pathname]);

  return (
    <div className="relative min-h-screen">
      <div className="relative">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(44,177,188,0.12),_transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(107,182,255,0.12),_transparent_45%)]" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pb-32 pt-6 sm:px-6">
          {meta && pathname !== "/" && (
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  WealthPilot
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-foreground">{meta.title}</h1>
                {meta.subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
                )}
              </div>
            </div>
          )}
          <main className={cn("animate-float-in")}>{children}</main>
        </div>
      </div>
      <CommandDock />
    </div>
  );
}
