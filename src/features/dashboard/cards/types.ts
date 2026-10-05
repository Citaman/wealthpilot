import type { DateRange } from "../../../domain/dates";
import type { Ledger } from "../../../domain/ledger";
import type { DashboardCard } from "../../../domain/types";

/** What the board gives every card. Cards never read the dock context themselves. */
export interface CardProps {
  card: DashboardCard;
  ledger: Ledger;
  /** Effective account: the card's override, else the dock's ("" = household). */
  account: string;
  /** Dock period, already resolved. Cards about "now" (available, week, upcoming) ignore it. */
  range: DateRange & { label: string };
  /** Organize mode: content is inert, the board draws the edit bar. */
  editing: boolean;
  /** Persists per-instance options (e.g. { forecast: true }). */
  setOption(key: string, value: string | number | boolean): void;
}
