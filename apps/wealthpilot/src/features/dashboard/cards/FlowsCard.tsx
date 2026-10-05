import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function FlowsCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Entrées et sorties" />;
}
