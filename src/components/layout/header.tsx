"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  Bell,
  Command,
  X,
  Menu,
  Eye,
  EyeOff,
} from "lucide-react";
import { usePrivacy } from "@/contexts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCommandSearch, type SearchResult } from "@/hooks/use-command-search";
import { Money } from "@/components/ui/money";
import { useMoney } from "@/hooks/use-money";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/transactions": "Transactions",
  "/analytics": "Analytics",
  "/budgets": "Budget Planning",
  "/goals": "Savings Goals",
  "/subscriptions": "Subscriptions",
  "/accounts": "Accounts",
  "/import": "Import Data",
  "/settings": "Settings",
  "/calendar": "Bill Calendar",
  "/categories": "Categories",
};

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

export function Header({
  onOpenMobileNav,
}: {
  onOpenMobileNav?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const { baseCurrency, getAccountCurrency } = useMoney();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = useCommandSearch(searchQuery);
  const [activeIndex, setActiveIndex] = useState(0);
  const chordRef = useRef<"g" | null>(null);
  const chordTimerRef = useRef<number | null>(null);
  const [notifications, setNotifications] = useState<{ id: string; title: string; time: string }[]>([
    { id: "1", title: "Budget limit reached for Food", time: "2 hours ago" },
    { id: "2", title: "New transaction detected", time: "5 hours ago" },
  ]);

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

  // Keyboard shortcut for search + global navigation chords.
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

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

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

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => onOpenMobileNav?.()}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div>
            <h1 className="text-xl font-semibold">
              {pageTitles[pathname] || "WealthPilot"}
            </h1>
            <p className="hidden text-sm text-muted-foreground sm:block">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <Button
            variant="outline"
            className="hidden w-64 justify-start gap-2 text-muted-foreground md:flex"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span>Search...</span>
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <Command className="h-3 w-3" />K
            </kbd>
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Privacy Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={togglePrivacyMode}
            title={isPrivacyMode ? "Show sensitive data (Shift+P)" : "Hide sensitive data (Shift+P)"}
            aria-label={isPrivacyMode ? "Show sensitive data" : "Hide sensitive data"}
          >
            {isPrivacyMode ? (
              <EyeOff className="h-4 w-4 text-primary" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                Notifications
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs"
                    onClick={() => setNotifications([])}
                  >
                    Clear all
                  </Button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No new notifications
                </div>
              ) : (
                notifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex items-start gap-3 py-3"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {notification.time}
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
        </div>
      </header>

      {/* Command Palette / Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="sr-only">Search</DialogTitle>
          </DialogHeader>
          <div className="flex items-center border-b px-4 pb-4">
            <Search className="mr-3 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={'Search transactions, merchants, categories... try ">100" or "last month"'}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="border-0 bg-transparent p-0 focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {searchQuery ? (
              commandItems.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No results found for "{searchQuery}"</p>
              ) : (
                <div className="space-y-1">
                  {commandItems.map((item, index) => {
                    const isActive = index === activeIndex;
                    const amountClass = item.amount !== undefined
                      ? cn(
                          "font-mono font-semibold",
                          item.amount < 0
                            ? "text-red-500"
                            : item.type === "goal"
                              ? "text-blue-500"
                              : "text-emerald-500"
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
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left",
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
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Quick Actions
                  </p>
                  <div className="space-y-1">
                    {commandItems.map((item, index) => (
                      <button
                        key={item.key}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-left",
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
                <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
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
