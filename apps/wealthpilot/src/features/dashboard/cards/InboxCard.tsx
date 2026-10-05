import { CardShell } from "../../../ui/CardShell";
import type { CardProps } from "./types";

export function InboxCard({ card }: CardProps) {
  return <CardShell palette={card.palette} title="À traiter" />;
}
