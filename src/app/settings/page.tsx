"use client";

import { useEffect, useMemo, useState } from "react";
import { AppWindow, Bell, Calendar, ChevronRight, CircleHelp, Coins, Database, Info, Palette, Search, Wallet } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { NotificationsSettings } from "@/components/settings/notifications-settings";
import { FinancialMonthSettingsCard } from "@/components/settings/financial-month-settings";
import { AccountBalanceSettings } from "@/components/settings/account-balance-settings";
import { CurrencySettings } from "@/components/settings/currency-settings";
import { DataManagementSettings } from "@/components/settings/data-management-settings";
import { AboutSettings } from "@/components/settings/about-settings";
import { HelpSettings } from "@/components/settings/help-settings";
import { InstallationSettings } from "@/components/settings/installation-settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SettingsSection = "appearance" | "notifications" | "currency" | "financial-month" | "balances" | "data" | "installation" | "help" | "about";
type Group = "general" | "finance" | "system";

const navItems = [
  { id: "appearance", label: "Apparence", description: "Thème et couleur d’accent", icon: Palette, group: "general", keywords: "clair sombre contraste couleur" },
  { id: "notifications", label: "Notifications", description: "Alertes et rappels", icon: Bell, group: "general", keywords: "budget navigateur permission" },
  { id: "currency", label: "Devise", description: "Devise de référence et taux", icon: Coins, group: "finance", keywords: "euro conversion taux" },
  { id: "financial-month", label: "Mois financier", description: "Début de période et détection du salaire", icon: Calendar, group: "finance", keywords: "salaire calendrier période" },
  { id: "balances", label: "Soldes", description: "Soldes initiaux et points de contrôle", icon: Wallet, group: "finance", keywords: "comptes checkpoint rapprochement" },
  { id: "data", label: "Données", description: "Sauvegarde, restauration et réinitialisation", icon: Database, group: "system", keywords: "export import backup reset chiffrement" },
  { id: "installation", label: "Installation", description: "Dock, application et mode hors connexion", icon: AppWindow, group: "system", keywords: "pwa dock mac safari chrome installer offline" },
  { id: "help", label: "Aide et FAQ", description: "Réponses aux questions courantes", icon: CircleHelp, group: "system", keywords: "support questions" },
  { id: "about", label: "À propos", description: "Version et informations", icon: Info, group: "system", keywords: "version confidentialité" },
] as const;

const components: Record<SettingsSection, React.FC> = {
  appearance: AppearanceSettings,
  notifications: NotificationsSettings,
  currency: CurrencySettings,
  "financial-month": FinancialMonthSettingsCard,
  balances: AccountBalanceSettings,
  data: DataManagementSettings,
  installation: InstallationSettings,
  help: HelpSettings,
  about: AboutSettings,
};

const groupLabels: Record<Group, string> = { general: "Général", finance: "Finances", system: "Système" };
const isSection = (value: string | null): value is SettingsSection => navItems.some((item) => item.id === value);

export default function SettingsPage() {
  const [active, setActive] = useState<SettingsSection>("appearance");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const syncFromUrl = () => {
      const section = new URL(window.location.href).searchParams.get("section");
      if (isSection(section)) setActive(section);
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const choose = (section: SettingsSection) => {
    setActive(section);
    const url = new URL(window.location.href);
    url.searchParams.set("section", section);
    window.history.pushState({}, "", url);
    requestAnimationFrame(() => document.getElementById("settings-section-title")?.focus());
  };

  const visibleItems = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase("fr");
    if (!q) return [...navItems];
    return navItems.filter((item) => `${item.label} ${item.description} ${item.keywords}`.toLocaleLowerCase("fr").includes(q));
  }, [filter]);

  const activeItem = navItems.find((item) => item.id === active)!;
  const mobileItems = visibleItems.some((item) => item.id === active)
    ? visibleItems
    : [activeItem, ...visibleItems];
  const ActiveComponent = components[active];

  return (
    <AppLayout>
      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <aside className="w-full shrink-0 lg:sticky lg:top-8 lg:w-64" aria-label="Sections des réglages">
          <Label htmlFor="settings-search" className="sr-only">Rechercher un réglage</Label>
          <Input id="settings-search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Rechercher un réglage…" icon={<Search className="h-4 w-4" />} />

          <div className="mt-3 lg:hidden">
            <Label htmlFor="settings-section" className="mb-1.5 block">Section</Label>
            <select id="settings-section" value={active} onChange={(event) => choose(event.target.value as SettingsSection)} className="min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-card px-3 text-base">
              {mobileItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>

          <nav className="mt-4 hidden space-y-5 lg:block">
            {(["general", "finance", "system"] as Group[]).map((group) => {
              const items = visibleItems.filter((item) => item.group === group);
              if (!items.length) return null;
              return <section key={group} aria-labelledby={`settings-group-${group}`}><h2 id={`settings-group-${group}`} className="mb-1 px-3 text-sm font-semibold text-muted-foreground">{groupLabels[group]}</h2><div className="space-y-1">{items.map((item) => { const Icon = item.icon; const selected = active === item.id; return <button key={item.id} type="button" onClick={() => choose(item.id)} aria-current={selected ? "page" : undefined} className={cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium", selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}><Icon className="h-5 w-5 shrink-0" /><span className="truncate">{item.label}</span>{selected ? <ChevronRight className="ml-auto h-4 w-4" /> : null}</button>; })}</div></section>;
            })}
            {visibleItems.length === 0 ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">Aucun réglage ne correspond à cette recherche.</p> : null}
          </nav>
        </aside>

        <section className="min-w-0 flex-1" aria-labelledby="settings-section-title">
          <header className="mb-6">
            <h2 id="settings-section-title" tabIndex={-1} className="text-2xl font-semibold outline-none">{activeItem.label}</h2>
            <p className="mt-1 text-base text-muted-foreground">{activeItem.description}</p>
          </header>
          <div className="space-y-6"><ActiveComponent /></div>
        </section>
      </div>
    </AppLayout>
  );
}
