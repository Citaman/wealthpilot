"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { NotificationsSettings } from "@/components/settings/notifications-settings";
import { FinancialMonthSettingsCard } from "@/components/settings/financial-month-settings";
import { AccountBalanceSettings } from "@/components/settings/account-balance-settings";
import { DataManagementSettings } from "@/components/settings/data-management-settings";
import { AboutSettings } from "@/components/settings/about-settings";
import { HelpSettings } from "@/components/settings/help-settings";

type SettingsTab = "general" | "finance" | "data" | "help" | "about";

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("general");

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground">Manage your preferences, finances, and data</p>
            </div>

            <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="help">Help</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-6">
            <TabsContent value="general" className="space-y-6">
              <AppearanceSettings />
              <NotificationsSettings />
            </TabsContent>

            <TabsContent value="finance" className="space-y-6">
              <FinancialMonthSettingsCard />
              <AccountBalanceSettings />
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <DataManagementSettings />
            </TabsContent>
            
            <TabsContent value="help" className="space-y-6">
              <HelpSettings />
            </TabsContent>

            <TabsContent value="about" className="space-y-6">
              <AboutSettings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
