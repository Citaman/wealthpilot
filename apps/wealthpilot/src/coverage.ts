import type { Account, BalanceCheckpoint } from "./types";

/** No time-window input: the same account/date always selects the same anchor. */
export function checkpointForDate(
  account: Account,
  date: string,
): BalanceCheckpoint | undefined {
  const history = [...(account.checkpoints ?? [])];
  if (account.checkpoint) history.push(account.checkpoint);
  const accepted = history.filter((c) => c.accepted !== false);
  const observations = accepted.filter((c) => c.status !== "derived");
  const candidates = observations.length ? observations : accepted;
  const byDate = new Map(candidates.map((c) => [c.date, c]));
  const sorted = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return sorted.filter((c) => c.date <= date).at(-1) ?? sorted[0];
}

export function balanceCoverage(
  account: Account,
  date: string,
): "observed" | "covered" | "derived" | "incomplete" | "unknown" {
  const checkpoint = checkpointForDate(account, date);
  if (!checkpoint) return "unknown";
  if (checkpoint.status === "derived") return "derived";
  if (date === checkpoint.date) return "observed";
  if (!account.coverage?.length) return "unknown";
  const from = date < checkpoint.date ? date : checkpoint.date;
  const through = date > checkpoint.date ? date : checkpoint.date;
  let coveredThrough = from;
  for (const range of account.coverage
    .filter((c) => c.complete)
    .sort((a, b) => a.from.localeCompare(b.from))) {
    if (range.through < coveredThrough) continue;
    const dayAfter = new Date(coveredThrough + "T12:00:00Z");
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    if (range.from > dayAfter.toISOString().slice(0, 10)) continue;
    // The first observation date itself needs no imported transaction.
    if (
      coveredThrough === from &&
      range.from > from &&
      from !== checkpoint.date
    )
      continue;
    coveredThrough = range.through;
    if (coveredThrough >= through) return "covered";
  }
  return "incomplete";
}
