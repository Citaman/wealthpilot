import { addDays, differenceInDays, format, parseISO, subDays } from "date-fns";
import type { GoalContribution } from "@/lib/db";

export function computeGoalForecast(params: {
  contributions: GoalContribution[];
  currentAmount: number;
  targetAmount: number;
  deadline?: string;
  now?: Date;
  lookbackDays?: number;
}): {
  averageMonthlyNet: number | null;
  estimatedReachDate: string | null; // YYYY-MM-DD
  requiredMonthlyForDeadline: number | null;
} {
  const now = params.now ?? new Date();
  const lookbackDays = params.lookbackDays ?? 90;

  const remaining = params.targetAmount - params.currentAmount;
  if (!(remaining > 0)) {
    return {
      averageMonthlyNet: null,
      estimatedReachDate: null,
      requiredMonthlyForDeadline: null,
    };
  }

  // Deadline-based requirement
  let requiredMonthlyForDeadline: number | null = null;
  if (params.deadline) {
    const daysLeft = differenceInDays(parseISO(params.deadline), now);
    if (daysLeft > 0) {
      requiredMonthlyForDeadline = remaining / (daysLeft / 30);
    }
  }

  // History-based forecast (net contributions over lookback)
  const cutoff = subDays(now, lookbackDays);
  const recent = params.contributions
    .filter((c) => {
      const d = parseISO(c.date);
      return d >= cutoff && d <= now;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt.localeCompare(b.createdAt);
    });

  if (recent.length < 2) {
    return {
      averageMonthlyNet: null,
      estimatedReachDate: null,
      requiredMonthlyForDeadline,
    };
  }

  const firstDate = parseISO(recent[0].date);
  const lastDate = parseISO(recent[recent.length - 1].date);
  const spanDays = Math.max(1, differenceInDays(lastDate, firstDate));

  // Avoid super-noisy estimates from same-day contributions.
  if (spanDays < 14) {
    return {
      averageMonthlyNet: null,
      estimatedReachDate: null,
      requiredMonthlyForDeadline,
    };
  }

  const net = recent.reduce((sum, c) => sum + c.amount, 0);
  const averageMonthlyNet = (net / spanDays) * 30;

  if (!(averageMonthlyNet > 0)) {
    return {
      averageMonthlyNet: null,
      estimatedReachDate: null,
      requiredMonthlyForDeadline,
    };
  }

  const months = remaining / averageMonthlyNet;
  const daysToReach = Math.ceil(months * 30);
  const estimatedReachDate = format(addDays(now, daysToReach), "yyyy-MM-dd");

  return {
    averageMonthlyNet,
    estimatedReachDate,
    requiredMonthlyForDeadline,
  };
}
