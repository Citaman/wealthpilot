"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar wrapper - sticky container */}
      <div className="hidden shrink-0 md:block">
        <div className="sticky top-0 h-screen">
          <Sidebar mode="desktop" />
        </div>
      </div>
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent
          className="left-0 top-0 h-[100dvh] w-[280px] max-w-none translate-x-0 translate-y-0 rounded-none border-l-0 p-0"
        >
          <div className="h-full">
            <Sidebar mode="mobile" onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
