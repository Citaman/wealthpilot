"use client";

import { useState } from "react";
import { Edit2, Check, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PrivacyBlur } from "@/components/ui/privacy-blur";
import { CATEGORIES } from "@/lib/db";
import { cn } from "@/lib/utils";

interface CategoryBudgetCardProps {
  category: string;
  budget: number;
  spent: number;
  previousSpent?: number;
  onBudgetChange: (category: string, amount: number) => Promise<void>;
}

// Circular progress ring
function ProgressRing({ 
  progress, 
  color, 
  size = 48,
  strokeWidth = 4,
}: { 
  progress: number; 
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;
  const isOver = progress > 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isOver ? "#ef4444" : color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          "text-xs font-bold",
          isOver && "text-red-500"
        )}>
          {Math.round(Math.min(progress, 999))}%
        </span>
      </div>
    </div>
  );
}

export function CategoryBudgetCard({
  category,
  budget,
  spent,
  previousSpent,
  onBudgetChange,
}: CategoryBudgetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(budget.toString());
  const [isSaving, setIsSaving] = useState(false);

  const info = CATEGORIES[category];
  const IconComponent = info?.icon;
  const color = info?.color || "#6b7280";

  const progress = budget > 0 ? (spent / budget) * 100 : 0;
  const remaining = budget - spent;
  const isOver = remaining < 0;

  // Change vs previous month
  const change = previousSpent !== undefined && previousSpent > 0
    ? ((spent - previousSpent) / previousSpent) * 100
    : undefined;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSave = async () => {
    const amount = parseFloat(editValue);
    if (!isNaN(amount) && amount >= 0) {
      setIsSaving(true);
      await onBudgetChange(category, amount);
      setIsSaving(false);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(budget.toString());
    setIsEditing(false);
  };

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-xl border transition-all",
      "hover:shadow-sm hover:border-primary/20",
      isOver && "border-red-500/30 bg-red-500/5"
    )}>
      {/* Category Icon */}
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
        style={{
          backgroundColor: `${color}15`,
          color: color,
        }}
      >
        {IconComponent && <IconComponent className="h-6 w-6" />}
      </div>

      {/* Progress Ring */}
      <ProgressRing progress={progress} color={color} size={48} strokeWidth={4} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold truncate">{category}</span>
          {change !== undefined && (
            <Badge variant="outline" className={cn(
              "text-[10px] px-1.5 py-0",
              change > 10 ? "text-red-500 border-red-500/30" :
              change < -10 ? "text-emerald-500 border-emerald-500/30" :
              "text-muted-foreground"
            )}>
              {change > 0 ? (
                <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
              ) : change < 0 ? (
                <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
              ) : (
                <Minus className="h-2.5 w-2.5 mr-0.5" />
              )}
              {change > 0 ? "+" : ""}{change.toFixed(0)}%
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          <PrivacyBlur>{formatCurrency(spent)}</PrivacyBlur> spent
        </p>
        <p className={cn(
          "text-xs",
          isOver ? "text-red-500 font-medium" : "text-muted-foreground"
        )}>
          {isOver ? (
            <>Over by <PrivacyBlur>{formatCurrency(Math.abs(remaining))}</PrivacyBlur></>
          ) : (
            <><PrivacyBlur>{formatCurrency(remaining)}</PrivacyBlur> left</>
          )}
        </p>
      </div>

      {/* Budget Edit */}
      <div className="shrink-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="w-20 h-8 text-sm"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Check className="h-4 w-4 text-emerald-500" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={handleCancel}
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm font-medium">
                <PrivacyBlur>{formatCurrency(budget)}</PrivacyBlur>
              </p>
              <p className="text-[10px] text-muted-foreground">budget</p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 opacity-50 hover:opacity-100"
              onClick={() => {
                setEditValue(budget.toString());
                setIsEditing(true);
              }}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
