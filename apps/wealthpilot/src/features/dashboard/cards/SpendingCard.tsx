import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function SpendingCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Où part l’argent" />;
}
