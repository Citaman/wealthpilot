"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from "react";
import {
  Settings as SettingsIcon,
  Bell,
  Database,
  Trash2,
  Download,
  Upload,
  Moon,
  Sun,
  Monitor,
  AlertTriangle,
  Check,
  Calendar,
  Wallet,
  Plus,
  X,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  db,
  FinancialMonthSettings,
  DEFAULT_FINANCIAL_MONTH_SETTINGS,
  BalanceCheckpoint,
  initializeDatabase,
} from "@/lib/db";
import { getFinancialMonthSettings, saveFinancialMonthSettings } from "@/lib/financial-month";
import { setInitialBalance, addBalanceCheckpoint, getBalanceCheckpoints, deleteBalanceCheckpoint, recalculateAllBalances } from "@/lib/balance";
import {
  buildBackupFileName,
  createBackupBlob,
  readBackupFileAsText,
  restoreReplaceSnapshotV1,
  validateSnapshotV1,
  type BackupPreview,
  type BackupSnapshotV1,
  getStringSetting,
  setStringSetting,
  clearAllUserData,
} from "@/lib/backups";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type SettingsTab = "general" | "finance" | "data" | "about";

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [tab, setTab] = useState<SettingsTab>("general");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [budgetAlertThreshold, setBudgetAlertThreshold] = useState("80");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateSuccess, setRecalculateSuccess] = useState(false);
  const [backupGzip, setBackupGzip] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [dataMessage, setDataMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  // Restore flow
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSnapshot, setRestoreSnapshot] = useState<BackupSnapshotV1 | null>(null);
  const [restorePreview, setRestorePreview] = useState<BackupPreview | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string | null>(null);
  const [createPreRestoreBackup, setCreatePreRestoreBackup] = useState(true);
  const [restoreDiagnostics, setRestoreDiagnostics] = useState<object | null>(null);

  // Reset flow
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetExportFirst, setResetExportFirst] = useState(true);
  const [resetLoading, setResetLoading] = useState(false);
  const [stats, setStats] = useState({
    transactions: 0,
    goals: 0,
    budgets: 0,
    accounts: 0,
  });
  
  // Financial month settings
  const [fmSettings, setFmSettings] = useState<FinancialMonthSettings>(DEFAULT_FINANCIAL_MONTH_SETTINGS);
  const [fixedDay, setFixedDay] = useState("24");
  const [minSalary, setMinSalary] = useState("1000");
  const [savingFm, setSavingFm] = useState(false);
  
  // Account/balance settings
  const [initialBalance, setInitialBalanceState] = useState("");
  const [initialBalanceDate, setInitialBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [savingBalance, setSavingBalance] = useState(false);
  
  // Balance checkpoints
  const [checkpoints, setCheckpoints] = useState<BalanceCheckpoint[]>([]);
  const [newCheckpointDate, setNewCheckpointDate] = useState(new Date().toISOString().split("T")[0]);
  const [newCheckpointBalance, setNewCheckpointBalance] = useState("");
  const [newCheckpointNote, setNewCheckpointNote] = useState("");
  const [addingCheckpoint, setAddingCheckpoint] = useState(false);
  const [showAddCheckpoint, setShowAddCheckpoint] = useState(false);

  const loadFinancialMonthSettings = useCallback(async () => {
    const settings = await getFinancialMonthSettings();
    setFmSettings(settings);
    setFixedDay(settings.fixedDay?.toString() || "24");
    setMinSalary(settings.minimumSalaryAmount.toString());
  }, []);

  const loadAccountSettings = useCallback(async () => {
    const account = await db.accounts.where("isActive").equals(1 as number).first();
    if (account) {
      setInitialBalanceState(account.initialBalance?.toString() || "0");
      setInitialBalanceDate(account.initialBalanceDate || new Date().toISOString().split("T")[0]);
      
      // Load checkpoints for this account
      if (account.id) {
        const cps = await getBalanceCheckpoints(account.id);
        setCheckpoints(cps);
      }
    }
  }, []);

  useEffect(() => {
    // Load stats
    const loadStats = async () => {
      const [transactions, goals, budgets, accounts] = await Promise.all([
        db.transactions.count(),
        db.goals.count(),
        db.budgets.count(),
        db.accounts.count(),
      ]);
      setStats({ transactions, goals, budgets, accounts });
    };
    loadStats();
    loadFinancialMonthSettings();
    loadAccountSettings();

    getStringSetting("lastBackupAt")
      .then((value) => setLastBackupAt(value))
      .catch(() => setLastBackupAt(null));

    getStringSetting("budgetAlertThreshold")
      .then((value) => {
        if (value) setBudgetAlertThreshold(value);
      })
      .catch(() => undefined);

    getStringSetting("backupGzip")
      .then((value) => {
        if (value === "true" || value === "false") setBackupGzip(value === "true");
      })
      .catch(() => undefined);

    // Load theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // Check notification permission
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, [loadFinancialMonthSettings, loadAccountSettings]);

  const refreshStats = useCallback(async () => {
    const [transactions, goals, budgets, accounts] = await Promise.all([
      db.transactions.count(),
      db.goals.count(),
      db.budgets.count(),
      db.accounts.count(),
    ]);
    setStats({ transactions, goals, budgets, accounts });
  }, []);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pushMessage = useCallback(
    (tone: "success" | "error" | "info", text: string, options?: { clearAfterMs?: number }) => {
      setDataMessage({ tone, text });
      if (options?.clearAfterMs) {
        window.setTimeout(() => setDataMessage(null), options.clearAfterMs);
      }
    },
    []
  );

  const handleSaveFinancialMonthSettings = async () => {
    setSavingFm(true);
    try {
      const newSettings: FinancialMonthSettings = {
        ...fmSettings,
        fixedDay: fmSettings.mode === "fixed" ? parseInt(fixedDay) : undefined,
        minimumSalaryAmount: parseFloat(minSalary) || 1000,
      };
      await saveFinancialMonthSettings(newSettings);
      setFmSettings(newSettings);
      pushMessage("success", "Financial month settings saved.", { clearAfterMs: 3500 });
    } catch (error) {
      console.error("Failed to save financial month settings:", error);
      pushMessage("error", "Failed to save financial month settings.");
    } finally {
      setSavingFm(false);
    }
  };

  const handleSaveInitialBalance = async () => {
    setSavingBalance(true);
    try {
      const account = await db.accounts.where("isActive").equals(1 as number).first();
      if (account && account.id) {
        await setInitialBalance(account.id, parseFloat(initialBalance) || 0, initialBalanceDate);
        pushMessage("success", "Initial balance saved. Balances recalculated.", { clearAfterMs: 3500 });
      }
    } catch (error) {
      console.error("Failed to save initial balance:", error);
      pushMessage("error", "Failed to save initial balance.");
    } finally {
      setSavingBalance(false);
    }
  };

  const handleAddCheckpoint = async () => {
    setAddingCheckpoint(true);
    try {
      const account = await db.accounts.where("isActive").equals(1 as number).first();
      if (account && account.id) {
        await addBalanceCheckpoint(
          account.id,
          newCheckpointDate,
          parseFloat(newCheckpointBalance) || 0,
          newCheckpointNote || undefined
        );
        // Reload checkpoints
        const cps = await getBalanceCheckpoints(account.id);
        setCheckpoints(cps);
        // Reset form
        setNewCheckpointBalance("");
        setNewCheckpointNote("");
        setShowAddCheckpoint(false);
        pushMessage("success", "Balance checkpoint added.", { clearAfterMs: 2500 });
      }
    } catch (error) {
      console.error("Failed to add checkpoint:", error);
      pushMessage("error", "Failed to add balance checkpoint.");
    } finally {
      setAddingCheckpoint(false);
    }
  };

  const handleDeleteCheckpoint = async (checkpointId: number) => {
    try {
      const account = await db.accounts.where("isActive").equals(1 as number).first();
      if (account && account.id) {
        await deleteBalanceCheckpoint(checkpointId, account.id);
        const cps = await getBalanceCheckpoints(account.id);
        setCheckpoints(cps);
      }
    } catch (error) {
      console.error("Failed to delete checkpoint:", error);
    }
  };

  const handleRecalculateAll = async () => {
    setRecalculating(true);
    setRecalculateSuccess(false);
    try {
      await recalculateAllBalances();
      setRecalculateSuccess(true);
      // Reload account settings to show updated balance
      await loadAccountSettings();
      setTimeout(() => setRecalculateSuccess(false), 3000);
      pushMessage("success", "Balances recalculated.", { clearAfterMs: 3000 });
    } catch (error) {
      console.error("Failed to recalculate balances:", error);
      pushMessage("error", "Failed to recalculate balances.");
    } finally {
      setRecalculating(false);
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    const root = document.documentElement;
    if (newTheme === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", systemDark);
    } else {
      root.classList.toggle("dark", newTheme === "dark");
    }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      pushMessage("info", "This browser does not support notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");

    if (permission === "granted") {
      new Notification("WealthPilot", {
        body: "Notifications are now enabled!",
        icon: "/favicon.ico",
      });

      pushMessage("success", "Browser notifications enabled.", { clearAfterMs: 3000 });
    } else {
      pushMessage("info", "Notification permission not granted.", { clearAfterMs: 3500 });
    }
  };

  const handleBudgetAlertThresholdChange = async (value: string) => {
    setBudgetAlertThreshold(value);
    try {
      await setStringSetting("budgetAlertThreshold", value);
    } catch {
      // Non-blocking: preference persistence shouldn't break Settings UX
    }
  };

  const handleBackupGzipChange = async (next: boolean) => {
    setBackupGzip(next);
    try {
      await setStringSetting("backupGzip", String(next));
    } catch {
      // Non-blocking
    }
  };

  const handleExportBackup = async (options?: { prefix?: string; gzip?: boolean }) => {
    setExportLoading(true);
    setDataMessage(null);
    try {
      const gzip = options?.gzip ?? backupGzip;
      const { blob, extension, warning } = await createBackupBlob({ gzip });
      const filename = buildBackupFileName(options?.prefix ?? "wealthpilot-backup", extension);
      downloadBlob(blob, filename);

      const now = new Date().toISOString();
      await setStringSetting("lastBackupAt", now);
      setLastBackupAt(now);

      if (warning === "gzip-not-supported") {
        setDataMessage({
          tone: "info",
          text: "Exported an uncompressed JSON backup (gzip not supported by this browser).",
        });
      } else {
        setDataMessage({ tone: "success", text: `Backup exported: ${filename}` });
      }

      return { exportedAt: now, filename };
    } catch (error) {
      console.error("Backup export failed:", error);
      setDataMessage({ tone: "error", text: "Failed to export backup." });
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

    setDataMessage(null);
    setRestoreDiagnostics(null);
    setRestoreSnapshot(null);
    setRestorePreview(null);
    setRestoreFileName(file.name);

    try {
      const text = await readBackupFileAsText(file);
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
        setDataMessage({
          tone: "error",
          text: "This backup file is invalid or unsupported. Review diagnostics and try another file.",
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
      setDataMessage({
        tone: "error",
        text: "Failed to open this backup file. If it is a .gz file, try exporting an uncompressed .json backup.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreSnapshot) return;

    setRestoreLoading(true);
    setDataMessage(null);
    try {
      let preRestoreBackupAt: string | null = null;
      if (createPreRestoreBackup) {
        const result = await handleExportBackup({ prefix: "wealthpilot-pre-restore", gzip: false });
        preRestoreBackupAt = result?.exportedAt ?? null;
      }

      await restoreReplaceSnapshotV1(restoreSnapshot);
      await recalculateAllBalances();

      if (createPreRestoreBackup) {
        // Restore overwrites settings; persist the pre-restore backup timestamp again.
        if (preRestoreBackupAt) {
          await setStringSetting("lastBackupAt", preRestoreBackupAt);
          setLastBackupAt(preRestoreBackupAt);
        }
      } else {
        const restoredLastBackupAt = await getStringSetting("lastBackupAt");
        setLastBackupAt(restoredLastBackupAt);
      }

      await refreshStats();
      await loadAccountSettings();

      setRestoreDialogOpen(false);
      setRestoreSnapshot(null);
      setRestorePreview(null);
      setRestoreFileName(null);

      setDataMessage({ tone: "success", text: "Backup restored successfully." });
    } catch (error) {
      console.error("Restore failed:", error);
      setDataMessage({
        tone: "error",
        text: "Restore failed. Your existing data should be unchanged.",
      });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    if (resetConfirmText.trim() !== "RESET") return;

    setResetLoading(true);
    setDataMessage(null);

    try {
      let preResetBackupAt: string | null = null;
      if (resetExportFirst) {
        const result = await handleExportBackup({ prefix: "wealthpilot-pre-reset", gzip: false });
        preResetBackupAt = result?.exportedAt ?? null;
      }

      await clearAllUserData();
      await initializeDatabase();
      await refreshStats();
      await loadAccountSettings();

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
      setDataMessage({ tone: "success", text: "App reset complete." });
    } catch (error) {
      console.error("Reset failed:", error);
      setDataMessage({ tone: "error", text: "Failed to reset the app." });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as SettingsTab)}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground">Manage your preferences, finances, and data</p>
            </div>

            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="finance">Finance</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>
          </div>

          {dataMessage && (
            <div
              className={cn(
                "rounded-lg border px-4 py-3 text-sm",
                dataMessage.tone === "success" &&
                  "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200",
                dataMessage.tone === "error" &&
                  "border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200",
                dataMessage.tone === "info" &&
                  "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200"
              )}
            >
              {dataMessage.text}
            </div>
          )}

          <TabsContent value="general" className="mt-0 space-y-6">
            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-5 w-5" />
                  Appearance
                </CardTitle>
                <CardDescription>Customize how WealthPilot looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">Select your preferred color scheme</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "light", icon: Sun, label: "Light" },
                      { value: "dark", icon: Moon, label: "Dark" },
                      { value: "system", icon: Monitor, label: "System" },
                    ].map(({ value, icon: Icon, label }) => (
                      <Button
                        key={value}
                        variant={theme === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleThemeChange(value as typeof theme)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>Configure alert preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Browser Notifications</p>
                    <p className="text-sm text-muted-foreground">Get alerts for budget warnings and goals</p>
                  </div>
                  {notificationsEnabled ? (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Enabled</span>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={handleEnableNotifications}>
                      Enable
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Budget Alert Threshold</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when spending reaches this percentage
                    </p>
                  </div>
                  <Select value={budgetAlertThreshold} onValueChange={handleBudgetAlertThresholdChange}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50%</SelectItem>
                      <SelectItem value="75">75%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                      <SelectItem value="90">90%</SelectItem>
                      <SelectItem value="100">100%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="finance" className="mt-0 space-y-6">
            {/* Financial Month Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Financial Month
                </CardTitle>
                <CardDescription>Configure how your monthly budget periods are calculated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Month Calculation Mode</Label>
                  <Select
                    value={fmSettings.mode}
                    onValueChange={(value) =>
                      setFmSettings({ ...fmSettings, mode: value as FinancialMonthSettings["mode"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <div className="flex flex-col">
                          <span>Auto-detect salary</span>
                          <span className="text-xs text-muted-foreground">Month starts when your salary arrives</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="fixed">
                        <div className="flex flex-col">
                          <span>Fixed day of month</span>
                          <span className="text-xs text-muted-foreground">Always start on the same day</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="calendar">
                        <div className="flex flex-col">
                          <span>Calendar month</span>
                          <span className="text-xs text-muted-foreground">Traditional 1st to 31st</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {fmSettings.mode === "fixed" && (
                  <div className="space-y-2">
                    <Label>Day of Month</Label>
                    <Select value={fixedDay} onValueChange={setFixedDay}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Your financial month will start on this day</p>
                  </div>
                )}

                {fmSettings.mode === "auto" && (
                  <div className="space-y-2">
                    <Label>Minimum Salary Amount (€)</Label>
                    <Input
                      type="number"
                      value={minSalary}
                      onChange={(e) => setMinSalary(e.target.value)}
                      placeholder="1000"
                      className="w-40"
                    />
                    <p className="text-xs text-muted-foreground">Only income above this amount will be detected as salary</p>
                  </div>
                )}

                <Button onClick={handleSaveFinancialMonthSettings} disabled={savingFm}>
                  {savingFm ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Account Balance Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Account Balance
                </CardTitle>
                <CardDescription>Set your initial balance for accurate balance tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="mb-2 text-sm text-muted-foreground">
                    <strong>How it works:</strong> All balances are calculated from your transactions starting from this initial balance. If your current balance looks incorrect, adjust the initial balance and date.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Initial Balance (€)</Label>
                    <Input
                      type="number"
                      value={initialBalance}
                      onChange={(e) => setInitialBalanceState(e.target.value)}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Balance Date</Label>
                    <Input
                      type="date"
                      value={initialBalanceDate}
                      onChange={(e) => setInitialBalanceDate(e.target.value)}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  This should be your account balance on the day <strong>before</strong> your first imported transaction.
                </p>

                <Button onClick={handleSaveInitialBalance} disabled={savingBalance}>
                  {savingBalance ? "Recalculating..." : "Save & Recalculate Balances"}
                </Button>

                {/* Balance Checkpoints Section */}
                <div className="border-t pt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Known Balance Points</h4>
                      <p className="text-sm text-muted-foreground">
                        Add dates where you know your exact balance (e.g., from bank statements)
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowAddCheckpoint(!showAddCheckpoint)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {showAddCheckpoint && (
                    <div className="mb-4 space-y-4 rounded-lg bg-muted/50 p-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={newCheckpointDate}
                            onChange={(e) => setNewCheckpointDate(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Balance (€)</Label>
                          <Input
                            type="number"
                            value={newCheckpointBalance}
                            onChange={(e) => setNewCheckpointBalance(e.target.value)}
                            placeholder="1234.56"
                            step="0.01"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Note (optional)</Label>
                          <Input
                            value={newCheckpointNote}
                            onChange={(e) => setNewCheckpointNote(e.target.value)}
                            placeholder="Bank statement Dec 2024"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleAddCheckpoint} disabled={addingCheckpoint} size="sm">
                          {addingCheckpoint ? "Adding..." : "Add Checkpoint"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddCheckpoint(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {checkpoints.length > 0 ? (
                    <div className="space-y-2">
                      {checkpoints.map((cp) => (
                        <div key={cp.id} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <div className="text-sm font-mono">{format(new Date(cp.date), "dd MMM yyyy")}</div>
                            <div className="font-medium">
                              {cp.balance.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            </div>
                            {cp.note && <div className="text-sm text-muted-foreground">{cp.note}</div>}
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => cp.id && handleDeleteCheckpoint(cp.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No checkpoints added. Add a known balance to improve accuracy.
                    </p>
                  )}
                </div>

                {/* Balance Maintenance */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Recalculate Balances</p>
                      <p className="text-sm text-muted-foreground">
                        Fix balance issues by recalculating from transactions
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {recalculateSuccess && (
                        <span className="flex items-center gap-1 text-sm text-emerald-600">
                          <Check className="h-4 w-4" /> Done!
                        </span>
                      )}
                      <Button variant="outline" onClick={handleRecalculateAll} disabled={recalculating}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", recalculating && "animate-spin")} />
                        {recalculating ? "Recalculating..." : "Recalculate"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data" className="mt-0 space-y-6">
            {/* Data & Backups */}
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
                  <div className="rounded-xl border bg-card p-4">
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

                    <Button
                      className="mt-4 w-full"
                      variant="outline"
                      onClick={() => handleExportBackup()}
                      disabled={exportLoading}
                    >
                      {exportLoading ? "Preparing..." : "Export backup"}
                    </Button>
                  </div>

                  {/* Restore */}
                  <div className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      <p className="font-medium">Restore</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Import a previous backup (.json or .json.gz). You’ll see a preview before restoring.
                    </p>

                    <div className="mt-4">
                      <label>
                        <input
                          type="file"
                          accept=".json,.gz"
                          onChange={handleSelectRestoreFile}
                          className="hidden"
                        />
                        <Button variant="outline" asChild className="w-full">
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
                  <div className="rounded-xl border border-red-200 bg-card p-4 dark:border-red-900/40">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <Trash2 className="h-4 w-4" />
                      <p className="font-medium">Reset App</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Clears all local data in this browser profile. Use with caution.
                    </p>

                    <Button
                      className="mt-4 w-full"
                      variant="destructive"
                      onClick={() => setResetDialogOpen(true)}
                    >
                      Reset…
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="mt-0 space-y-6">
            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">WealthPilot</strong> - Personal Finance Dashboard
                </p>
                <p>Version {process.env.NEXT_PUBLIC_APP_VERSION ?? "0.11.0"}</p>
                <p>
                  Your data is stored locally in your browser using IndexedDB. Nothing is sent to any server.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>


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

              <p className="text-xs text-muted-foreground">
                Restore strategy: <span className="font-medium">Replace all data</span> (v0.11.0)
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} disabled={restoreLoading}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleConfirmRestore}
              disabled={!restoreSnapshot || restoreLoading}
            >
              {restoreLoading ? "Restoring…" : "Restore"}
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
    </AppLayout>
  );
}
