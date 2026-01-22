"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Calendar,
  Edit2,
  MoreVertical,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";

import type { Goal, GoalContribution } from "@/lib/db";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  formatCurrency0,
  getGoalHealth,
  getGoalIcon,
  getGoalProgress,
} from "@/components/goals/goal-utils";

export function GoalCard(props: {
  goal: Goal;
  contributions: GoalContribution[];
  onEdit: (goal: Goal) => void;
  onDelete: (goalId: number) => void;
  onAddContribution: (goalId: number) => void;
  className?: string;
}) {
  const { goal } = props;

  const summary = useMemo(() => {
    const progress = Math.min(getGoalProgress(goal), 100);
    const remaining = goal.targetAmount - goal.currentAmount;

    const status = getGoalHealth({ goal, contributions: props.contributions });

    const recent = [...props.contributions]
      .sort((a, b) => (a.date !== b.date ? b.date.localeCompare(a.date) : b.createdAt.localeCompare(a.createdAt)))
      .slice(0, 2);

    return { progress, remaining, status, recent };
  }, [goal, props.contributions]);

  const Icon = getGoalIcon(goal);

  return (
    <Card className={cn("group relative overflow-hidden border bg-card transition-shadow hover:shadow-md", props.className)}>
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: goal.color }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at 20% 0%, rgba(59,130,246,0.08), transparent 40%), radial-gradient(600px circle at 80% 20%, rgba(16,185,129,0.06), transparent 40%)",
        }}
      />

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${goal.color}20` }}
              >
                <Icon className="h-5 w-5" style={{ color: goal.color }} />
              </div>
              <div className="min-w-0">
                <Link
                  href={`/goals/${goal.id}`}
                  className="block truncate text-base font-semibold tracking-tight hover:underline"
                >
                  {goal.name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge className={cn("border", summary.status.badgeClassName)} variant="outline">
                    {summary.status.label}
                  </Badge>
                  {goal.deadline && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {summary.status.deadlineDaysLeft !== null ? (
                        summary.status.deadlineDaysLeft > 0
                          ? `Due in ${summary.status.deadlineDaysLeft}d`
                          : summary.status.deadlineDaysLeft === 0
                            ? "Due today"
                            : "Overdue"
                      ) : (
                        "Deadline"
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => props.onAddContribution(goal.id!)}>
                <Plus className="mr-2 h-4 w-4" />
                Add contribution
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.onEdit(goal)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit goal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => props.onDelete(goal.id!)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Saved</p>
            <p className="truncate text-2xl font-bold">
              <PrivacyBlur>{formatCurrency0(goal.currentAmount)}</PrivacyBlur>
            </p>
            <p className="text-xs text-muted-foreground">
              of <PrivacyBlur>{formatCurrency0(goal.targetAmount)}</PrivacyBlur> · {summary.progress.toFixed(0)}%
            </p>
          </div>
          <CircularProgress progress={summary.progress} color={goal.color} size={78} strokeWidth={6} />
        </div>

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="font-semibold">
                <PrivacyBlur>{formatCurrency0(Math.max(0, summary.remaining))}</PrivacyBlur>
              </p>
              <p className="text-xs text-muted-foreground">{summary.status.hint}</p>
            </div>
            {(summary.status.forecast.requiredMonthlyForDeadline || summary.status.forecast.averageMonthlyNet) && (
              <div className="text-right text-xs">
                {summary.status.forecast.requiredMonthlyForDeadline && (
                  <p>
                    <span className="text-muted-foreground">Need</span>{" "}
                    <span className="font-semibold">
                      <PrivacyBlur>{formatCurrency0(summary.status.forecast.requiredMonthlyForDeadline)}</PrivacyBlur>/mo
                    </span>
                  </p>
                )}
                {summary.status.forecast.averageMonthlyNet && (
                  <p className="text-muted-foreground">
                    Pace ~<PrivacyBlur>{formatCurrency0(summary.status.forecast.averageMonthlyNet)}</PrivacyBlur>/mo
                  </p>
                )}
              </div>
            )}
          </div>

          {summary.status.forecast.estimatedReachDate && (
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Est. reach
              </span>
              <span className="font-medium text-foreground">
                {format(parseISO(summary.status.forecast.estimatedReachDate), "MMM yyyy")}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => props.onAddContribution(goal.id!)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
          <Button variant="ghost" asChild className="flex-1">
            <Link href={`/goals/${goal.id}`}>Details</Link>
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Recent activity</p>
          {summary.recent.length === 0 ? (
            <p className="text-xs text-muted-foreground">No contributions yet.</p>
          ) : (
            <ul className="space-y-1">
              {summary.recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-muted-foreground">
                    {c.note ? c.note : c.amount >= 0 ? "Deposit" : "Withdrawal"}
                  </span>
                  <span className={cn("font-medium", c.amount >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {c.amount >= 0 ? "+" : "-"}
                    <PrivacyBlur>{formatCurrency0(Math.abs(c.amount))}</PrivacyBlur>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
