"use client";

import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { MigrationWizard } from "@/components/import/migration-wizard";

export default function ImportPage() {
  const router = useRouter();

  return (
    <AppLayout>
      <div className="space-y-6">
        <MigrationWizard onComplete={() => router.push("/transactions")} />

        <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="text-xs text-muted-foreground">
            <p className="mb-0.5 font-medium text-foreground">Vos données restent privées</p>
            <p>Les fichiers sont traités et stockés localement dans ce navigateur.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
