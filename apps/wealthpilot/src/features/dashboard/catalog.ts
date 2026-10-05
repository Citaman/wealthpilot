import type { ComponentType } from "react";
import type { CardPaletteId, CardType, CardWidth } from "../../domain/types";
import { AccountsCard } from "./cards/AccountsCard";
import { AvailableCard } from "./cards/AvailableCard";
import { BalanceCard } from "./cards/BalanceCard";
import { EnvelopesCard } from "./cards/EnvelopesCard";
import { FlowsCard } from "./cards/FlowsCard";
import { InboxCard } from "./cards/InboxCard";
import { RecentCard } from "./cards/RecentCard";
import { SimulateCard } from "./cards/SimulateCard";
import { SpendingCard } from "./cards/SpendingCard";
import type { CardProps } from "./cards/types";
import { UpcomingCard } from "./cards/UpcomingCard";
import { WeekCard } from "./cards/WeekCard";

export interface CardDefinition {
  type: CardType;
  title: string;
  question: string;
  widths: readonly CardWidth[];
  defaultWidth: CardWidth;
  defaultPalette: CardPaletteId;
  /** The card can follow its own account instead of the dock's. */
  supportsAccount: boolean;
  Component: ComponentType<CardProps>;
}

export const catalog: Record<CardType, CardDefinition> = {
  balance: {
    type: "balance",
    title: "Solde",
    question: "Combien avons-nous et où va le solde ?",
    widths: [6, 8, 12],
    defaultWidth: 8,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: BalanceCard,
  },
  available: {
    type: "available",
    title: "Disponible",
    question: "Combien est vraiment libre jusqu’à la fin du mois budgétaire ?",
    widths: [4, 6],
    defaultWidth: 4,
    defaultPalette: "ink",
    supportsAccount: true,
    Component: AvailableCard,
  },
  week: {
    type: "week",
    title: "Cette semaine",
    question: "Combien encore d’ici dimanche ?",
    widths: [4, 6],
    defaultWidth: 4,
    defaultPalette: "yellow",
    supportsAccount: true,
    Component: WeekCard,
  },
  envelopes: {
    type: "envelopes",
    title: "Enveloppes",
    question: "Que reste-t-il dans chaque enveloppe ?",
    widths: [4, 6, 8, 12],
    defaultWidth: 6,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: EnvelopesCard,
  },
  upcoming: {
    type: "upcoming",
    title: "À venir",
    question:
      "Quelles entrées et sorties arrivent, et un compte va-t-il manquer ?",
    widths: [4, 6, 8],
    defaultWidth: 6,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: UpcomingCard,
  },
  flows: {
    type: "flows",
    title: "Entrées et sorties",
    question: "Les revenus couvrent-ils les dépenses, mois après mois ?",
    widths: [6, 8, 12],
    defaultWidth: 8,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: FlowsCard,
  },
  spending: {
    type: "spending",
    title: "Où part l’argent",
    question: "Quelles catégories pèsent, et lesquelles dépassent l’habitude ?",
    widths: [4, 6, 8],
    defaultWidth: 4,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: SpendingCard,
  },
  simulate: {
    type: "simulate",
    title: "Puis-je dépenser ?",
    question: "Cet achat passe-t-il ?",
    widths: [4, 6],
    defaultWidth: 4,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: SimulateCard,
  },
  recent: {
    type: "recent",
    title: "Opérations",
    question: "Que s’est-il passé récemment ?",
    widths: [4, 6, 8, 12],
    defaultWidth: 8,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: RecentCard,
  },
  inbox: {
    type: "inbox",
    title: "À traiter",
    question: "Qu’est-ce qui attend une décision ?",
    widths: [3, 4, 6],
    defaultWidth: 4,
    defaultPalette: "paper",
    supportsAccount: true,
    Component: InboxCard,
  },
  accounts: {
    type: "accounts",
    title: "Comptes",
    question: "Mes soldes sont-ils à jour et fiables ?",
    widths: [4, 6, 8],
    defaultWidth: 4,
    defaultPalette: "paper",
    supportsAccount: false,
    Component: AccountsCard,
  },
};

export const widthLabels: Record<CardWidth, { short: string; long: string }> = {
  3: { short: "¼", long: "Un quart" },
  4: { short: "⅓", long: "Un tiers" },
  6: { short: "½", long: "La moitié" },
  8: { short: "⅔", long: "Deux tiers" },
  12: { short: "1", long: "Pleine largeur" },
};

export const paletteNames: Record<CardPaletteId, string> = {
  paper: "Papier",
  ink: "Encre",
  yellow: "Jaune",
  pink: "Rose",
  cyan: "Cyan",
  coral: "Corail",
  lavender: "Lavande",
  plum: "Prune",
  midnight: "Bleu nuit",
  sage: "Sauge",
  forest: "Forêt",
  sand: "Sable",
};
