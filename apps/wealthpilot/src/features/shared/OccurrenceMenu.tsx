// Owner: dashboard cards builder. Stub with the agreed props.
import type { Ledger } from "../../domain/ledger";
import type { Occurrence } from "../../domain/events";

export interface OccurrenceMenuProps {
  ledger: Ledger;
  occurrence: Occurrence;
}

/** « ⋯ » menu of an expected movement: confirm, ignore (undo toast), edit amount, stop tracking, history. */
export function OccurrenceMenu(_: OccurrenceMenuProps) {
  return null;
}
