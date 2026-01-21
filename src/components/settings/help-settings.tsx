"use client";

import { HelpCircle, FileText, Database, Shield } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function HelpSettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help & Documentation
          </CardTitle>
          <CardDescription>
            Learn how WealthPilot protects your data and how to use key features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="flex gap-2">
                <Database className="h-4 w-4 text-primary" />
                Where is my data stored?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  WealthPilot follows a <strong>Local-First</strong> architecture. All your transactions,
                  accounts, and settings are stored in a database <strong>inside your browser</strong> (IndexedDB).
                </p>
                <p className="mt-2">
                  We do not have a backend server. We cannot see, sell, or lose your data. However, this means
                  <strong> if you clear your browser data, you lose your finance data</strong> unless you have a backup.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger className="flex gap-2">
                <Shield className="h-4 w-4 text-primary" />
                How do backups work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>
                  You can create a <strong>Backup File (.json)</strong> at any time from the <em>Data</em> tab.
                  This file contains a complete snapshot of your database.
                </p>
                <p className="mt-2">
                  <strong>Recommendation:</strong> Download a backup once a month or after major changes.
                  Store this file in a secure location (Google Drive, iCloud, USB stick).
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger className="flex gap-2">
                <FileText className="h-4 w-4 text-primary" />
                How do I move data to a new device?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>On your old device, go to Settings &gt; Data.</li>
                  <li>Click <strong>Export Backup</strong>.</li>
                  <li>Transfer the downloaded file to your new device.</li>
                  <li>On the new device, open WealthPilot &gt; Settings &gt; Data.</li>
                  <li>Click <strong>Import Backup</strong> and select the file.</li>
                  <li>Choose <strong>Replace All</strong> to restore your exact state.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>What is the difference between Replace and Merge?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Replace All (Default):</strong> Wipes the current device and restores the backup exactly.
                    Best for moving to a new phone or restoring after a mistake.
                  </li>
                  <li>
                    <strong>Merge (Advanced):</strong> Keeps your current data and adds the backup data to it.
                    Useful if you want to combine data, but be careful: it can create duplicates if the data sources aren't clean.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
