import type { Account, BalanceCheckpoint } from "../domain/types";

/** Every recorded checkpoint, the legacy single anchor included once. */
export function checkpointHistory(account: Account): BalanceCheckpoint[] {
  const history = [...(account.checkpoints ?? [])];
  const legacy = account.checkpoint && JSON.stringify(account.checkpoint);
  if (legacy && !history.some((c) => JSON.stringify(c) === legacy))
    history.push(account.checkpoint!);
  return history;
}

/** Legacy `checkpoint` value: latest accepted observation, else latest accepted reconstruction. */
export function legacyAnchor(
  checkpoints: BalanceCheckpoint[],
): BalanceCheckpoint | undefined {
  const accepted = checkpoints.filter((c) => c.accepted !== false);
  const observed = accepted.filter((c) => c.status !== "derived");
  return (observed.length ? observed : accepted)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}
