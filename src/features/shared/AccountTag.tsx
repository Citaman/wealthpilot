import type { CSSProperties } from "react";
import { accountName, type Ledger } from "../../domain/ledger";
import "./AccountTag.css";

/** Account series colour, in the order of the balance chart legend. */
export const accountColor = (index: number) =>
  `var(--series-${(Math.max(0, index) % 7) + 1})`;

export const accountColorOf = (ledger: Ledger, id: string) =>
  accountColor(ledger.accounts.findIndex((a) => a.id === id));

/** Coloured dot + account name. */
export function AccountTag({ ledger, id }: { ledger: Ledger; id: string }) {
  return (
    <span
      className="acct-tag"
      style={{ "--acct": accountColorOf(ledger, id) } as CSSProperties}
    >
      {accountName(ledger, id)}
    </span>
  );
}
