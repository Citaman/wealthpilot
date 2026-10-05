import type { LucideIcon } from "lucide-react";
import { categoryColor } from "../../domain/categories";
import type { Ledger } from "../../domain/ledger";
import { brandFor } from "../../domain/merchants";
import { MerchantLogo } from "../../ui/MerchantLogo";
import { categoryIcon } from "./categoryIcon";

/** Brand logo when known, otherwise the category icon on its colour — never an initial. */
export function Logo({
  ledger,
  name,
  category = "",
  subcategory,
  icon,
  size = 32,
}: {
  ledger: Ledger;
  name: string;
  category?: string;
  subcategory?: string;
  /** Replaces the category icon (e.g. internal transfers). */
  icon?: LucideIcon;
  size?: 28 | 32 | 44;
}) {
  const brand = brandFor(name);
  return (
    <MerchantLogo
      color={categoryColor(category, ledger.prefs.categoryDefinitions)}
      src={brand ? (brand.src ?? `/brands/${brand.slug}.svg`) : undefined}
      icon={icon ?? categoryIcon(category, subcategory)}
      size={size}
    />
  );
}
