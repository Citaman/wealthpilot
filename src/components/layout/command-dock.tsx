"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Ellipsis,
  Eye,
  EyeOff,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/theme-context";
import { usePrivacy } from "@/contexts/privacy-context";
import { useAccount } from "@/contexts/account-context";
import { useCommandSearch, type SearchResult } from "@/hooks/use-command-search";
import { useNotifications } from "@/hooks/use-notifications";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  APP_ROUTES,
  MOBILE_PRIMARY_ROUTES,
  ROUTE_GROUP_LABELS,
  getRouteMeta,
  searchRoutes,
  type AppRoute,
  type RouteGroup,
} from "./route-registry";

const groups: RouteGroup[] = ["pilotage", "organisation", "système"];

export function CommandDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchReturnFocusRef = useRef<HTMLElement | null>(null);
  const chordRef = useRef(false);
  const chordTimer = useRef<number | null>(null);

  const navigate = useCallback((href: string) => router.push(href), [router]);
  const openSearch = useCallback(() => {
    searchReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setSearchOpen(true);
  }, []);
  const handleSearchOpenChange = useCallback((open: boolean) => {
    setSearchOpen(open);
    if (!open) {
      window.requestAnimationFrame(() => searchReturnFocusRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    const clearChord = () => {
      chordRef.current = false;
      if (chordTimer.current) window.clearTimeout(chordTimer.current);
      chordTimer.current = null;
    };
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      const key = event.key.toLocaleLowerCase("fr");
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        openSearch();
        return;
      }
      if (editing) return;
      if (chordRef.current) {
        const route = APP_ROUTES.find((item) => item.shortcut?.toLocaleLowerCase("fr") === `g ${key}`);
        if (route) {
          event.preventDefault();
          navigate(route.href);
        }
        clearChord();
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey && key === "g") {
        chordRef.current = true;
        chordTimer.current = window.setTimeout(clearChord, 900);
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      clearChord();
    };
  }, [navigate, openSearch]);

  return (
    <>
      <DesktopRail pathname={pathname} navigate={navigate} openSearch={openSearch} />
      <MobileShell pathname={pathname} navigate={navigate} openSearch={openSearch} />
      {searchOpen ? <CommandSearchDialog open onOpenChange={handleSearchOpenChange} navigate={navigate} /> : null}
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm" aria-hidden="true">W</div>
      <div className="min-w-0">
        <p className="font-semibold tracking-tight">WealthPilot</p>
        <p className="text-sm text-muted-foreground">Pilotage du foyer</p>
      </div>
    </div>
  );
}

function DesktopRail({ pathname, navigate, openSearch }: { pathname: string; navigate: (href: string) => void; openSearch: () => void }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--shell-sidebar-width)] flex-col border-r bg-card px-3 py-4 lg:flex" aria-label="Navigation principale">
      <Brand />
      <Button variant="outline" className="mt-4 w-full justify-start gap-3" onClick={openSearch}>
        <Search className="h-4 w-4" /> Rechercher <kbd className="ml-auto text-xs text-muted-foreground">⌘K</kbd>
      </Button>
      <nav className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group} className="mb-5">
            <p className="mb-1 px-3 text-sm font-semibold text-muted-foreground">{ROUTE_GROUP_LABELS[group]}</p>
            <div className="space-y-1">
              {APP_ROUTES.filter((route) => route.group === group).map((route) => (
                <RouteButton key={route.href} route={route} active={isActive(pathname, route.href)} onClick={() => navigate(route.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t pt-3">
        <AccountMenu align="start" showLabel />
        <div className="mt-2 grid grid-cols-3 gap-1">
          <PrivacyButton />
          <NotificationsMenu align="center" />
          <ThemeButton />
        </div>
      </div>
    </aside>
  );
}

function RouteButton({ route, active, onClick }: { route: AppRoute; active: boolean; onClick: () => void }) {
  const Icon = route.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{route.label}</span>
    </button>
  );
}

function MobileShell({ pathname, navigate, openSearch }: { pathname: string; navigate: (href: string) => void; openSearch: () => void }) {
  const meta = getRouteMeta(pathname);
  const secondary = APP_ROUTES.filter((route) => !route.mobilePrimary);
  return (
    <>
      <header className="safe-top fixed inset-x-0 top-0 z-40 flex h-[calc(var(--shell-mobile-header-height)+env(safe-area-inset-top))] items-center gap-2 border-b bg-card/95 px-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{meta?.title ?? "WealthPilot"}</p>
          <ScopeLabel compact />
        </div>
        <IconControl label="Rechercher" onClick={openSearch}><Search className="h-5 w-5" /></IconControl>
        <PrivacyButton />
        <NotificationsMenu align="end" />
      </header>

      <nav className="safe-bottom fixed inset-x-2 bottom-2 z-40 grid min-h-[var(--shell-mobile-nav-height)] grid-cols-5 items-start rounded-2xl border bg-card/96 px-1 pt-1 shadow-lg backdrop-blur lg:hidden" aria-label="Navigation mobile">
        {MOBILE_PRIMARY_ROUTES.map((route) => {
          const Icon = route.icon;
          const active = isActive(pathname, route.href);
          return (
            <button key={route.href} type="button" onClick={() => navigate(route.href)} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
              <Icon className="h-5 w-5" /><span className="max-w-full truncate">{route.mobileLabel}</span>
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Plus de destinations">
              <Ellipsis className="h-5 w-5" /><span>Plus</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="max-h-[70dvh] w-[min(21rem,calc(100vw-1rem))] overflow-y-auto">
            <DropdownMenuLabel>Organisation et système</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {secondary.map((route) => <DropdownMenuItem key={route.href} onClick={() => navigate(route.href)}><route.icon className="mr-3 h-5 w-5" />{route.label}{isActive(pathname, route.href) ? <Check className="ml-auto h-4 w-4" /> : null}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <div className="grid grid-cols-2 gap-1 p-1"><ThemeButton showLabel /><AccountMenu align="end" showLabel /></div>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </>
  );
}

function ScopeLabel({ compact = false }: { compact?: boolean }) {
  const { selectedAccountId, selectedAccount } = useAccount();
  const label = selectedAccountId === "all" ? "Foyer" : selectedAccount?.name ?? "Compte";
  return <span className={cn("block truncate text-muted-foreground", compact ? "text-xs" : "text-sm")}>Périmètre : {label}</span>;
}

function AccountMenu({ align, showLabel = false }: { align: "start" | "end"; showLabel?: boolean }) {
  const { accounts, selectedAccountId, selectedAccount, setSelectedAccountId, totalBalance } = useAccount();
  const label = selectedAccountId === "all" ? "Foyer" : selectedAccount?.name ?? "Compte";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn("flex min-h-11 items-center rounded-xl px-3 text-sm hover:bg-accent", showLabel ? "w-full gap-3 text-left" : "min-w-11 justify-center")} aria-label={`Changer de compte. Périmètre actuel : ${label}`}>
          <span className="h-3 w-3 shrink-0 rounded-full border" style={{ backgroundColor: selectedAccount?.color || "rgb(var(--balance))" }} />
          {showLabel ? <span className="min-w-0 flex-1"><span className="block truncate font-medium">{label}</span><span className="block text-xs text-muted-foreground"><Money amount={selectedAccountId === "all" ? totalBalance : selectedAccount?.balance ?? 0} /></span></span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[min(20rem,calc(100vw-1rem))]">
        <DropdownMenuLabel>Choisir le périmètre</DropdownMenuLabel><DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setSelectedAccountId("all")}><span className="flex-1">Foyer</span><Money amount={totalBalance} className="text-sm text-muted-foreground" />{selectedAccountId === "all" ? <Check className="ml-2 h-4 w-4" /> : null}</DropdownMenuItem>
        {accounts.map((account) => <DropdownMenuItem key={account.id} onClick={() => setSelectedAccountId(account.id!)}><span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: account.color }} /><span className="min-w-0 flex-1 truncate">{account.name}</span><Money amount={account.balance} currency={account.currency} className="text-sm text-muted-foreground" />{selectedAccountId === account.id ? <Check className="ml-2 h-4 w-4" /> : null}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconControl({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground">{children}</button>;
}

function PrivacyButton() {
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  return <IconControl label={isPrivacyMode ? "Afficher les montants" : "Masquer les montants"} onClick={togglePrivacyMode} pressed={isPrivacyMode}>{isPrivacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</IconControl>;
}

function ThemeButton({ showLabel = false }: { showLabel?: boolean }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const label = resolvedTheme === "dark" ? "Activer le thème clair" : "Activer le thème sombre";
  if (!showLabel) return <IconControl label={label} onClick={toggleTheme}>{resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</IconControl>;
  return <Button variant="ghost" className="justify-start" onClick={toggleTheme}>{resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}{resolvedTheme === "dark" ? "Clair" : "Sombre"}</Button>;
}

function NotificationsMenu({ align }: { align: "start" | "center" | "end" }) {
  const router = useRouter();
  const { notifications, markAllRead, markRead, dismissNotification } = useNotifications();
  const visible = notifications.filter((item) => !item.dismissedAt);
  const unread = visible.filter((item) => !item.readAt).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label={`Notifications${unread ? `, ${unread} non lues` : ""}`}><Bell className="h-5 w-5" />{unread ? <span className="absolute right-1 top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-xs font-bold text-destructive-foreground">{unread > 9 ? "9+" : unread}</span> : null}</button></DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-[min(22rem,calc(100vw-1rem))]">
        <DropdownMenuLabel className="flex items-center justify-between">Notifications{unread ? <Button variant="ghost" size="sm" onClick={() => markAllRead()}>Tout marquer comme lu</Button> : null}</DropdownMenuLabel><DropdownMenuSeparator />
        {visible.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucune notification pour le moment</p> : visible.map((notification) => <div key={notification.id} className="flex items-start gap-1"><DropdownMenuItem className="min-w-0 flex-1 items-start py-3" onClick={() => { void markRead(notification.id); if (notification.actionHref) router.push(notification.actionHref); }}><div className="min-w-0"><p className="font-medium">{notification.title}</p><p className="text-sm text-muted-foreground">{notification.body}</p></div></DropdownMenuItem><Button variant="ghost" size="icon" className="mt-1 shrink-0" aria-label={`Masquer la notification ${notification.title}`} onClick={() => { void dismissNotification(notification.id); }}><X className="h-4 w-4" /></Button></div>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type CommandItem = { key: string; label: string; subtitle?: string; href?: string; amount?: number; type?: SearchResult["type"]; accountId?: number; shortcut?: string };

function CommandSearchDialog({ open, onOpenChange, navigate }: { open: boolean; onOpenChange: (open: boolean) => void; navigate: (href: string) => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useCommandSearch(query);
  const { baseCurrency, getAccountCurrency } = useMoney();
  const routeItems = useMemo<CommandItem[]>(() => searchRoutes(query).map((route) => ({ key: `route-${route.href}`, label: route.label, subtitle: route.subtitle, href: route.href, type: "navigation", shortcut: route.shortcut })), [query]);
  const dataItems = useMemo<CommandItem[]>(() => query.trim() ? results.filter((result) => result.type !== "navigation").map((result) => ({ key: `${result.type}-${result.id}`, label: result.title, subtitle: result.subtitle, href: result.href, amount: result.amount, type: result.type, accountId: result.accountId })) : [], [query, results]);
  const items = [...routeItems, ...dataItems];
  useEffect(() => setActiveIndex(0), [query]);
  const select = (item?: CommandItem) => { if (!item?.href) return; navigate(item.href); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4"><DialogTitle>Rechercher dans WealthPilot</DialogTitle><DialogDescription>Pages, comptes, transactions et objectifs. Raccourci : ⌘K.</DialogDescription></DialogHeader>
        <div className="px-4 pt-4"><Input aria-label="Recherche globale" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="command-search-results" aria-activedescendant={items[activeIndex] ? `command-result-${activeIndex}` : undefined} placeholder="Rechercher une page, un marchand, un compte…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(0, items.length - 1))); } if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); } if (event.key === "Enter") { event.preventDefault(); select(items[activeIndex]); } }} autoFocus /></div>
        <div id="command-search-results" className="max-h-[55dvh] overflow-y-auto p-2" role="listbox" aria-label="Résultats de recherche">
          {items.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Aucun résultat. Essayez un autre terme.</p> : items.map((item, index) => { const currency = item.type === "transaction" || item.type === "account" ? getAccountCurrency(item.accountId) : baseCurrency; return <button id={`command-result-${index}`} key={item.key} type="button" role="option" aria-selected={index === activeIndex} className={cn("flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-left", index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted")} onMouseEnter={() => setActiveIndex(index)} onClick={() => select(item)}><span className="min-w-0"><span className="block truncate font-medium">{item.label}</span>{item.subtitle ? <span className="block truncate text-sm text-muted-foreground">{item.subtitle}</span> : null}</span><span className="ml-3 flex shrink-0 items-center gap-2">{item.amount !== undefined ? <Money amount={item.amount} currency={currency} className="font-semibold" /> : null}{item.shortcut ? <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{item.shortcut}</kbd> : null}</span></button>; })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
