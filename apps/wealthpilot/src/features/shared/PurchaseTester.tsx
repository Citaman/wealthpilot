// Owner: Ma semaine builder. Stub with the agreed props.
import type { Ledger } from "../../domain/ledger";
import type { IsoDate } from "../../domain/types";

export interface PurchaseTesterProps {
  ledger: Ledger;
  /** Default payer ("" = household / usual payer of the category). */
  account: string;
  minDate?: IsoDate;
  maxDate?: IsoDate;
  /** Narrow layout for a ⅓ dashboard card. */
  compact?: boolean;
}

/** Live « Puis-je dépenser ? » simulation; never writes. */
export function PurchaseTester(_: PurchaseTesterProps) {
  return null;
}
