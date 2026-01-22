"use client";

import { Database, Download, Upload, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { useState, useEffect, type ChangeEvent } from "react";
import { db, initializeDatabase } from "@/lib/db";
import {
  buildBackupFileName,
  createBackupBlob,
  readBackupFileAsText,
  validateSnapshotV1,
  restoreReplaceSnapshotV1,
  restoreMergeSnapshotV1,
  clearAllUserData,
  getStringSetting,
  setStringSetting,
  decryptData,
  type BackupPreview,
  type BackupSnapshotV1,
} from "@/lib/backups";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { recalculateAllBalances } from "@/lib/balance";
import { StressTestControl } from "./stress-test-control";

export function DataManagementSettings() {
  const { toast } = useToast();
  
  // Stats
  const [stats, setStats] = useState({
    transactions: 0,
    goals: 0,
    budgets: 0,
    accounts: 0,
  });

  // Export State
  const [exportLoading, setExportLoading] = useState(false);
  const [backupGzip, setBackupGzip] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [useEncryption, setUseEncryption] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [showExportPassPrompt, setShowExportPassPrompt] = useState(false);

  // Restore State
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSnapshot, setRestoreSnapshot] = useState<BackupSnapshotV1 | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null);
  const [createPreRestoreBackup, setCreatePreRestoreBackup] = useState(true);
  const [restoreDiagnostics, setRestoreDiagnostics] = useState<object | null>(null);
  const [restoreStrategy, setRestoreStrategy] = useState<"replace" | "merge">("replace");
  const [importPassphrase, setImportPassphrase] = useState("");
  const [isEncryptedImport, setIsEncryptedImport] = useState(false);
  const [rawImportText, setRawImportText] = useState<string | null>(null);

  // Reset State
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetExportFirst, setResetExportFirst] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    refreshStats();
    
    getStringSetting("lastBackupAt")
      .then((value) => setLastBackupAt(value))
      .catch(() => setLastBackupAt(null));

    getStringSetting("backupGzip")
      .then((value) => {
        if (value === "true" || value === "false") setBackupGzip(value === "true");
      })
      .catch(() => undefined);
  }, []);

  const refreshStats = async () => {
    const [transactions, goals, budgets, accounts] = await Promise.all([
      db.transactions.count(),
      db.goals.count(),
      db.budgets.count(),
      db.accounts.count(),
    ]);
    setStats({ transactions, goals, budgets, accounts });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupGzipChange = async (next: boolean) => {
    setBackupGzip(next);
    try {
      await setStringSetting("backupGzip", String(next));
    } catch {
      // Non-blocking
    }
  };

  const handleExportBackup = async (options?: { prefix?: string; gzip?: boolean; passphrase?: string }) => {
    setExportLoading(true);
    try {
      const gzip = options?.gzip ?? backupGzip;
      const passphrase = options?.passphrase || (useEncryption ? exportPassphrase : undefined);
      
      const { blob, extension, warning } = await createBackupBlob({ gzip, passphrase });
      const filename = buildBackupFileName(options?.prefix ?? "wealthpilot-backup", extension);
      downloadBlob(blob, filename);

      const now = new Date().toISOString();
      await setStringSetting("lastBackupAt", now);
      setLastBackupAt(now);

      if (warning === "gzip-not-supported") {
        toast({
          title: "Backup Exported",
          description: "Exported uncompressed JSON (gzip not supported).",
        });
      } else {
        toast({
          variant: "success",
          title: "Backup Exported",
          description: `Saved as ${filename}${passphrase ? " (Encrypted)" : ""}`,
        });
      }

      setExportPassphrase("");
      setShowExportPassPrompt(false);
      return { exportedAt: now, filename };
    } catch (error) {
      console.error("Backup export failed:", error);
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Could not create backup file.",
      });
      return null;
    } finally {
      setExportLoading(false);
    }
  };

  const downloadDiagnostics = (diagnostics: object) => {
    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: "application/json" });
    downloadBlob(blob, buildBackupFileName("wealthpilot-restore-diagnostics", "json"));
  };

  const handleSelectRestoreFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoreDiagnostics(null);
    setRestoreSnapshot(null);
    setRestorePreview(null);
    setRestoreFileName(file.name);
    setRestoreStrategy("replace"); // Default back to replace
    setIsEncryptedImport(file.name.endsWith(".wpenc"));
    setImportPassphrase("");

    try {
      const text = await readBackupFileAsText(file);
      setRawImportText(text);

      if (file.name.endsWith(".wpenc")) {
        // Just open dialog to ask for passphrase
        setRestoreDialogOpen(true);
        return;
      }

      const parsed = JSON.parse(text);

      const { ok, snapshot, preview } = validateSnapshotV1(parsed);
      setRestorePreview(preview);

      if (!ok || !snapshot) {
        const diagnostics = {
          fileName: file.name,
          createdAt: new Date().toISOString(),
          preview,
        };
        setRestoreDiagnostics(diagnostics);
        toast({
          variant: "destructive",
          title: "Invalid Backup",
          description: "File is invalid or corrupted. Review diagnostics.",
        });
        return;
      }

      setRestoreSnapshot(snapshot);
      setRestoreDialogOpen(true);
    } catch (error) {
      console.error("Failed to read/validate backup:", error);
      const diagnostics = {
        fileName: file.name,
        createdAt: new Date().toISOString(),
        error: String(error),
      };
      setRestoreDiagnostics(diagnostics);
      toast({
        variant: "destructive",
        title: "Read Failed",
        description: "Could not parse backup file.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleDecryptAndPreview = async () => {
    if (!rawImportText || !importPassphrase) return;
    
    setRestoreLoading(true);
    try {
      const decrypted = await decryptData(rawImportText, importPassphrase);
      const parsed = JSON.parse(decrypted);
      const { ok, snapshot, preview } = validateSnapshotV1(parsed);
      
      setRestorePreview(preview);
      if (ok && snapshot) {
        setRestoreSnapshot(snapshot);
      } else {
        toast({
          variant: "destructive",
          title: "Invalid Data",
          description: "Decrypted data is not a valid WealthPilot backup.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Decryption Failed",
        description: "Invalid passphrase. Please try again.",
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreSnapshot) return;

    setRestoreLoading(true);
    try {
      let preRestoreBackupAt: string | null = null;
      if (createPreRestoreBackup) {
        const result = await handleExportBackup({ prefix: "wealthpilot-pre-restore", gzip: false });
        preRestoreBackupAt = result?.exportedAt ?? null;
      }

      if (restoreStrategy === "merge") {
        await restoreMergeSnapshotV1(restoreSnapshot);
      } else {
        await restoreReplaceSnapshotV1(restoreSnapshot);
      }
      
      await recalculateAllBalances();

      if (createPreRestoreBackup) {
        if (preRestoreBackupAt) {
          await setStringSetting("lastBackupAt", preRestoreBackupAt);
          setLastBackupAt(preRestoreBackupAt);
        }
      } else {
        const restoredLastBackupAt = await getStringSetting("lastBackupAt");
        setLastBackupAt(restoredLastBackupAt);
      }

      await refreshStats();
      
      setRestoreDialogOpen(false);
      setRestoreSnapshot(null);
      setRestorePreview(null);
      setRestoreFileName(null);

      toast({
        variant: "success",
        title: "Restore Complete",
        description: `Successfully ${restoreStrategy === "merge" ? "merged" : "restored"} backup data.`,
      });
      
      // Force reload to ensure UI consistency if needed, though react state should handle most
      // router.refresh() might be needed if context doesn't update, but we are in client component
    } catch (error) {
      console.error("Restore failed:", error);
      toast({
        variant: "destructive",
        title: "Restore Failed",
        description: "Your existing data should be unchanged.",
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (resetConfirmText.trim() !== "RESET") return;

    setResetLoading(true);

    try {
      let preResetBackupAt: string | null = null;
      if (resetExportFirst) {
        const result = await handleExportBackup({ prefix: "wealthpilot-pre-reset", gzip: false });
        preResetBackupAt = result?.exportedAt ?? null;
      }

      await clearAllUserData();
      await initializeDatabase();
      await refreshStats();

      if (resetExportFirst) {
        if (preResetBackupAt) {
          await setStringSetting("lastBackupAt", preResetBackupAt);
          setLastBackupAt(preResetBackupAt);
        }
      } else {
        setLastBackupAt(null);
      }

      setResetDialogOpen(false);
      setResetConfirmText("");
      setResetExportFirst(true);
      
      toast({
        variant: "success",
        title: "App Reset",
        description: "All data has been cleared and reset to defaults.",
      });
    } catch (error) {
      console.error("Reset failed:", error);
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: "Could not reset the application.",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data & Backups
          </CardTitle>
          <CardDescription>
            Offline-first means your browser holds your data — backups keep it safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-4">
            {[
              { label: "Transactions", value: stats.transactions },
              { label: "Goals", value: stats.goals },
              { label: "Budgets", value: stats.budgets },
              { label: "Accounts", value: stats.accounts },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Backup */}
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <p className="font-medium">Backup</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lastBackupAt
                    ? `Last backup: ${format(new Date(lastBackupAt), "PPp")}`
                    : "No backup recorded yet."}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="backup-gzip"
                    checked={backupGzip}
                    onCheckedChange={(v) => handleBackupGzipChange(v === true)}
                  />
                  <Label htmlFor="backup-gzip" className="text-sm">
                    Advanced: gzip (.json.gz)
                  </Label>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="backup-encrypt"
                    checked={useEncryption}
                    onCheckedChange={(v) => setUseEncryption(v === true)}
                  />
                  <Label htmlFor="backup-encrypt" className="text-sm">
                    Encrypt backup (.wpenc)
                  </Label>
                </div>
              </div>

              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() => useEncryption ? setShowExportPassPrompt(true) : handleExportBackup()}
                disabled={exportLoading}
              >
                {exportLoading ? "Preparing..." : "Export backup"}
              </Button>
            </div>

            {/* Restore */}
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <p className="font-medium">Restore</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Import a previous backup. You’ll see a preview before restoring.
                </p>
              </div>

              <div className="mt-4">
                <label>
                  <input
                    type="file"
                    accept=".json,.gz"
                    onChange={handleSelectRestoreFile}
                    className="hidden"
                  />
                  <Button variant="outline" asChild className="w-full cursor-pointer">
                    <span>Import backup…</span>
                  </Button>
                </label>

                {restoreDiagnostics && (
                  <Button
                    className="mt-2 w-full"
                    variant="secondary"
                    onClick={() => downloadDiagnostics(restoreDiagnostics)}
                  >
                    Download diagnostics
                  </Button>
                )}
              </div>
            </div>

            {/* Reset */}
            <div className="rounded-xl border border-red-200 bg-card p-4 dark:border-red-900/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <Trash2 className="h-4 w-4" />
                  <p className="font-medium">Reset App</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Clears all local data in this browser profile. Use with caution.
                </p>
              </div>

              <Button
                className="mt-4 w-full"
                variant="destructive"
                onClick={() => setResetDialogOpen(true)}
              >
                Reset…
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <StressTestControl />
          </div>
        </CardContent>
      </Card>

      {/* Export Passphrase Dialog */}
      <Dialog open={showExportPassPrompt} onOpenChange={setShowExportPassPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encrypt Backup</DialogTitle>
            <DialogDescription>
              Set a passphrase to encrypt your backup file. You will need this to restore your data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-pass">Passphrase</Label>
              <Input
                id="export-pass"
                type="password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                placeholder="Enter strong passphrase..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportPassPrompt(false)}>Cancel</Button>
            <Button onClick={() => handleExportBackup()} disabled={!exportPassphrase || exportLoading}>
              {exportLoading ? "Encrypting..." : "Export Encrypted"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Preview Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Restore Backup
            </DialogTitle>
            <DialogDescription>
              {restoreFileName ? `Preview: ${restoreFileName}` : "Preview your backup before restoring."}
            </DialogDescription>
          </DialogHeader>

          {isEncryptedImport && !restoreSnapshot && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Encrypted Backup Detected</p>
                  <p className="text-muted-foreground">Enter the passphrase to unlock and preview this backup.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-pass">Passphrase</Label>
                <div className="flex gap-2">
                  <Input
                    id="import-pass"
                    type="password"
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                    placeholder="Enter passphrase..."
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleDecryptAndPreview()}
                  />
                  <Button onClick={handleDecryptAndPreview} disabled={!importPassphrase || restoreLoading}>
                    {restoreLoading ? "Unlocking..." : "Unlock"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {restorePreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="font-semibold">{restorePreview.counts.transactions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Accounts</p>
                  <p className="font-semibold">{restorePreview.counts.accounts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Budgets</p>
                  <p className="font-semibold">{restorePreview.counts.budgets}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Goals</p>
                  <p className="font-semibold">{restorePreview.counts.goals}</p>
                </div>
              </div>

              {restorePreview.transactionDateRange && (
                <div className="text-sm text-muted-foreground">
                  Transactions date range: {restorePreview.transactionDateRange.from} → {restorePreview.transactionDateRange.to}
                </div>
              )}

              {restorePreview.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Checks</p>
                  <div className="space-y-2">
                    {restorePreview.issues.map((i, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-md border px-3 py-2 text-sm",
                          i.level === "error" && "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200",
                          i.level === "warning" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{i.level.toUpperCase()}</span>
                          {typeof i.count === "number" && (
                            <span className="text-xs opacity-80">{i.count}</span>
                          )}
                        </div>
                        <div className="mt-1">{i.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t pt-3">
                <Label>Restore Strategy</Label>
                <RadioGroup
                  value={restoreStrategy}
                  onValueChange={(v) => setRestoreStrategy(v as "replace" | "merge")}
                  className="grid grid-cols-1 gap-2"
                >
                  <div className={cn(
                    "flex items-start space-x-3 space-y-0 rounded-md border p-3",
                    restoreStrategy === "replace" && "border-primary bg-primary/5"
                  )}>
                    <RadioGroupItem value="replace" id="r-replace" className="mt-1" />
                    <Label htmlFor="r-replace" className="font-normal cursor-pointer">
                      <span className="font-medium block">Replace All (Dangerous)</span>
                      <span className="text-muted-foreground text-xs">
                        Deletes ALL current data and replaces it with the backup. Use when switching devices or full recovery.
                      </span>
                    </Label>
                  </div>
                  <div className={cn(
                    "flex items-start space-x-3 space-y-0 rounded-md border p-3",
                    restoreStrategy === "merge" && "border-primary bg-primary/5"
                  )}>
                    <RadioGroupItem value="merge" id="r-merge" className="mt-1" />
                    <Label htmlFor="r-merge" className="font-normal cursor-pointer">
                      <span className="font-medium block">Merge (Advanced)</span>
                      <span className="text-muted-foreground text-xs">
                        Keeps existing data. Adds missing records from backup. Updates records if IDs match.
                        Warning: May create duplicates if IDs don't match.
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="pre-restore"
                  checked={createPreRestoreBackup}
                  onCheckedChange={(v) => setCreatePreRestoreBackup(v === true)}
                />
                <Label htmlFor="pre-restore" className="text-sm">
                  Create a pre-restore backup first (recommended)
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} disabled={restoreLoading}>
              Cancel
            </Button>
            <Button
              variant={restoreStrategy === "replace" ? "destructive" : "default"}
              onClick={handleConfirmRestore}
              disabled={!restoreSnapshot || restoreLoading}
            >
              {restoreLoading ? "Restoring…" : restoreStrategy === "replace" ? "Replace & Restore" : "Merge & Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Reset App
            </DialogTitle>
            <DialogDescription>
              This clears all locally stored data in this browser profile. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">You are about to remove:</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• {stats.transactions} transactions</li>
                <li>• {stats.goals} goals</li>
                <li>• {stats.budgets} budget settings</li>
                <li>• {stats.accounts} accounts</li>
              </ul>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="reset-export-first"
                checked={resetExportFirst}
                onCheckedChange={(v) => setResetExportFirst(v === true)}
              />
              <Label htmlFor="reset-export-first" className="text-sm">
                Export a backup first (recommended)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm">Type RESET to confirm</Label>
              <Input
                id="reset-confirm"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)} disabled={resetLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReset}
              disabled={resetLoading || resetConfirmText.trim() !== "RESET"}
            >
              {resetLoading ? "Resetting…" : "Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
