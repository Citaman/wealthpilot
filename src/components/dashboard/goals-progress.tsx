"use client";

import { Target, Plus, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { CircularProgress } from "@/components/ui/circular-progress";
import type { Goal } from "@/lib/db";
import Link from "next/link";

interface GoalsProgressProps {
  goals: Goal[];
  onAddClick?: () => void;
}

export function GoalsProgress({ goals, onAddClick }: GoalsProgressProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const activeGoals = goals
    .filter((g) => g.isActive)
    .sort((a, b) => {
      // Sort by completion percentage descending
      const aProgress = (a.currentAmount / a.targetAmount) * 100;
      const bProgress = (b.currentAmount / b.targetAmount) * 100;
      return bProgress - aProgress;
    })
    .slice(0, 3);

  // Calculate total progress
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-5 w-5" />
            Savings Goals
          </CardTitle>
          {onAddClick && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onAddClick}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No savings goals yet
            </p>
            {onAddClick && (
              <Button variant="outline" size="sm" onClick={onAddClick}>
                <Plus className="mr-2 h-4 w-4" />
                Create Goal
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Goals with circular progress */}
            <div className="space-y-3">
              {activeGoals.map((goal) => {
                const progress = (goal.currentAmount / goal.targetAmount) * 100;
                const isComplete = progress >= 100;

                return (
                  <div 
                    key={goal.id} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <CircularProgress 
                      progress={progress} 
                      color={goal.color}
                      size={50}
                      strokeWidth={4}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{goal.name}</span>
                        {isComplete && (
                          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <PrivacyBlur>{formatCurrency(goal.currentAmount)}</PrivacyBlur> of <PrivacyBlur>{formatCurrency(goal.targetAmount)}</PrivacyBlur>
                      </p>
                    </div>
                    {!isComplete && (
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          <PrivacyBlur>{formatCurrency(goal.targetAmount - goal.currentAmount)}</PrivacyBlur>
                        </p>
                        <p className="text-[10px] text-muted-foreground">left</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall summary */}
            {activeGoals.length > 1 && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total saved</span>
                  <span className="font-semibold">
                    <PrivacyBlur>{formatCurrency(totalSaved)}</PrivacyBlur>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                  <span>Overall progress</span>
                  <span>{overallProgress.toFixed(0)}%</span>
                </div>
              </div>
            )}

            {/* Link to goals page */}
            <Link 
              href="/goals" 
              className="flex items-center justify-center gap-1 text-xs text-primary hover:underline pt-1"
            >
              Manage all goals
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
