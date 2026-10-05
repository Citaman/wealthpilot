import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function RecentCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Opérations" />;
}
