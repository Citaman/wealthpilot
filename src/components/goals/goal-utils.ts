import type React from "react";
import {
  Baby,
  Car,
  Home,
  PiggyBank,
  Plane,
  Shield,
  Target,
  Trophy,
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import type { Goal, GoalContribution } from "@/lib/db";
import { computeGoalForecast } from "@/lib/goals";

export function formatCurrency0(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getGoalIcon(goal: Pick<Goal, "icon" | "name">): React.ElementType {
  const key = (goal.icon || "").toLowerCase();
  if (key.includes("shield")) return Shield;
  if (key.includes("car")) return Car;
  if (key.includes("plane")) return Plane;
  if (key.includes("home")) return Home;
  if (key.includes("baby") || key.includes("child")) return Baby;

  const name = (goal.name || "").toLowerCase();
  if (name.includes("emergency")) return Shield;
  if (name.includes("vacation") || name.includes("trip")) return Plane;
  if (name.includes("car")) return Car;
  if (name.includes("house") || name.includes("home")) return Home;
  if (name.includes("child")) return Baby;

  return Target;
}

export function getGoalProgress(goal: Pick<Goal, "currentAmount" | "targetAmount">): number {
  if (!(goal.targetAmount > 0)) return 0;
  return (goal.currentAmount / goal.targetAmount) * 100;
}

export type GoalHealth = "completed" | "onTrack" | "atRisk" | "needsData";

export function getGoalHealth(params: {
  goal: Goal;
  contributions: GoalContribution[];
  now?: Date;
}): {
  health: GoalHealth;
  label: string;
  hint: string;
  badgeClassName: string;
  deadlineDaysLeft: number | null;
  forecast: ReturnType<typeof computeGoalForecast>;
} {
  const now = params.now ?? new Date();
  const progress = getGoalProgress(params.goal);

  const deadlineDaysLeft = params.goal.deadline
    ? differenceInDays(parseISO(params.goal.deadline), now)
    : null;

  const forecast = computeGoalForecast({
    contributions: params.contributions,
    currentAmount: params.goal.currentAmount,
    targetAmount: params.goal.targetAmount,
    deadline: params.goal.deadline,
    now,
  });

  if (progress >= 100 || params.goal.currentAmount >= params.goal.targetAmount) {
    return {
      health: "completed",
      label: "Completed",
      hint: "Target reached",
      badgeClassName:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      deadlineDaysLeft,
      forecast,
    };
  }

  const hasForecast = !!forecast.averageMonthlyNet || !!forecast.requiredMonthlyForDeadline;

  // Deadline logic: if there is a deadline and we can compute both numbers, compare them.
  if (forecast.requiredMonthlyForDeadline && forecast.averageMonthlyNet) {
    if (forecast.averageMonthlyNet + 1e-9 < forecast.requiredMonthlyForDeadline) {
      return {
        health: "atRisk",
        label: "At risk",
        hint: "Below pace for deadline",
        badgeClassName:
          "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
        deadlineDaysLeft,
        forecast,
      };
    }

    return {
      health: "onTrack",
      label: "On track",
      hint: "Pace looks good",
      badgeClassName:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      deadlineDaysLeft,
      forecast,
    };
  }

  // If deadline is soon but we don't have forecasting, warn.
  if (deadlineDaysLeft !== null && deadlineDaysLeft <= 30) {
    return {
      health: "atRisk",
      label: "At risk",
      hint: deadlineDaysLeft < 0 ? "Overdue" : "Deadline is close",
      badgeClassName:
        "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      deadlineDaysLeft,
      forecast,
    };
  }

  if (!hasForecast) {
    return {
      health: "needsData",
      label: "No forecast",
      hint: "Add a few contributions over time",
      badgeClassName:
        "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
      deadlineDaysLeft,
      forecast,
    };
  }

  return {
    health: "onTrack",
    label: "On track",
    hint: "Tracking",
    badgeClassName:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    deadlineDaysLeft,
    forecast,
  };
}

export function getGoalCelebrationIcon(health: GoalHealth): React.ElementType | null {
  if (health === "completed") return Trophy;
  if (health === "onTrack") return PiggyBank;
  return null;
}
