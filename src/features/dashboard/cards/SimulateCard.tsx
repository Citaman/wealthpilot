import { CardShell } from "../../../ui/CardShell";
import { PurchaseTester } from "../../shared/PurchaseTester";
import type { CardProps } from "./types";

export function SimulateCard({ card, ledger, account }: CardProps) {
  return (
    <CardShell palette={card.palette} title="Puis-je dépenser ?">
      <PurchaseTester ledger={ledger} account={account} compact />
    </CardShell>
  );
}
