"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  Calendar,
  Command,
  CreditCard,
  LayoutDashboard,
  PieChart,
  Search,
  Settings,
  Sparkles,
  Target,
  Upload,
  Wallet,
  Wrench,
  Sun,
  Moon,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts";
import { useAccount } from "@/contexts/account-context";
import { useCommandSearch, type SearchResult } from "@/hooks/use-command-search";
import { useMoney } from "@/hooks/use-money";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PilotOrb } from "@/components/brand/pilot-orb";
import { useNotifications } from "@/hooks/use-notifications";

type DockItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const primaryNav: DockItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Analytics", href: "/analytics", icon: PieChart },
  { label: "Budgets", href: "/budgets", icon: Wallet },
  { label: "Goals", href: "/goals", icon: Target },
];

const secondaryNav: DockItem[] = [
  { label: "Subscriptions", href: "/subscriptions", icon: RefreshCw },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Accounts", href: "/accounts", icon: CreditCard },
  { label: "Import", href: "/import", icon: Upload },
  { label: "Settings", href: "/settings", icon: Settings },
];

type CommandItem = {
  key: string;
  label: string;
  subtitle?: string;
  href?: string;
  amount?: number;
  type?: SearchResult["type"];
  accountId?: number;
  shortcut?: string;
};

export function CommandDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleTheme, resolvedTheme } = useTheme();
  const { accounts, selectedAccountId, selectedAccount, setSelectedAccountId, totalBalance } = useAccount();
  const { baseCurrency, getAccountCurrency } = useMoney();
  const { notifications, markAllRead, markRead, dismissNotification } = useNotifications();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = useCommandSearch(searchQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const chordRef = useRef<"g" | null>(null);
  const chordTimerRef = useRef<number | null>(null);

  const quickActions = useMemo(() => ([
    { id: "dashboard", label: "Dashboard", subtitle: "Go to dashboard", href: "/", shortcut: "G D" },
    { id: "transactions", label: "Transactions", subtitle: "Review activity", href: "/transactions", shortcut: "G T" },
    { id: "budgets", label: "Budgets", subtitle: "Plan spending", href: "/budgets", shortcut: "G B" },
    { id: "analytics", label: "Analytics", subtitle: "Insights & trends", href: "/analytics", shortcut: "G A" },
    { id: "goals", label: "Goals", subtitle: "Track savings", href: "/goals", shortcut: "G G" },
    { id: "subscriptions", label: "Subscriptions", subtitle: "Recurring payments", href: "/subscriptions", shortcut: "G S" },
    { id: "import", label: "Import CSV", subtitle: "Upload a bank file", href: "/import", shortcut: "G I" },
  ]), []);

  const commandItems = useMemo<CommandItem[]>(() => {
    if (searchQuery) {
      return searchResults.map((result) => ({
        key: `${result.type}-${result.id}`,
        label: result.title,
        subtitle: result.subtitle,
        href: result.href,
        amount: result.amount,
        type: result.type,
        accountId: result.accountId,
      }));
    }

    return quickActions.map((action) => ({
      key: action.id,
      label: action.label,
      subtitle: action.subtitle,
      href: action.href,
      shortcut: action.shortcut,
      type: "navigation",
    }));
  }, [searchQuery, searchResults, quickActions]);

  const shortcutMap = useMemo(() => ({
    d: "/",
    t: "/transactions",
    b: "/budgets",
    a: "/analytics",
    g: "/goals",
    s: "/subscriptions",
    i: "/import",
  }), []);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
  }, []);

  useEffect(() => {
    const clearChord = () => {
      chordRef.current = null;
      if (chordTimerRef.current) {
        window.clearTimeout(chordTimerRef.current);
        chordTimerRef.current = null;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (key === "escape") {
        setSearchOpen(false);
        setSearchQuery("");
        clearChord();
        return;
      }

      if (isEditableTarget(e.target)) return;

      if (chordRef.current === "g") {
        const target = shortcutMap[key as keyof typeof shortcutMap];
        if (target) {
          e.preventDefault();
          router.push(target);
        }
        clearChord();
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && key === "g") {
        chordRef.current = "g";
        if (chordTimerRef.current) window.clearTimeout(chordTimerRef.current);
        chordTimerRef.current = window.setTimeout(() => {
          chordRef.current = null;
          chordTimerRef.current = null;
        }, 900);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearChord();
    };
  }, [router, shortcutMap, isEditableTarget]);

  useEffect(() => {
    if (!searchOpen) setSearchQuery("");
  }, [searchOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, commandItems.length]);

  const handleSelectItem = useCallback((item?: CommandItem) => {
    if (!item?.href) return;
    router.push(item.href);
    setSearchOpen(false);
  }, [router]);

  const handleInputKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (commandItems.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, commandItems.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelectItem(commandItems[activeIndex]);
    }
  }, [commandItems, activeIndex, handleSelectItem]);

  const unreadCount = notifications.filter((item) => !item.readAt && !item.dismissedAt).length;

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(1120px,calc(100%-1.5rem))] -translate-x-1/2">
          <div className="glass-panel dock-shadow flex items-center gap-2 rounded-[28px] px-2 py-2 md:gap-3 md:px-3">
            <div className="hidden md:flex items-center gap-1 pr-1">
              <PilotOrb className="h-7 w-7" />
            </div>

            <div className="flex items-center gap-1">
              {primaryNav.map((item) => (
                <DockNavItem
                  key={item.href}
                  item={item}
                  active={pathname === item.href}
                  onClick={() => router.push(item.href)}
                />
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition",
                      "hover:text-foreground hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    aria-label="More navigation"
                  >
                    <Wrench className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>More</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {secondaryNav.map((item) => (
                    <DropdownMenuItem key={item.href} onClick={() => router.push(item.href)}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1 px-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-background/70 px-4 py-2 text-sm text-muted-foreground",
                  "transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label="Open command search"
              >
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="hidden md:inline">Ask WealthPilot or search...</span>
                <span className="md:hidden">Ask or search</span>
                <span className="ml-auto hidden items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground md:inline-flex">
                  <Command className="h-3 w-3" />
                  K
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition",
                      "hover:text-foreground hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    aria-label="Quick tools"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Quick Tools</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/transactions")}>Add transaction</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/import")}>Import CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/budgets")}>Adjust budget</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/goals")}>New goal</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition",
                      "hover:text-foreground hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    aria-label="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    Notifications
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto px-2 py-1 text-xs"
                        onClick={() => markAllRead()}
                      >
                        Mark all read
                      </Button>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <DropdownMenuItem
                        key={notification.id}
                        className="flex items-start gap-3 py-3"
                        onClick={() => {
                          void markRead(notification.id);
                          if (notification.actionHref) router.push(notification.actionHref);
                        }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{notification.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition",
                  "hover:text-foreground hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-3 text-xs font-medium",
                      "text-foreground transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    aria-label="Account switcher"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: selectedAccount?.color || "rgb(44,177,188)" }}
                    />
                    <span className="hidden sm:inline">
                      {selectedAccount?.name || "All Accounts"}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Accounts</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setSelectedAccountId("all")}
                    className="flex items-center justify-between"
                  >
                    <span>All Accounts</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        <Money amount={totalBalance} />
                      </span>
                      {selectedAccountId === "all" && <Check className="h-4 w-4" />}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {accounts.map((account) => (
                    <DropdownMenuItem
                      key={account.id}
                      onClick={() => setSelectedAccountId(account.id!)}
                      className="flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: account.color }}
                        />
                        <span className="truncate">{account.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          <Money amount={account.balance} currency={account.currency} />
                        </span>
                        {selectedAccountId === account.id && <Check className="h-4 w-4" />}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </TooltipProvider>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="sr-only">Command Center</DialogTitle>
          </DialogHeader>
          <div className="flex items-center border-b px-4 pb-4">
            <Search className="mr-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Ask WealthPilot or search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="border-0 bg-transparent p-0 focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {searchQuery ? (
              commandItems.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No results found for "{searchQuery}"
                </p>
              ) : (
                <div className="space-y-1">
                  {commandItems.map((item, index) => {
                    const isActive = index === activeIndex;
                    const amountClass = item.amount !== undefined
                      ? cn(
                        "font-semibold tabular-nums",
                        item.amount < 0
                          ? "text-destructive"
                          : item.type === "goal"
                            ? "text-info"
                            : "text-success"
                      )
                      : "";
                    const currency = item.type === "transaction" || item.type === "account"
                      ? getAccountCurrency(item.accountId)
                      : baseCurrency;
                    const hasAmount = item.amount !== undefined;
                    const fractionDigits = item.type === "goal" ? 0 : 2;

                    return (
                      <button
                        key={item.key}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-left transition",
                          isActive ? "bg-accent" : "hover:bg-accent"
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => handleSelectItem(item)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{item.label}</span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasAmount && (
                            <Money
                              amount={item.amount as number}
                              currency={currency}
                              className={amountClass}
                              minimumFractionDigits={fractionDigits}
                              maximumFractionDigits={fractionDigits}
                            />
                          )}
                          {item.shortcut && (
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                              {item.shortcut}
                            </kbd>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-4 p-4">
                <div className="flex flex-wrap gap-2">
                  {["Search", "Transfer", "Import", "Budget"].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Quick Actions
                  </p>
                  <div className="space-y-1">
                    {commandItems.map((item, index) => (
                      <button
                        key={item.key}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-left",
                          index === activeIndex ? "bg-accent" : "hover:bg-accent"
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => handleSelectItem(item)}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                  Try: <span className="font-medium text-foreground">last month</span>,{" "}
                  <span className="font-medium text-foreground">&gt; 200</span>,{" "}
                  <span className="font-medium text-foreground">merchant:netflix</span>,{" "}
                  <span className="font-medium text-foreground">tag:travel</span>.
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DockNavItem({
  item,
  active,
  onClick,
}: {
  item: DockItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-2xl text-muted-foreground transition",
            "hover:text-foreground hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-primary/15 text-primary"
          )}
          aria-label={item.label}
        >
          <item.icon className="h-4 w-4" />
          {active && (
            <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-primary" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{item.label}</TooltipContent>
    </Tooltip>
  );
}
