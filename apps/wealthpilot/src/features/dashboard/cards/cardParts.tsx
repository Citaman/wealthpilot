// Small pieces shared by the dashboard cards.
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { Cents } from "../../../domain/types";
import { Money } from "../../../ui/Money";
import "./cardParts.css";

/** Drilldown value of the `acct` parameter. */
export const acctParam = (account: string) => account || "household";

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
