"use client";

import { usePathname } from "next/navigation";
import { CommandDock } from "./command-dock";
import { getRouteMeta } from "./route-registry";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { DatabaseStatusBanner } from "./database-status-banner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const meta = getRouteMeta(pathname || "/");

  return (
    <div className="min-h-dvh lg:pl-[var(--shell-sidebar-width)]">
      <a href="#contenu-principal" className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background focus:translate-y-0">Aller au contenu</a>
      <CommandDock />
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-[calc(var(--shell-mobile-nav-height)+2rem+env(safe-area-inset-bottom))] pt-[calc(var(--shell-mobile-header-height)+1.25rem+env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        {meta && pathname !== "/" && (
          <header className="mb-8 hidden lg:block">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{meta.title}</h1>
            <p className="mt-1 max-w-3xl text-base text-muted-foreground">{meta.subtitle}</p>
          </header>
        )}
        <DatabaseStatusBanner />
        <main id="contenu-principal" tabIndex={-1} className="animate-float-in outline-none">
          <ErrorBoundary key={pathname}>{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
