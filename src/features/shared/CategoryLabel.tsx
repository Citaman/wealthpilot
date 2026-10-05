import type { CSSProperties } from "react";
import { categoryColor, isUncategorized } from "../../domain/categories";
import type { Ledger } from "../../domain/ledger";
import { readableOn } from "../../ui/color";
import { categoryIcon } from "./categoryIcon";
import "./CategoryLabel.css";

/** « Food › Fast Food », for titles, meta lines and aria labels. */
export const categoryText = (category: string, subcategory?: string) =>
  isUncategorized(category)
    ? "À catégoriser"
    : subcategory
      ? `${category} › ${subcategory}`
      : category;

/** Plan groups are stored as « Food · Fast Food »; they read like every other label. */
export const groupText = (group: string) => group.replace(" · ", " › ");

export function splitGroup(group: string) {
  const [category, subcategory] = group.split(" · ");
  return { category, subcategory };
}

export const DERIVED_TITLE =
  "Sous-catégorie déduite de l’historique du commerçant";

export interface CategoryLabelProps {
  ledger: Ledger;
  category: string;
  subcategory?: string;
  /** The subcategory was derived by the ledger, not stored. */
  derived?: boolean;
  size?: "s" | "m";
  icon?: boolean;
}

/** Category icon + « Category › Subcategory », the one category label of the app. */
export function CategoryLabel({
  ledger,
  category,
  subcategory,
  derived,
  size = "m",
  icon = true,
}: CategoryLabelProps) {
  if (isUncategorized(category))
    return (
      <span className="cat-label" data-size={size} data-empty>
        À catégoriser
      </span>
    );
  return (
    <span
      className="cat-label"
      data-size={size}
      title={categoryText(category, subcategory)}
    >
      {icon && (
        <CategoryIcon
          ledger={ledger}
          category={category}
          subcategory={subcategory}
          size={size}
        />
      )}
      <span className="cat-label-name">{category}</span>
      {subcategory && (
        <>
          <span className="cat-label-sep" aria-hidden>
            ›
          </span>
          <span
            className="cat-label-sub"
            data-derived={derived || undefined}
            title={derived ? DERIVED_TITLE : undefined}
          >
            {subcategory}
          </span>
        </>
      )}
    </span>
  );
}

/** The category squircle: its icon on its series colour. */
export function CategoryIcon({
  ledger,
  category,
  subcategory,
  size = "m",
}: {
  ledger: Ledger;
  category: string;
  subcategory?: string;
  size?: "s" | "m";
}) {
  const color = categoryColor(category, ledger.prefs.categoryDefinitions);
  const Icon = categoryIcon(category, subcategory);
  return (
    <span
      className="cat-label-icon"
      data-size={size}
      style={{ "--cat": color, "--cat-fg": readableOn(color) } as CSSProperties}
      aria-hidden
    >
      <Icon size={size === "s" ? 11 : 13} strokeWidth={2.25} />
    </span>
  );
}
