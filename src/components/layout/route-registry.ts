import {
  ArrowLeftRight,
  Calendar,
  CalendarRange,
  CreditCard,
  FolderTree,
  Gauge,
  PieChart,
  ReceiptText,
  Settings,
  Target,
  Upload,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export type RouteGroup = "pilotage" | "organisation" | "système";

export type AppRoute = {
  href: string;
  label: string;
  title: string;
  subtitle: string;
  group: RouteGroup;
  icon: LucideIcon;
  shortcut?: string;
  mobilePrimary?: boolean;
  mobileLabel?: string;
  keywords: string[];
};

export type MobilePrimaryRoute = AppRoute & {
  mobilePrimary: true;
  mobileLabel: string;
};

export const APP_ROUTES: readonly AppRoute[] = [
  { href: "/", label: "Aujourd’hui", mobileLabel: "Accueil", title: "Aujourd’hui", subtitle: "Votre situation financière en un coup d’œil", group: "pilotage", icon: Gauge, shortcut: "G D", mobilePrimary: true, keywords: ["accueil", "dashboard", "situation"] },
  { href: "/transactions", label: "Transactions", mobileLabel: "Opérations", title: "Transactions", subtitle: "Rechercher, vérifier et classer vos opérations", group: "pilotage", icon: ArrowLeftRight, shortcut: "G T", mobilePrimary: true, keywords: ["opérations", "dépenses", "revenus"] },
  { href: "/plan", label: "Plan 13 semaines", mobileLabel: "Plan", title: "Plan 13 semaines", subtitle: "Piloter le rétablissement du foyer semaine après semaine", group: "pilotage", icon: CalendarRange, shortcut: "G P", mobilePrimary: true, keywords: ["prévision", "trésorerie", "semaines"] },
  { href: "/analytics", label: "Analyse", mobileLabel: "Analyse", title: "Analyse", subtitle: "Comprendre les tendances, revenus et dépenses", group: "pilotage", icon: PieChart, shortcut: "G A", mobilePrimary: true, keywords: ["analytics", "graphiques", "historique"] },
  { href: "/budgets", label: "Budgets", title: "Budgets", subtitle: "Prévoir les dépenses et suivre les écarts", group: "organisation", icon: WalletCards, shortcut: "G B", keywords: ["enveloppes", "budget"] },
  { href: "/goals", label: "Objectifs", title: "Objectifs", subtitle: "Construire vos projets sans perdre de vue le disponible", group: "organisation", icon: Target, shortcut: "G G", keywords: ["goals", "épargne", "projets"] },
  { href: "/subscriptions", label: "Récurrents", title: "Récurrents", subtitle: "Suivre abonnements, factures, prêts et revenus réguliers", group: "organisation", icon: ReceiptText, shortcut: "G R", keywords: ["subscriptions", "abonnements", "factures"] },
  { href: "/calendar", label: "Calendrier", title: "Calendrier", subtitle: "Visualiser les échéances et les flux à venir", group: "organisation", icon: Calendar, keywords: ["échéances", "paiements"] },
  { href: "/accounts", label: "Comptes", title: "Comptes", subtitle: "Soldes, devises et points de contrôle", group: "organisation", icon: CreditCard, keywords: ["banques", "soldes"] },
  { href: "/categories", label: "Catégories", title: "Catégories", subtitle: "Organiser la lecture des revenus et dépenses", group: "organisation", icon: FolderTree, keywords: ["classement", "sous-catégories"] },
  { href: "/import", label: "Importer", title: "Importer", subtitle: "Ajouter un relevé bancaire en toute sécurité", group: "système", icon: Upload, shortcut: "G I", keywords: ["csv", "relevé", "banque"] },
  { href: "/settings", label: "Réglages", title: "Réglages", subtitle: "Préférences, sauvegarde et état du système", group: "système", icon: Settings, keywords: ["settings", "apparence", "données"] },
] as const;

// Keep the mobile labels in one typed, module-level source used identically by
// server and client rendering. The assertion is safe because primary routes are
// required above to declare their compact label.
export const MOBILE_PRIMARY_ROUTES: readonly MobilePrimaryRoute[] = APP_ROUTES.filter(
  (route): route is MobilePrimaryRoute => route.mobilePrimary === true && typeof route.mobileLabel === "string"
);

export const ROUTE_GROUP_LABELS: Record<RouteGroup, string> = {
  pilotage: "Pilotage",
  organisation: "Organisation",
  système: "Système",
};

export function getRouteMeta(pathname: string): AppRoute | undefined {
  const exact = APP_ROUTES.find((route) => route.href === pathname);
  if (exact) return exact;
  if (/^\/goals\/[^/]+$/.test(pathname)) {
    return {
      ...APP_ROUTES.find((route) => route.href === "/goals")!,
      title: "Détail de l’objectif",
      subtitle: "Progression, prévision et historique",
    };
  }
  return undefined;
}

export function searchRoutes(query: string): AppRoute[] {
  const normalized = query.trim().toLocaleLowerCase("fr");
  if (!normalized) return [...APP_ROUTES];
  return APP_ROUTES.filter((route) =>
    [route.label, route.title, route.subtitle, ...route.keywords]
      .join(" ")
      .toLocaleLowerCase("fr")
      .includes(normalized)
  );
}
