'use client';

import { useState, useCallback } from 'react';
import { Upload, CheckCircle, AlertCircle, FileText, ArrowRight, RefreshCw, Download, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Money } from '@/components/ui/money';
import {
  detectCSVFormat,
  previewImport,
  importCSV,
  undoCSVImport,
  type DuplicateCheck,
  type ImportResult,
  type BankStatementMetadata,
} from '@/lib/csv-importer';
import { Transaction } from '@/lib/db';
import { useAccounts } from '@/hooks/use-data';
import { getImportQuality } from '@/lib/import-quality';
import { classificationKey, classificationQuality, type LocalClassificationSuggestion } from '@/lib/classification';
import { checkLocalClassifier, classifyAmbiguousTransactions } from '@/lib/local-classifier';

interface MigrationWizardProps {
  onComplete?: () => void;
}

type WizardStep = 'upload' | 'preview' | 'importing' | 'complete';

export function MigrationWizard({ onComplete }: MigrationWizardProps) {
  const { accounts, createAccount } = useAccounts();

  const [step, setStep] = useState<WizardStep>('upload');
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvFormat, setCsvFormat] = useState<'historical' | 'bank' | 'unknown'>('unknown');
  const [fileName, setFileName] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [newAccountName, setNewAccountName] = useState('');
  const [targetConfirmed, setTargetConfirmed] = useState(false);

  // Preview data
  const [previewData, setPreviewData] = useState<{
    totalRows: number;
    dateRange: { start: string; end: string } | null;
    transactions: Partial<Transaction>[];
    duplicateChecks: DuplicateCheck[];
    categorySummary: Record<string, number>;
    statement: BankStatementMetadata | null;
  } | null>(null);

  // Import settings
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [duplicateThreshold, setDuplicateThreshold] = useState(0.7);

  // Import result
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationProgress, setClassificationProgress] = useState<string | null>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);

      const format = detectCSVFormat(content);
      setCsvFormat(format);

      if (format === 'unknown') {
        setError('Could not detect CSV format. Please use historical or French bank export format.');
        return;
      }

      const preview = await previewImport(content, selectedAccountId || undefined);
      setPreviewData(preview);
      setStep('preview');
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader.readAsText(file, 'ISO-8859-1');
  }, [selectedAccountId]);

  const handleAccountChange = useCallback(async (accountId: number | null) => {
    setSelectedAccountId(accountId);
    setTargetConfirmed(false);

    if (csvContent && accountId) {
      const preview = await previewImport(csvContent, accountId);
      setPreviewData(preview);
    }
  }, [csvContent]);

  const handleCreateAccount = useCallback(async () => {
    if (!newAccountName.trim()) return;

    const id = await createAccount({
      name: newAccountName,
      type: 'checking',
      currency: 'EUR',
      balance: 0,
      institution: 'Unknown',
      color: '#3B82F6',
      isActive: true,
      initialBalance: 0,
      initialBalanceDate: new Date().toISOString().split('T')[0],
    });

    setSelectedAccountId(id);
    setNewAccountName('');
    handleAccountChange(id);
  }, [newAccountName, createAccount, handleAccountChange]);

  const handleImport = useCallback(async () => {
    if (!csvContent || !selectedAccountId || !targetConfirmed) return;

    setError(null);
    setStep('importing');

    try {
      const classificationOverrides = Object.fromEntries(
        (previewData?.transactions || [])
          .filter((transaction) => transaction.classificationSource === 'local-model')
          .map((transaction) => [classificationKey(transaction), {
            category: transaction.category!,
            subcategory: transaction.subcategory!,
            confidence: transaction.classificationConfidence!,
            reason: transaction.classificationReason || 'Suggestion du modèle local.',
          } satisfies LocalClassificationSuggestion])
      );
      const result = await importCSV(csvContent, selectedAccountId, {
        skipDuplicates,
        duplicateThreshold,
        classificationOverrides,
      });

      setImportResult(result);
      setCsvContent('');
      setPreviewData(null);
      setStep('complete');
      if (result.errors > 0 || (result.reconciliation && !result.reconciliation.isReconciled)) {
        setError(result.errorDetails[0] || 'Import needs review before it can be confirmed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  }, [csvContent, selectedAccountId, skipDuplicates, duplicateThreshold, targetConfirmed, previewData]);

  const handleLocalClassification = useCallback(async () => {
    if (!previewData) return;
    setError(null);
    setIsClassifying(true);
    setClassificationProgress('Connexion au modèle local…');
    try {
      if (!await checkLocalClassifier()) {
        throw new Error('Le service local ne répond pas. Lancez « npm run local-ai » dans un second terminal.');
      }
      const classified = await classifyAmbiguousTransactions(previewData.transactions, (done, total) => {
        setClassificationProgress(`Vérification locale ${done}/${total}`);
      });
      const categorySummary: Record<string, number> = {};
      classified.forEach((transaction) => {
        const key = transaction.category || 'Inconnue';
        categorySummary[key] = (categorySummary[key] || 0) + 1;
      });
      setPreviewData({
        ...previewData,
        transactions: classified,
        categorySummary,
        duplicateChecks: previewData.duplicateChecks.map((check, index) => ({
          ...check,
          transaction: classified[index] || check.transaction,
        })),
      });
      const remaining = classificationQuality(classified).needsReview;
      setClassificationProgress(remaining ? `${remaining} ligne(s) restent à vérifier` : 'Toutes les lignes ambiguës ont été vérifiées');
    } catch (classificationError) {
      setError(classificationError instanceof Error ? classificationError.message : 'Le classifieur local a échoué.');
      setClassificationProgress(null);
    } finally {
      setIsClassifying(false);
    }
  }, [previewData]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setCsvContent('');
    setCsvFormat('unknown');
    setFileName('');
    setPreviewData(null);
    setImportResult(null);
    setError(null);
    setTargetConfirmed(false);
    setClassificationProgress(null);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!importResult || importResult.imported === 0) return;
    setIsUndoing(true);
    setError(null);
    try {
      await undoCSVImport(importResult);
      handleReset();
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Impossible d’annuler cet import.");
    } finally {
      setIsUndoing(false);
    }
  }, [importResult, handleReset]);

  const steps = [
    { key: 'upload', label: 'Fichier' },
    { key: 'preview', label: 'Vérification' },
    { key: 'importing', label: 'Import' },
    { key: 'complete', label: 'Terminé' },
  ] as const;

  const stepOrder = ['upload', 'preview', 'importing', 'complete'] as const;
  const currentIndex = stepOrder.indexOf(step);
  const pendingImportCount = previewData
    ? skipDuplicates
      ? previewData.duplicateChecks.filter(
          (duplicate) => !duplicate.isDuplicate || duplicate.confidence < duplicateThreshold
        ).length
      : previewData.totalRows
    : 0;
  const importQuality = importResult
    ? getImportQuality(importResult.reconciliation, importResult.errors)
    : 'needs-review';
  const isReconciled = importQuality === 'reconciled';
  const canContinue = importQuality !== 'needs-review';
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const classification = previewData ? classificationQuality(previewData.transactions) : null;

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-3">
        {steps.map((s, i) => {
          const isActive = step === s.key;
          const isComplete = currentIndex > i;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isComplete
                    ? "bg-[#FF6B4A] text-white"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-sm",
                  isActive || isComplete ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && <div className="ml-2 h-px w-8 bg-border" />}
            </div>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Import guidé</CardTitle>
            <CardDescription>
              Importez un fichier CSV historique (avec catégories) ou un export bancaire français.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Account Selection */}
            <div className="space-y-3">
              <Label>Compte cible</Label>
              <Select
                value={selectedAccountId?.toString() || ""}
                onValueChange={(value) => handleAccountChange(value ? Number(value) : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un compte…" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id!.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: acc.color }}
                        />
                        {acc.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Input
                  placeholder="Ou créer un nouveau compte…"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateAccount()}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleCreateAccount}
                  disabled={!newAccountName.trim()}
                  size="sm"
                >
                  Créer
                </Button>
              </div>
            </div>

            {/* File Upload */}
            <div
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors",
                !selectedAccountId && "pointer-events-none opacity-50",
                "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="absolute inset-0 cursor-pointer opacity-0"
                disabled={!selectedAccountId}
              />
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium">
                {selectedAccountId
                  ? 'Cliquez ou déposez un fichier CSV ici'
                  : 'Sélectionnez d’abord un compte'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Formats pris en charge : CSV historique et export Société Générale
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && previewData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Vérification avant import</CardTitle>
              <CardDescription className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {fileName}
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {csvFormat === 'historical' ? 'Format historique' : 'Export bancaire'}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="font-medium">Compte cible : {selectedAccount?.name || "Non sélectionné"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selectedAccount?.institution || "Institution non renseignée"} · {selectedAccount?.currency || "EUR"}{previewData.statement ? ` · relevé se terminant par ${previewData.statement.accountNumber.slice(-4)}` : ""}</p>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={targetConfirmed} onChange={(event) => setTargetConfirmed(event.target.checked)} className="mt-1 h-4 w-4" />
                  <span>Je confirme que ce fichier appartient bien à <strong>{selectedAccount?.name}</strong>. L’import est bloqué sans cette confirmation.</span>
                </label>
              </div>
              {/* Summary Stats */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-2xl font-bold">{previewData.totalRows}</p>
                  <p className="text-xs text-muted-foreground">Lignes totales</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-2xl font-bold text-foreground">
                    {previewData.duplicateChecks.filter(d => !d.isDuplicate || d.confidence < duplicateThreshold).length}
                  </p>
                  <p className="text-xs text-muted-foreground">À importer</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-2xl font-bold text-foreground">
                    {previewData.duplicateChecks.filter(d => d.isDuplicate && d.confidence >= duplicateThreshold).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Doublons</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-4">
                  <p className="text-xs font-medium text-foreground">
                    {previewData.dateRange?.start} &rarr; {previewData.dateRange?.end}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Période</p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Rapprochement du relevé</p>
                    <p className="text-xs text-muted-foreground">
                      Le fichier n’est validé qu’après vérification des informations du relevé SG.
                    </p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    previewData.statement
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {previewData.statement ? "Prêt à vérifier" : "À vérifier"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Solde de clôture attendu</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {previewData.statement ? (
                        <Money amount={previewData.statement.closingBalance} minimumFractionDigits={2} maximumFractionDigits={2} />
                      ) : "Non fourni"}
                    </p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Solde calculé</p>
                    <p className="mt-1 font-semibold text-muted-foreground">Calculé lors de l’import</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Écart</p>
                    <p className="mt-1 font-semibold text-muted-foreground">En attente de vérification</p>
                  </div>
                </div>
                {previewData.statement && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Compte SG se terminant par {previewData.statement.accountNumber.slice(-4)} · clôture le {previewData.statement.closingDate} · {previewData.statement.transactionCount} transactions déclarées
                  </p>
                )}
              </div>

              {/* Category Breakdown */}
              <div>
                <p className="mb-2 text-sm font-medium">Catégories</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(previewData.categorySummary)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, count]) => (
                      <span
                        key={cat}
                        className="rounded-md bg-muted px-2 py-1 text-xs"
                      >
                        {cat}: {count}
                      </span>
                    ))}
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4" /> Qualité de catégorisation</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Règles : {classification?.counts.rule || 0} · historique appris : {classification?.counts.learned || 0} · modèle local : {classification?.counts['local-model'] || 0} · à vérifier : {classification?.needsReview || 0}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Seuls le marchand, le libellé nettoyé et le sens du flux sont envoyés au service sur votre Mac. Aucune date, aucun compte et aucun solde ne quittent le navigateur.</p>
                    {classificationProgress ? <p className="mt-2 text-xs font-medium" aria-live="polite">{classificationProgress}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLocalClassification}
                    disabled={isClassifying || !classification?.needsReview}
                    className="shrink-0 gap-2"
                  >
                    {isClassifying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isClassifying ? 'Analyse locale…' : 'Vérifier les ambiguïtés'}
                  </Button>
                </div>
              </div>

              {/* Duplicate Settings */}
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="mb-3 text-sm font-medium">Gestion des doublons</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded"
                    />
                    Ignorer les transactions en double
                  </label>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Seuil de confiance : {Math.round(duplicateThreshold * 100)} %
                    </p>
                    <input
                      type="range"
                      min="0.5"
                      max="1"
                      step="0.05"
                      value={duplicateThreshold}
                      onChange={(e) => setDuplicateThreshold(parseFloat(e.target.value))}
                      className="w-full accent-primary"
                      aria-label="Seuil de détection des doublons"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sample Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Exemple de transactions</CardTitle>
              <CardDescription>Les 10 premières lignes du fichier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Marchand</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Catégorie</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Confiance</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">Montant</th>
                      <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.duplicateChecks.slice(0, 10).map((check, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2.5 whitespace-nowrap">{check.transaction.date}</td>
                        <td className="px-3 py-2.5">{check.transaction.merchant}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {check.transaction.category}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {check.transaction.classificationSource === 'fallback'
                            ? 'À vérifier'
                            : `${Math.round((check.transaction.classificationConfidence || 0) * 100)} % · ${check.transaction.classificationSource === 'local-model' ? 'modèle local' : check.transaction.classificationSource === 'learned' ? 'historique' : 'règle'}`}
                        </td>
                        <td className={cn(
                          "px-3 py-2.5 text-right font-medium whitespace-nowrap text-foreground"
                        )}>
                          {check.transaction.direction === 'credit' ? '+' : '-'}
                          <Money
                            amount={Math.abs(check.transaction.amount || 0)}
                            minimumFractionDigits={2}
                            maximumFractionDigits={2}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {check.isDuplicate && check.confidence >= duplicateThreshold ? (
                            <span className="text-muted-foreground text-xs">
                              Doublon ({Math.round(check.confidence * 100)} %)
                            </span>
                          ) : (
                            <span className="text-foreground text-xs">Nouvelle</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-between">
                <Button variant="outline" onClick={handleReset}>
                  Annuler
                </Button>
                <Button onClick={handleImport} className="gap-2" disabled={previewData.totalRows === 0 || !targetConfirmed}>
                  <Download className="h-4 w-4" />
                  {pendingImportCount > 0
                    ? `Importer et vérifier ${pendingImportCount} transactions`
                    : "Vérifier les doublons et le solde"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 animate-pulse">
                <RefreshCw className="h-7 w-7 text-primary animate-spin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Import des transactions</h3>
              <p className="text-sm text-muted-foreground">Cette opération peut prendre quelques instants…</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === 'complete' && importResult && (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center text-center mb-8">
              <div className={cn(
                "mb-4 flex h-14 w-14 items-center justify-center rounded-full",
                canContinue ? "bg-emerald-500/10" : "bg-amber-500/10"
              )}>
                {canContinue ? (
                  <ShieldCheck className="h-7 w-7 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-7 w-7 text-amber-600" />
                )}
              </div>
              <h3 className="text-lg font-semibold">
                {isReconciled
                  ? "Importé et rapproché"
                  : importQuality === 'imported'
                    ? "Importé sans solde de relevé"
                    : "L’import doit être vérifié"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isReconciled
                  ? "Le solde calculé correspond exactement au relevé bancaire."
                  : importQuality === 'imported'
                    ? "Le fichier est importé, mais ce format ne contient aucun solde de clôture à rapprocher."
                    : "Rien n’est confirmé tant que le solde de clôture n’est pas rapproché."}
              </p>
            </div>

            <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{importResult.imported}</p>
                <p className="text-xs text-muted-foreground">Importées</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{importResult.duplicates}</p>
                <p className="text-xs text-muted-foreground">Doublons</p>
              </div>
              <div className="rounded-lg bg-muted/30 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{importResult.errors}</p>
                <p className="text-xs text-muted-foreground">Erreurs</p>
              </div>
            </div>

            <div className="mx-auto mt-4 grid max-w-md gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Attendu</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {importResult.reconciliation ? (
                    <Money amount={importResult.reconciliation.expectedBalance} minimumFractionDigits={2} maximumFractionDigits={2} />
                  ) : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Calculé</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {importResult.reconciliation ? (
                    <Money amount={importResult.reconciliation.calculatedBalance} minimumFractionDigits={2} maximumFractionDigits={2} />
                  ) : "—"}
                </p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Écart</p>
                <p className={cn("mt-1 font-semibold tabular-nums", isReconciled ? "text-emerald-600" : "text-amber-600")}>
                  {importResult.reconciliation ? (
                    <Money amount={importResult.reconciliation.difference} minimumFractionDigits={2} maximumFractionDigits={2} />
                  ) : "—"}
                </p>
              </div>
            </div>

            {importResult.errorDetails.length > 0 && (
              <div className="mx-auto mt-4 max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="mb-1 text-sm font-medium text-destructive">Erreurs</p>
                <ul className="space-y-1 text-xs text-destructive">
                  {importResult.errorDetails.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 flex justify-center gap-3">
              {importResult.imported > 0 && (
                <Button variant="outline" onClick={handleUndo} disabled={isUndoing}>
                  {isUndoing ? "Annulation…" : "Annuler cet import"}
                </Button>
              )}
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Importer le second compte
              </Button>
              <Button onClick={onComplete} className="gap-2" disabled={!canContinue}>
                Voir les transactions
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
