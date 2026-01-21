"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PieChart,
  Target,
  Calendar,
  CreditCard,
  Settings,
  Upload,
  ChevronLeft,
  Moon,
  Sun,
  Wallet,
  TrendingUp,
  Bell,
  RefreshCw,
  Building2,
  PiggyBank,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "@/contexts/account-context";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { title: "Analytics", href: "/analytics", icon: PieChart },
  { title: "Budgets", href: "/budgets", icon: Wallet },
  { title: "Goals", href: "/goals", icon: Target },
  { title: "Subscriptions", href: "/subscriptions", icon: RefreshCw },
  { title: "Bill Calendar", href: "/calendar", icon: Calendar },
];

const secondaryNavItems: NavItem[] = [
  { title: "Accounts", href: "/accounts", icon: CreditCard },
  { title: "Import Data", href: "/import", icon: Upload },
  { title: "Settings", href: "/settings", icon: Settings },
];

const ACCOUNT_ICONS: Record<string, React.ElementType> = {
  checking: Building2,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  cash: Wallet,
};

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { accounts, selectedAccountId, selectedAccount, setSelectedAccountId, totalBalance } = useAccount();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getAccountIcon = (type: string) => {
    const IconComponent = ACCOUNT_ICONS[type] || Wallet;
    return IconComponent;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r bg-card transition-all duration-300 overflow-hidden",
          collapsed ? "w-[72px]" : "w-[260px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">WealthPilot</span>
            </Link>
          )}
          {collapsed && (
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Account Selector */}
        {accounts.length > 0 && (
          <div className={cn("border-b", collapsed ? "p-2" : "p-3")}>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="w-full h-10">
                        {selectedAccount ? (
                          <div
                            className="h-5 w-5 rounded-full"
                            style={{ backgroundColor: selectedAccount.color }}
                          />
                        ) : (
                          <Wallet className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuItem
                        onClick={() => setSelectedAccountId("all")}
                        className="flex items-center justify-between"
                      >
                        <span>All Accounts</span>
                        {selectedAccountId === "all" && <Check className="h-4 w-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {accounts.map((account) => {
                        const IconComponent = getAccountIcon(account.type);
                        return (
                          <DropdownMenuItem
                            key={account.id}
                            onClick={() => setSelectedAccountId(account.id!)}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: account.color }}
                              />
                              <span>{account.name}</span>
                            </div>
                            {selectedAccountId === account.id && <Check className="h-4 w-4" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {selectedAccount?.name || "All Accounts"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-auto py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {selectedAccount ? (
                        <>
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: selectedAccount.color }}
                          />
                          <span className="truncate">{selectedAccount.name}</span>
                        </>
                      ) : (
                        <>
                          <Wallet className="h-4 w-4 flex-shrink-0" />
                          <span>All Accounts</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(selectedAccount?.balance ?? totalBalance)}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[232px]">
                  <DropdownMenuItem
                    onClick={() => setSelectedAccountId("all")}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      <span>All Accounts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(totalBalance)}
                      </span>
                      {selectedAccountId === "all" && <Check className="h-4 w-4" />}
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {accounts.map((account) => {
                    const IconComponent = getAccountIcon(account.type);
                    return (
                      <DropdownMenuItem
                        key={account.id}
                        onClick={() => setSelectedAccountId(account.id!)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: account.color }}
                          />
                          <span className="truncate">{account.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(account.balance)}
                          </span>
                          {selectedAccountId === account.id && <Check className="h-4 w-4" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-thin">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {!collapsed && "Main"}
          </div>
          {mainNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}

          <div className="my-4 border-t" />

          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {!collapsed && "Settings"}
          </div>
          {secondaryNavItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t p-3">
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="h-9 w-9"
                >
                  {theme === "light" ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {theme === "light" ? "Dark mode" : "Light mode"}
              </TooltipContent>
            </Tooltip>

            {!collapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Bell className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Notifications</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(!collapsed)}
                  className="h-9 w-9"
                >
                  <ChevronLeft
                    className={cn(
                      "h-4 w-4 transition-transform",
                      collapsed && "rotate-180"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {collapsed ? "Expand" : "Collapse"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2"
      )}
    >
      <item.icon className={cn("h-5 w-5", collapsed && "h-5 w-5")} />
      {!collapsed && <span>{item.title}</span>}
      {!collapsed && item.badge && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-medium text-destructive-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}
