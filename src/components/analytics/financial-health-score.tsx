import { useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { Activity, CheckCircle, ShieldCheck, AlertTriangle, Info, TrendingUp, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { db, type Transaction } from "@/lib/db";
import { calculateAdvancedHealthMetrics } from "@/lib/analytics";
import { PrivacyBlur } from "@/components/ui/privacy-blur";

interface FinancialHealthScoreProps {
  transactions: Transaction[];
  currentBalance: number;
  accounts: any[];
  className?: string;
}

interface ScoreBreakdown {
  name: string;
  score: number;
  maxScore: number;
  description: string;
  status: "good" | "warning" | "bad";
}

export function FinancialHealthScore({
  transactions,
  currentBalance,
  accounts,
  className,
}: FinancialHealthScoreProps) {
  const [simulationValue, setSimulationValue] = useState(0);

  const { overallScore, breakdown, tips, advancedMetrics, simulatedSavingsRate } = useMemo(() => {
    const now = new Date();
    const threeMonthsAgo = format(subMonths(now, 3), "yyyy-MM-dd");

    const last3MonthsTx = transactions.filter((t) => t.date >= threeMonthsAgo);
    const advanced = calculateAdvancedHealthMetrics(last3MonthsTx, accounts, transactions);

    // Filter transactions for this month
    const thisMonth = format(now, "yyyy-MM");
    const thisMonthTx = transactions.filter((t) => t.date.startsWith(thisMonth));

    // Calculate metrics
    const thisMonthIncome = thisMonthTx
      .filter((t) => t.direction === "credit")
      .reduce((s, t) => s + t.amount, 0);
    const thisMonthExpenses = thisMonthTx
      .filter((t) => t.direction === "debit")
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const avgMonthlyIncome = advanced.recentIncome || thisMonthIncome || 1;
    const avgMonthlyExpenses = last3MonthsTx
      .filter((t) => t.direction === "debit")
      .reduce((s, t) => s + Math.abs(t.amount), 0) / 3;

    // Score calculations (out of 100)
    const scores: ScoreBreakdown[] = [];

    // 1. Savings Rate (0-20 points)
    const baseSavingsRate = avgMonthlyIncome > 0 
      ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100 
      : 0;
    
    // Simulation effect
    const simulatedSavings = (avgMonthlyIncome - avgMonthlyExpenses) + simulationValue;
    const currentSimulatedSavingsRate = avgMonthlyIncome > 0 ? (simulatedSavings / avgMonthlyIncome) * 100 : 0;
    
    const displaySavingsRate = currentSimulatedSavingsRate;
    
    let savingsScore = 0;
    let savingsStatus: "good" | "warning" | "bad" = "bad";
    if (displaySavingsRate >= 30) { savingsScore = 20; savingsStatus = "good"; }
    else if (displaySavingsRate >= 15) { savingsScore = 15; savingsStatus = "good"; }
    else if (displaySavingsRate >= 5) { savingsScore = 10; savingsStatus = "warning"; }
    scores.push({
      name: "Savings Rate",
      score: savingsScore,
      maxScore: 20,
      description: `${displaySavingsRate.toFixed(0)}% of income saved`,
      status: savingsStatus,
    });

    // 2. Emergency Fund (0-20 points)
    const monthsOfExpenses = avgMonthlyExpenses > 0 
      ? currentBalance / avgMonthlyExpenses 
      : 0;
    let emergencyScore = 0;
    let emergencyStatus: "good" | "warning" | "bad" = "bad";
    if (monthsOfExpenses >= 6) { emergencyScore = 20; emergencyStatus = "good"; }
    else if (monthsOfExpenses >= 3) { emergencyScore = 15; emergencyStatus = "good"; }
    else if (monthsOfExpenses >= 1) { emergencyScore = 8; emergencyStatus = "warning"; }
    scores.push({
      name: "Emergency Fund",
      score: emergencyScore,
      maxScore: 20,
      description: `${monthsOfExpenses.toFixed(1)} months of expenses covered`,
      status: emergencyStatus,
    });

    // 3. Debt-to-Income Ratio (0-20 points)
    let dtiScore = 0;
    let dtiStatus: "good" | "warning" | "bad" = "bad";
    if (advanced.debtToIncomeRatio <= 15) { dtiScore = 20; dtiStatus = "good"; }
    else if (advanced.debtToIncomeRatio <= 35) { dtiScore = 15; dtiStatus = "good"; }
    else if (advanced.debtToIncomeRatio <= 50) { dtiScore = 10; dtiStatus = "warning"; }
    scores.push({
      name: "Debt Health (DTI)",
      score: dtiScore,
      maxScore: 20,
      description: advanced.debtToIncomeRatio === 0 ? "No debt detected" : `DTI is ${advanced.debtToIncomeRatio.toFixed(0)}%`,
      status: dtiStatus,
    });

    // 4. Net Worth Trend (0-20 points)
    let trendScore = 0;
    let trendStatus: "good" | "warning" | "bad" = "bad";
    const growthWithSimulation = advanced.avgMonthlyGrowth + (simulationValue / 3); // Spreading simulation over growth
    if (growthWithSimulation > 500) { trendScore = 20; trendStatus = "good"; }
    else if (growthWithSimulation > 0) { trendScore = 15; trendStatus = "good"; }
    else if (growthWithSimulation > -200) { trendScore = 8; trendStatus = "warning"; }
    scores.push({
      name: "Net Worth Trend",
      score: trendScore,
      maxScore: 20,
      description: growthWithSimulation >= 0 ? "Wealth is growing" : "Wealth decreased recently",
      status: trendStatus,
    });

    // 5. Balanced Spending (0-20 points)
    const categorySpending = new Map<string, number>();
    thisMonthTx
      .filter((t) => t.direction === "debit")
      .forEach((t) => {
        categorySpending.set(t.category, (categorySpending.get(t.category) || 0) + Math.abs(t.amount));
      });
    const maxCategoryPct = thisMonthExpenses > 0
      ? Math.max(...Array.from(categorySpending.values()), 0) / thisMonthExpenses * 100
      : 0;
    let diversificationScore = 0;
    let diversificationStatus: "good" | "warning" | "bad" = "bad";
    if (maxCategoryPct <= 35) { diversificationScore = 20; diversificationStatus = "good"; }
    else if (maxCategoryPct <= 50) { diversificationScore = 15; diversificationStatus = "warning"; }
    else { diversificationScore = 10; }
    scores.push({
      name: "Balanced Spending",
      score: diversificationScore,
      maxScore: 20,
      description: maxCategoryPct <= 40 ? "Healthy diversification" : "Highly concentrated spending",
      status: diversificationStatus,
    });

    const total = scores.reduce((s, b) => s + b.score, 0);

    const generatedTips: string[] = [];
    [...scores].sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore)).forEach((s) => {
      if (s.status !== "good") {
        if (s.name.includes("Savings")) generatedTips.push("Aim for a 20% savings rate to accelerate wealth.");
        if (s.name.includes("Emergency")) generatedTips.push("Build a 3-month cash buffer for financial peace.");
        if (s.name.includes("Debt")) generatedTips.push("Prioritize paying off high-interest credit debt.");
        if (s.name.includes("Trend")) generatedTips.push("Consistent monthly investing grows your net worth.");
      }
    });

    return { 
      overallScore: total, 
      breakdown: scores, 
      tips: generatedTips.slice(0, 2),
      advancedMetrics: advanced,
      simulatedSavingsRate: currentSimulatedSavingsRate
    };
  }, [transactions, currentBalance, accounts, simulationValue]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 40) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    if (score >= 60) return <ShieldCheck className="h-5 w-5 text-blue-500" />;
    if (score >= 40) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  };

  const statusColors = {
    good: "text-emerald-500",
    warning: "text-amber-500",
    bad: "text-red-500",
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Financial Health Score
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Calculated based on 5 key pillars of financial wellness over the last 3 months.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>Overall assessment of your finances</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Score */}
        <div className="flex items-center justify-center gap-4 py-4 border-b">
          <div className="relative h-24 w-24">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-muted stroke-current"
                strokeWidth="8"
                fill="none"
                r="42"
                cx="50"
                cy="50"
              />
              <circle
                className={cn("stroke-current transition-all duration-1000", getScoreColor(overallScore))}
                strokeWidth="8"
                strokeLinecap="round"
                fill="none"
                r="42"
                cx="50"
                cy="50"
                strokeDasharray={`${overallScore * 2.64} 264`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold", getScoreColor(overallScore))}>
                <PrivacyBlur>{overallScore}</PrivacyBlur>
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              {getScoreIcon(overallScore)}
              <span className={cn("text-lg font-semibold", getScoreColor(overallScore))}>
                {getScoreLabel(overallScore)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {simulationValue !== 0 ? "Projected monthly score" : "Based on your last 3 months"}
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          {breakdown.map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.name}</span>
                <span className={cn("font-semibold", statusColors[item.status])}>
                  {item.score}/{item.maxScore}
                </span>
              </div>
              <Progress
                value={(item.score / item.maxScore) * 100}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Interactive Simulation */}
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Intelligence Simulator
            </h4>
            <span className="text-xs font-mono font-bold text-primary">
              {simulationValue >= 0 ? "+" : ""}{simulationValue}€ / mo
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            "What if I save an extra {simulationValue}€ every month?"
          </p>
          <Slider
            value={[simulationValue]}
            min={-500}
            max={2000}
            step={50}
            onValueChange={(val) => setSimulationValue(val[0])}
            className="mb-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Spend +500€</span>
            <span>Save +2000€</span>
          </div>
        </div>

        {/* Peer Comparison (Benchmarks) */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-blue-500" />
            Financial Benchmarks
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs">
              <span className="text-muted-foreground">Savings Rate</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{simulatedSavingsRate.toFixed(0)}%</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1 rounded">Target: 20%</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-muted/50 text-xs">
              <span className="text-muted-foreground">DTI Ratio</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{advancedMetrics.debtToIncomeRatio.toFixed(0)}%</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1 rounded">Benchmark: &lt;36%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        {tips.length > 0 && simulationValue === 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
              💡 Improvement Tips
            </h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {tips.map((tip, idx) => (
                <li key={idx}>• {tip}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
