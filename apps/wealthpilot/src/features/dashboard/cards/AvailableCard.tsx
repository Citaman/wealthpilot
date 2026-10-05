import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function AvailableCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Disponible" />;
}
