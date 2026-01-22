"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Account } from "@/lib/db";
import { Money } from "@/components/ui/money";

interface BalanceCardProps {
  totalBalance: number;
  accounts: Account[];
  selectedAccountId?: number | "all";
  onSelectAccount?: (id: number | "all") => void;
}

export function BalanceCard({
  totalBalance,
  accounts,
  selectedAccountId = "all",
  onSelectAccount,
}: BalanceCardProps) {
  const [carouselIndex, setCarouselIndex] = useState(0);

  const handlePrev = () => {
    setCarouselIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCarouselIndex((prev) => Math.min(accounts.length - 3, prev + 1));
  };

  const visibleAccounts = accounts.slice(carouselIndex, carouselIndex + 3);
  const canGoBack = carouselIndex > 0;
  const canGoForward = carouselIndex < accounts.length - 3;

  const isPositive = totalBalance >= 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          My Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {/* Total Balance */}
        <div className="text-center py-2">
          <p className="text-sm text-muted-foreground">
            {selectedAccountId === "all" ? "Total Balance" : "Account Balance"}
          </p>
          <p
            className={cn(
              "text-4xl font-bold tracking-tight",
              isPositive ? "text-foreground" : "text-red-600"
            )}
          >
            <Money amount={totalBalance} />
          </p>
        </div>

        {/* Account Cards Carousel */}
        {accounts.length > 0 && (
          <div className="relative">
            <div className="flex items-center gap-2">
              {accounts.length > 3 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handlePrev}
                  disabled={!canGoBack}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              
              <div className="flex gap-2 overflow-hidden flex-1">
                {visibleAccounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => onSelectAccount?.(account.id!)}
                    className={cn(
                      "flex-1 min-w-0 p-3 rounded-xl border-2 transition-all text-left",
                      selectedAccountId === account.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: account.color }}
                      />
                      <span className="text-xs font-medium truncate">
                        {account.name}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        account.balance >= 0 ? "" : "text-red-600"
                      )}
                    >
                      <Money amount={account.balance} currency={account.currency} />
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {account.type}
                    </p>
                  </button>
                ))}
              </div>

              {accounts.length > 3 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleNext}
                  disabled={!canGoForward}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* View All Button */}
            {selectedAccountId !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs"
                onClick={() => onSelectAccount?.("all")}
              >
                View All Accounts
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
