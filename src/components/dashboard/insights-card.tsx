"use client";

import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Lightbulb,
  Info,
  X 
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Insight } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface InsightsCardProps {
  insights: Insight[];
}

const INSIGHT_ICONS = {
  warning: AlertTriangle,
  success: TrendingUp,
  info: Info,
  tip: Lightbulb,
};

const INSIGHT_COLORS = {
  warning: "text-amber-600 bg-amber-500/10",
  success: "text-emerald-600 bg-emerald-500/10",
  info: "text-blue-600 bg-blue-500/10",
  tip: "text-purple-600 bg-purple-500/10",
};

export function InsightsCard({ insights }: InsightsCardProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visibleInsights = insights.filter((i) => !dismissed.includes(i.id));

  const handleDismiss = (id: string) => {
    setDismissed((prev) => [...prev, id]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Financial Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {visibleInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lightbulb className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No insights available yet. Import more transaction data to receive personalized tips.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleInsights.slice(0, 5).map((insight) => {
              const IconComponent = INSIGHT_ICONS[insight.type];
              const colorClasses = INSIGHT_COLORS[insight.type];

              return (
                <div
                  key={insight.id}
                  className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                      colorClasses
                    )}
                  >
                    <IconComponent className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{insight.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {insight.description}
                    </p>
                    {insight.action && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mt-2"
                        asChild
                      >
                        <a href={insight.action.href}>
                          {insight.action.label}
                        </a>
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 flex-shrink-0"
                    onClick={() => handleDismiss(insight.id)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Dismiss</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
