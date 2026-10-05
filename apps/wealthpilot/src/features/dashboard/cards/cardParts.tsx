// Small pieces shared by the Envelopes, Upcoming, Spending, Recent, Inbox and Accounts cards.
import {
  ArrowLeftRight,
  Baby,
  Banknote,
  Car,
  ChevronDown,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  PiggyBank,
  Plane,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Ticket,
  UtensilsCrossed,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { categoryColor } from "../../../domain/categories";
import type { Ledger } from "../../../domain/ledger";
import { brandFor } from "../../../domain/merchants";
import { normalize } from "../../../domain/search";
import type { Cents } from "../../../domain/types";
import { MerchantLogo } from "../../../ui/MerchantLogo";
import { Money } from "../../../ui/Money";
import "./cardParts.css";

/** Drilldown value of the `acct` parameter. */
export const acctParam = (account: string) => account || "household";

const icons: [RegExp, LucideIcon][] = [
  [/course|aliment|supermarch/, ShoppingCart],
  [/restau|resto|fast|cafe/, UtensilsCrossed],
  [/transport|carbur|essence|voiture|auto/, Car],
  [/logement|loyer|maison/, House],
  [/energie|electri|gaz/, Zap],
  [/abonnement|telecom|internet|mobile/, Wifi],
  [/assurance/, Shield],
  [/enfant|ecole|creche/, Baby],
  [/shopping|vetement|habill/, ShoppingBag],
  [/sante|medecin|pharma/, HeartPulse],
  [/loisir|sortie|culture/, Ticket],
  [/salaire|revenu|paie/, Banknote],
  [/allocation|aide/, HandCoins],
  [/virement|transfert/, ArrowLeftRight],
  [/impot|taxe/, Landmark],
  [/epargne/, PiggyBank],
  [/voyage|vacance/, Plane],
];

export function categoryIcon(category: string): LucideIcon | undefined {
  const name = normalize(category);
  return icons.find(([pattern]) => pattern.test(name))?.[1];
}

/** Brand logo when known, otherwise the category icon on its colour. */
export function Logo({
  ledger,
  name,
  category,
  size = 32,
}: {
  ledger: Ledger;
  name: string;
  category?: string;
  size?: 28 | 32;
}) {
  const brand = brandFor(name);
  const color = brand
    ? `#${brand.hex}`
    : categoryColor(category ?? "", ledger.prefs.categoryDefinitions);
  return (
    <MerchantLogo
      name={brand?.title ?? name}
      color={color}
      src={brand?.src}
      icon={brand ? undefined : categoryIcon(category ?? "")}
      size={size}
    />
  );
}

/** Sunk summary tile of a card footer, with an optional action on its right. */
export function FooterTile({
  value,
  label,
  unknownReason,
  action,
}: {
  value: Cents | null;
  label: ReactNode;
  unknownReason?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-foot">
      <p className="card-tile">
        <Money
          value={value}
          size="m"
          tone="none"
          cents="never"
          unknownReason={unknownReason}
        />
        <span className="card-tile-label">{label}</span>
      </p>
      {action}
    </div>
  );
}

/** « Voir les N autres » toggle for rows hidden at this width. */
export function MoreToggle({
  hidden,
  open,
  onToggle,
  controls,
}: {
  hidden: number;
  open: boolean;
  onToggle(): void;
  controls: string;
}) {
  return (
    <button
      type="button"
      className="card-more"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          onToggle();
        }
      }}
    >
      {open
        ? "Voir moins"
        : hidden === 1
          ? "Voir l’autre"
          : `Voir les ${hidden} autres`}
      <ChevronDown size={16} aria-hidden />
    </button>
  );
}
