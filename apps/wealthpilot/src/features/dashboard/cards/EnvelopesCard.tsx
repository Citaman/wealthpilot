import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function EnvelopesCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="Enveloppes" />;
}
