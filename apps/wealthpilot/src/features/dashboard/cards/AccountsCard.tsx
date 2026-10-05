import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function AccountsCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Comptes" />;
}
