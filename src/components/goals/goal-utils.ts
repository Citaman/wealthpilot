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
      label: "Terminé",
      hint: "Cible atteinte",
      badgeClassName:
        "border-muted bg-muted/30 text-foreground",
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
        label: "À risque",
        hint: "Rythme insuffisant pour l’échéance",
        badgeClassName:
          "border-[#FF6B4A]/20 bg-[#FF6B4A]/10 text-foreground",
        deadlineDaysLeft,
        forecast,
      };
    }

    return {
      health: "onTrack",
      label: "En bonne voie",
      hint: "Rythme adapté",
      badgeClassName:
        "border-muted bg-muted/30 text-foreground",
      deadlineDaysLeft,
      forecast,
    };
  }

  // If deadline is soon but we don't have forecasting, warn.
  if (deadlineDaysLeft !== null && deadlineDaysLeft <= 30) {
    return {
      health: "atRisk",
      label: "À risque",
      hint: deadlineDaysLeft < 0 ? "Échéance dépassée" : "Échéance proche",
      badgeClassName:
        "border-[#FF6B4A]/20 bg-[#FF6B4A]/10 text-foreground",
      deadlineDaysLeft,
      forecast,
    };
  }

  if (!hasForecast) {
    return {
      health: "needsData",
      label: "Projection indisponible",
      hint: "Ajoutez quelques mouvements pour obtenir une projection",
      badgeClassName:
        "border-muted bg-muted/30 text-muted-foreground",
      deadlineDaysLeft,
      forecast,
    };
  }

  return {
    health: "onTrack",
    label: "En bonne voie",
    hint: "Suivi en cours",
    badgeClassName:
      "border-muted bg-muted/30 text-foreground",
    deadlineDaysLeft,
    forecast,
  };
}

export function getGoalCelebrationIcon(health: GoalHealth): React.ElementType | null {
  if (health === "completed") return Trophy;
  if (health === "onTrack") return PiggyBank;
  return null;
}
