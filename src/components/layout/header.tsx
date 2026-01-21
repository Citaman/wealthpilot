"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Search,
  Bell,
  Command,
  X,
} from "lucide-react";
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

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<{ id: string; title: string; time: string }[]>([
    { id: "1", title: "Budget limit reached for Food", time: "2 hours ago" },
    { id: "2", title: "New transaction detected", time: "5 hours ago" },
  ]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // TODO: Implement search logic
  }, []);

  const dismissNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-6">
        <div>
          <h1 className="text-xl font-semibold">
            {pageTitles[pathname] || "WealthPilot"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
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
              placeholder="Search transactions, categories, merchants..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="border-0 bg-transparent p-0 focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {searchQuery ? (
              <div className="space-y-2 p-4">
                <p className="text-sm text-muted-foreground">
                  Searching for "{searchQuery}"...
                </p>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    Quick Actions
                  </p>
                  <div className="space-y-1">
                    {[
                      { label: "Import CSV", href: "/import" },
                      { label: "Add Goal", href: "/goals" },
                      { label: "View Analytics", href: "/analytics" },
                    ].map((action) => (
                      <button
                        key={action.href}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-sm hover:bg-accent"
                        onClick={() => {
                          router.push(action.href);
                          setSearchOpen(false);
                        }}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
