"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";

interface CategorySelectProps {
  category: string;
  subcategory: string;
  onCategoryChange: (category: string) => void;
  onSubcategoryChange: (subcategory: string) => void;
  showSuggestions?: boolean;
  suggestions?: { category: string; subcategory: string; confidence: number }[];
  compact?: boolean;
}

export function CategorySelect({
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
  showSuggestions = false,
  suggestions = [],
  compact = false,
}: CategorySelectProps) {
  const customCategories = useLiveQuery(() => db.customCategories.toArray(), []) ?? [];
  const customCategory = customCategories.find((item) => item.name === category);
  const categories = Array.from(new Set([
    ...Object.keys(CATEGORIES),
    ...customCategories.map((item) => item.name),
  ]));
  const subcategories = category
    ? Array.from(new Set([
        ...(CATEGORIES[category]?.subcategories || []),
        ...(customCategory?.subcategories || []),
      ]))
    : [];
  
  const categoryData = CATEGORIES[category];
  const IconComponent = categoryData?.icon;

  return (
    <div className={cn("flex gap-2", compact ? "flex-col" : "flex-row")}>
      {/* Category Select */}
      <div className="flex-1">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className={cn(compact && "h-8 text-xs")} aria-label="Catégorie">
            <SelectValue placeholder="Choisir une catégorie">
              {category && (
                <div className="flex items-center gap-2">
                  {IconComponent && (
                    <IconComponent 
                      className="h-4 w-4" 
                      style={{ color: categoryData?.color }}
                    />
                  )}
                  <span>{category}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => {
              const catData = CATEGORIES[cat];
              const customData = customCategories.find((item) => item.name === cat);
              const CatIcon = catData?.icon;
              return (
                <SelectItem key={cat} value={cat}>
                  <div className="flex items-center gap-2">
                    {CatIcon && (
                      <CatIcon 
                        className="h-4 w-4" 
                        style={{ color: catData?.color }}
                      />
                    )}
                    {!CatIcon && customData && (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: customData.color }}
                      />
                    )}
                    <span>{cat}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Subcategory Select */}
      <div className="flex-1">
        <Select 
          value={subcategory} 
          onValueChange={onSubcategoryChange}
          disabled={!category}
        >
          <SelectTrigger className={cn(compact && "h-8 text-xs")} aria-label="Sous-catégorie">
            <SelectValue placeholder="Choisir une sous-catégorie" />
          </SelectTrigger>
          <SelectContent>
            {subcategories.map((sub) => (
              <SelectItem key={sub} value={sub}>
                {sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="flex gap-1">
          {suggestions.slice(0, 2).map((s, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                onCategoryChange(s.category);
                onSubcategoryChange(s.subcategory);
              }}
            >
              {s.category}/{s.subcategory}
              <span className="ml-1 text-muted-foreground">
                ({Math.round(s.confidence * 100)}%)
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// Quick category badge for inline display
interface CategoryBadgeProps {
  category: string;
  subcategory?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  size?: "sm" | "md";
}

export function CategoryBadge({ 
  category, 
  subcategory, 
  onClick,
  size = "md" 
}: CategoryBadgeProps) {
  const categoryData = CATEGORIES[category];
  const IconComponent = categoryData?.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
        "hover:bg-accent cursor-pointer",
        size === "sm" && "text-[10px] px-1.5 py-0"
      )}
      style={{ 
        backgroundColor: `${categoryData?.color}20`,
        color: categoryData?.color,
      }}
    >
      {IconComponent && (
        <IconComponent className={cn("h-3 w-3", size === "sm" && "h-2.5 w-2.5")} />
      )}
      <span>{category}</span>
      {subcategory && (
        <>
          <span className="opacity-50">/</span>
          <span className="opacity-75">{subcategory}</span>
        </>
      )}
    </button>
  );
}
