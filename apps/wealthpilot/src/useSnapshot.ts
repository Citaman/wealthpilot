import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./store";
import type { Snapshot } from "./types";

// Keep the database read atomic, but retain unchanged table identities. A card
// preference update must not invalidate every transaction-derived calculation.
export function useSnapshot() {
  const read = useMemo(() => {
    let previous: Snapshot | undefined;
    const signatures = new Map<keyof Snapshot, string>();
    return async () => {
      const next = await db.snapshot();
      for (const key of [
        "transactions",
        "accounts",
        "budgets",
        "dues",
        "batches",
      ] as const) {
        const signature = JSON.stringify(next[key]);
        if (previous && signature === signatures.get(key))
          Object.assign(next, { [key]: previous[key] });
        signatures.set(key, signature);
      }
      previous = next;
      return next;
    };
  }, []);
  return useLiveQuery(read, [read]);
}
