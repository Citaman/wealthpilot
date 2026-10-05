import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function SimulateCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Puis-je dépenser ?" />;
}
