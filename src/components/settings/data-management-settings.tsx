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
import { logger } from "@/lib/logger";

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
          title: "Sauvegarde exportée",
          description: "Le JSON non compressé a été exporté (gzip indisponible).",
        });
      } else {
        toast({
          variant: "success",
          title: "Sauvegarde exportée",
          description: `Fichier enregistré : ${filename}${passphrase ? " (chiffré)" : ""}`,
        });
      }

      setExportPassphrase("");
      setShowExportPassPrompt(false);
      return { exportedAt: now, filename };
    } catch (error) {
      logger.error("Backup export failed:", error);
      toast({
        variant: "destructive",
        title: "Échec de l’export",
        description: "Impossible de créer le fichier de sauvegarde.",
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
          title: "Sauvegarde invalide",
          description: "Le fichier est invalide ou corrompu. Consultez le diagnostic.",
        });
        return;
      }

      setRestoreSnapshot(snapshot);
      setRestoreDialogOpen(true);
    } catch (error) {
      logger.error("Failed to read/validate backup:", error);
      const diagnostics = {
        fileName: file.name,
        createdAt: new Date().toISOString(),
        error: String(error),
      };
      setRestoreDiagnostics(diagnostics);
      toast({
        variant: "destructive",
        title: "Lecture impossible",
        description: "Le fichier de sauvegarde n’a pas pu être analysé.",
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
          title: "Données invalides",
          description: "Le contenu déchiffré n’est pas une sauvegarde WealthPilot valide.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Échec du déchiffrement",
        description: "Phrase secrète incorrecte. Réessayez.",
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
        title: "Restauration terminée",
        description: restoreStrategy === "merge" ? "Les données ont été fusionnées." : "La sauvegarde a été restaurée.",
      });
      
      // Force reload to ensure UI consistency if needed, though react state should handle most
      // router.refresh() might be needed if context doesn't update, but we are in client component
    } catch (error) {
      logger.error("Restore failed:", error);
      toast({
        variant: "destructive",
        title: "Échec de la restauration",
        description: "Vos données existantes devraient être inchangées.",
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
        title: "Application réinitialisée",
        description: "Toutes les données locales ont été effacées et les valeurs par défaut restaurées.",
      });
    } catch (error) {
      logger.error("Reset failed:", error);
      toast({
        variant: "destructive",
        title: "Échec de la réinitialisation",
        description: "Impossible de réinitialiser l’application.",
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
            Données et sauvegardes
          </CardTitle>
          <CardDescription>
            Vos données restent dans ce navigateur : les sauvegardes vous permettent de les protéger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4 sm:grid-cols-4">
            {[
              { label: "Transactions", value: stats.transactions },
              { label: "Objectifs", value: stats.goals },
              { label: "Budgets", value: stats.budgets },
              { label: "Comptes", value: stats.accounts },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
            {/* Backup */}
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <p className="font-medium">Sauvegarde</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lastBackupAt
                    ? `Dernière sauvegarde : ${format(new Date(lastBackupAt), "PPp")}`
                    : "Aucune sauvegarde enregistrée."}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="backup-gzip"
                    checked={backupGzip}
                    onCheckedChange={(v) => handleBackupGzipChange(v === true)}
                  />
                  <Label htmlFor="backup-gzip" className="text-sm">
                    Avancé : compression gzip (.json.gz)
                  </Label>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Checkbox
                    id="backup-encrypt"
                    checked={useEncryption}
                    onCheckedChange={(v) => setUseEncryption(v === true)}
                  />
                  <Label htmlFor="backup-encrypt" className="text-sm">
                    Chiffrer la sauvegarde (.wpenc)
                  </Label>
                </div>
              </div>

              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() => useEncryption ? setShowExportPassPrompt(true) : handleExportBackup()}
                loading={exportLoading}
              >
                Exporter la sauvegarde
              </Button>
            </div>

            {/* Restore */}
            <div className="rounded-xl border bg-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  <p className="font-medium">Restaurer</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Importez une sauvegarde après en avoir vérifié l’aperçu.
                </p>
              </div>

              <div className="mt-4">
                <input
                  id="restore-backup-file"
                  type="file"
                  accept=".json,.gz,.wpenc"
                  onChange={handleSelectRestoreFile}
                  className="peer sr-only"
                />
                <Button variant="outline" asChild className="w-full cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                  <label htmlFor="restore-backup-file">Importer une sauvegarde…</label>
                </Button>

                {restoreDiagnostics && (
                  <Button
                    className="mt-2 w-full"
                    variant="secondary"
                    onClick={() => downloadDiagnostics(restoreDiagnostics)}
                  >
                    Télécharger le diagnostic
                  </Button>
                )}
              </div>
            </div>

            {/* Reset */}
            <div className="rounded-xl border border-muted bg-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-foreground">
                  <Trash2 className="h-4 w-4" />
                  <p className="font-medium">Réinitialiser l’application</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Efface toutes les données locales de ce profil de navigateur.
                </p>
              </div>

              <Button
                className="mt-4 w-full"
                variant="destructive"
                onClick={() => setResetDialogOpen(true)}
              >
                Réinitialiser…
              </Button>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Export Passphrase Dialog */}
      <Dialog open={showExportPassPrompt} onOpenChange={setShowExportPassPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chiffrer la sauvegarde</DialogTitle>
            <DialogDescription>
              Définissez une phrase secrète. Elle sera indispensable pour restaurer ce fichier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-pass">Phrase secrète</Label>
              <Input
                id="export-pass"
                type="password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                placeholder="Saisissez une phrase secrète robuste…"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportPassPrompt(false)}>Annuler</Button>
            <Button onClick={() => handleExportBackup()} disabled={!exportPassphrase} loading={exportLoading}>
              Exporter le fichier chiffré
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
              Restaurer une sauvegarde
            </DialogTitle>
            <DialogDescription>
              {restoreFileName ? `Aperçu : ${restoreFileName}` : "Vérifiez la sauvegarde avant de la restaurer."}
            </DialogDescription>
          </DialogHeader>

          {isEncryptedImport && !restoreSnapshot && (
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex gap-3">
                <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Sauvegarde chiffrée détectée</p>
                  <p className="text-muted-foreground">Saisissez la phrase secrète pour afficher son aperçu.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-pass">Phrase secrète</Label>
                <div className="flex gap-2">
                  <Input
                    id="import-pass"
                    type="password"
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                    placeholder="Saisissez la phrase secrète…"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleDecryptAndPreview()}
                  />
                  <Button onClick={handleDecryptAndPreview} disabled={!importPassphrase} loading={restoreLoading}>
                    Déverrouiller
                  </Button>
                </div>
              </div>
            </div>
          )}

          {restorePreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="font-semibold">{restorePreview.counts.transactions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Comptes</p>
                  <p className="font-semibold">{restorePreview.counts.accounts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Budgets</p>
                  <p className="font-semibold">{restorePreview.counts.budgets}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Objectifs</p>
                  <p className="font-semibold">{restorePreview.counts.goals}</p>
                </div>
              </div>

              {restorePreview.transactionDateRange && (
                <div className="text-sm text-muted-foreground">
                  Période des transactions : {restorePreview.transactionDateRange.from} → {restorePreview.transactionDateRange.to}
                </div>
              )}

              {restorePreview.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Contrôles</p>
                  <div className="space-y-2">
                    {restorePreview.issues.map((i, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-md border px-3 py-2 text-sm",
                          i.level === "error" && "border-destructive/40 bg-destructive/10 text-foreground",
                          i.level === "warning" && "border-muted bg-muted/30 text-foreground"
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
                <Label>Mode de restauration</Label>
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
                      <span className="font-medium block">Tout remplacer (destructif)</span>
                      <span className="text-muted-foreground text-xs">
                        Efface toutes les données locales et les remplace par la sauvegarde. À utiliser pour changer d’appareil ou restaurer complètement.
                      </span>
                    </Label>
                  </div>
                  <div className={cn(
                    "flex items-start space-x-3 space-y-0 rounded-md border p-3",
                    restoreStrategy === "merge" && "border-primary bg-primary/5"
                  )}>
                    <RadioGroupItem value="merge" id="r-merge" className="mt-1" />
                    <Label htmlFor="r-merge" className="font-normal cursor-pointer">
                      <span className="font-medium block">Fusionner (avancé)</span>
                      <span className="text-muted-foreground text-xs">
                        Conserve les données existantes, ajoute les éléments manquants et met à jour les identifiants correspondants.
                        Attention : des doublons sont possibles si les identifiants diffèrent.
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
                  Créer d’abord une sauvegarde de sécurité (recommandé)
                </Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} disabled={restoreLoading}>
              Annuler
            </Button>
            <Button
              variant={restoreStrategy === "replace" ? "destructive" : "default"}
              onClick={handleConfirmRestore}
              disabled={!restoreSnapshot || restoreLoading}
            >
              {restoreLoading ? "Restauration…" : restoreStrategy === "replace" ? "Remplacer et restaurer" : "Fusionner et restaurer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5" />
              Réinitialiser l’application
            </DialogTitle>
            <DialogDescription>
              Toutes les données locales de ce profil seront effacées. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium">Vous allez supprimer :</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>• {stats.transactions} transactions</li>
                <li>• {stats.goals} objectifs</li>
                <li>• {stats.budgets} réglages de budget</li>
                <li>• {stats.accounts} comptes</li>
              </ul>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="reset-export-first"
                checked={resetExportFirst}
                onCheckedChange={(v) => setResetExportFirst(v === true)}
              />
              <Label htmlFor="reset-export-first" className="text-sm">
                Exporter d’abord une sauvegarde (recommandé)
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm">Saisissez RESET pour confirmer</Label>
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
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReset}
              disabled={resetLoading || resetConfirmText.trim() !== "RESET"}
            >
              {resetLoading ? "Réinitialisation…" : "Réinitialiser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
