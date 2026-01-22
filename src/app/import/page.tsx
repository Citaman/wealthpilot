"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  X,
  ArrowRight,
  Download,
  RefreshCw,
  Sparkles,
  Plus,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  parseCSV,
  importTransactions,
  detectRecurringTransactions,
  type ParseResult,
} from "@/lib/csv-parser";
import { db, type Transaction, CATEGORIES } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { format } from "date-fns";
import { MigrationWizard } from "@/components/import/migration-wizard";
import { useAccount } from "@/contexts/account-context";

type ImportStep = "upload" | "preview" | "importing" | "complete";
type ImportMode = "smart" | "basic";

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { accounts, selectedAccountId, selectedAccount } = useAccount();
  
  const [importMode, setImportMode] = useState<ImportMode>("smart");
  const [step, setStep] = useState<ImportStep>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [basicImportAccountId, setBasicImportAccountId] = useState<number | null>(null);
  const [newAccountName, setNewAccountName] = useState("");

  // Set default account for basic import
  const targetAccountId = basicImportAccountId || (typeof selectedAccountId === 'number' ? selectedAccountId : accounts[0]?.id);

  const processFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    if (!targetAccountId) {
      setError("Please select or create an account first");
      return;
    }

    setError(null);

    try {
      const result = await parseCSV(file, targetAccountId);
      setParseResult(result);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV file");
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    
    try {
      const id = await db.accounts.add({
        name: newAccountName.trim(),
        type: 'checking',
        currency: 'EUR',
        balance: 0,
        institution: 'Unknown',
        color: '#3B82F6',
        isActive: true,
        initialBalance: 0,
        initialBalanceDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setBasicImportAccountId(id as number);
      setNewAccountName("");
    } catch (err) {
      setError("Failed to create account");
    }
  };


  const handleImport = async () => {
    if (!parseResult) return;

    setStep("importing");
    setImportProgress(0);

    try {
      const newTransactions = parseResult.transactions.filter((t) => !t.isDuplicate);
      const total = newTransactions.length;
      
      // Import in batches for progress updates
      const batchSize = 100;
      for (let i = 0; i < total; i += batchSize) {
        const batch = newTransactions.slice(i, i + batchSize);
        await importTransactions(batch);
        const progress = Math.min(((i + batch.length) / total) * 100, 100);
        setImportProgress(progress);
      }

      // Detect recurring transactions
      await detectRecurringTransactions();

      setImportedCount(total);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import transactions");
      setStep("preview");
    }
  };

  const handleReset = () => {
    setStep("upload");
    setParseResult(null);
    setImportProgress(0);
    setImportedCount(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
          <p className="text-muted-foreground">
            Upload your bank transaction CSV file to get started
          </p>
        </div>

        {/* Import Mode Toggle */}
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">Import Mode:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setImportMode("smart")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                importMode === "smart"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              )}
            >
              <Sparkles className="h-4 w-4" />
              Smart Import
            </button>
            <button
              onClick={() => setImportMode("basic")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                importMode === "basic"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted"
              )}
            >
              Basic Import
            </button>
          </div>
          <span className="text-xs text-muted-foreground ml-2">
            {importMode === "smart" 
              ? "Better duplicate detection & merchant recognition" 
              : "Original simple importer"}
          </span>
        </div>

        {/* Smart Import Mode - Use MigrationWizard */}
        {importMode === "smart" && (
          <MigrationWizard onComplete={() => router.push('/transactions')} />
        )}

        {/* Basic Import Mode - Original UI */}
        {importMode === "basic" && (
          <>
        {/* Progress Steps */}
        <div className="flex items-center gap-4 mb-8">
          {[
            { key: "upload", label: "Upload" },
            { key: "preview", label: "Preview" },
            { key: "complete", label: "Complete" },
          ].map((s, i) => {
            const isActive = step === s.key || (step === "importing" && s.key === "preview");
            const isComplete =
              (s.key === "upload" && step !== "upload") ||
              (s.key === "preview" && (step === "importing" || step === "complete"));

            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                    isComplete
                      ? "bg-emerald-500 text-white"
                      : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? <CheckCircle className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive || isComplete ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
                {i < 2 && <div className="w-12 h-px bg-border ml-2" />}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setError(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Upload Step */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Select an account and upload your bank export
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Account Selection */}
              <div className="space-y-4">
                <Label>Select Account for Import</Label>
                <div className="flex gap-2">
                  <Select
                    value={targetAccountId?.toString() || ""}
                    onValueChange={(value) => setBasicImportAccountId(Number(value))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select an account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id!.toString()}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: account.color }}
                            />
                            {account.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Create new account inline */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Or create a new account</Label>
                    <Input
                      placeholder="New account name..."
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateAccount()}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleCreateAccount}
                    disabled={!newAccountName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create
                  </Button>
                </div>
              </div>

              {/* File Drop Zone */}
              <div
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors",
                  !targetAccountId && "opacity-50 pointer-events-none",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-medium mb-1">Drop your CSV file here</p>
                <p className="text-sm text-muted-foreground mb-4">
                  or click to browse your files
                </p>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Select File
                </Button>
              </div>

              <div className="mt-6 rounded-lg bg-muted/50 p-4">
                <h4 className="font-medium mb-2">Expected CSV Format</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Your CSV should contain the following columns:
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Date", "Value Date", "Debit", "Credit", "Balance", "Category", "Subcategory", "Type"].map(
                    (col) => (
                      <span
                        key={col}
                        className="rounded-full bg-background px-3 py-1 text-xs font-medium"
                      >
                        {col}
                      </span>
                    )
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Step */}
        {step === "preview" && parseResult && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Import Summary</CardTitle>
                <CardDescription>
                  Review the transactions before importing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 mb-6">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm text-muted-foreground">Total Found</p>
                    <p className="text-2xl font-bold">{parseResult.totalRows}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-4">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">New Transactions</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      {parseResult.newCount}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-4">
                    <p className="text-sm text-amber-700 dark:text-amber-400">Duplicates Skipped</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                      {parseResult.duplicateCount}
                    </p>
                  </div>
                </div>

                {parseResult.dateRange && (
                  <p className="text-sm text-muted-foreground mb-6">
                    Date range: {format(new Date(parseResult.dateRange.start), "MMM d, yyyy")} —{" "}
                    {format(new Date(parseResult.dateRange.end), "MMM d, yyyy")}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Choose Different File
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={parseResult.newCount === 0}
                  >
                    Import {parseResult.newCount} Transactions
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Transaction Preview</CardTitle>
                <CardDescription>
                  First 10 new transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Description</th>
                        <th className="text-left py-3 px-4 font-medium">Category</th>
                        <th className="text-right py-3 px-4 font-medium">Amount</th>
                        <th className="text-center py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.transactions.slice(0, 10).map((tx, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-3 px-4 whitespace-nowrap">
                            {format(new Date(tx.date), "MMM d")}
                          </td>
                          <td className="py-3 px-4">
                            <div className="max-w-xs truncate">{tx.merchant}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
                              style={{
                                backgroundColor: `${CATEGORIES[tx.category]?.color}20`,
                                color: CATEGORIES[tx.category]?.color,
                              }}
                            >
                              {tx.category}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "py-3 px-4 text-right font-medium whitespace-nowrap",
                              tx.direction === "credit" ? "text-emerald-600" : ""
                            )}
                          >
                            {tx.direction === "credit" ? "+" : "-"}
                            <Money
                              amount={Math.abs(tx.amount)}
                              minimumFractionDigits={2}
                              maximumFractionDigits={2}
                            />
                          </td>
                          <td className="py-3 px-4 text-center">
                            {tx.isDuplicate ? (
                              <span className="text-amber-600 text-xs">Duplicate</span>
                            ) : (
                              <span className="text-emerald-600 text-xs">New</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 animate-pulse">
                  <Download className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Importing Transactions</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Please wait while we process your data...
                </p>
                <div className="w-full max-w-sm">
                  <Progress value={importProgress} className="h-2 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {importProgress.toFixed(0)}% complete
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Successfully imported {importedCount} transactions
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleReset}>
                    Import More
                  </Button>
                  <Button onClick={() => router.push("/")}>
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Your data stays private</p>
                <p>
                  All transaction data is stored locally in your browser using IndexedDB.
                  Nothing is uploaded to any server. Your financial information never leaves your device.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
