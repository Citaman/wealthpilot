import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function WeekCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Cette semaine" />;
}
