"use client";

import { Wallet, Plus, X, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import { type BalanceCheckpoint } from "@/lib/db";
import { getPrimaryAccount } from "@/lib/accounts";
import { setInitialBalance, addBalanceCheckpoint, getBalanceCheckpoints, deleteBalanceCheckpoint, recalculateAllBalances } from "@/lib/balance";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function AccountBalanceSettings() {
  const { toast } = useToast();
  
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

  // Recalculate
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateSuccess, setRecalculateSuccess] = useState(false);

  const loadAccountSettings = useCallback(async () => {
    const account = await getPrimaryAccount();
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
    loadAccountSettings();
  }, [loadAccountSettings]);

  const handleSaveInitialBalance = async () => {
    setSavingBalance(true);
    try {
      const account = await getPrimaryAccount();
      if (account && account.id) {
        await setInitialBalance(account.id, parseFloat(initialBalance) || 0, initialBalanceDate);
        toast({
          variant: "success",
          title: "Saved",
          description: "Initial balance saved. Balances recalculated.",
        });
      }
    } catch (error) {
      console.error("Failed to save initial balance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save initial balance.",
      });
    } finally {
      setSavingBalance(false);
    }
  };

  const handleAddCheckpoint = async () => {
    setAddingCheckpoint(true);
    try {
      const account = await getPrimaryAccount();
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
        toast({
          variant: "success",
          title: "Added",
          description: "Balance checkpoint added.",
        });
      }
    } catch (error) {
      console.error("Failed to add checkpoint:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add balance checkpoint.",
      });
    } finally {
      setAddingCheckpoint(false);
    }
  };

  const handleDeleteCheckpoint = async (checkpointId: number) => {
    try {
      const account = await getPrimaryAccount();
      if (account && account.id) {
        await deleteBalanceCheckpoint(checkpointId, account.id);
        const cps = await getBalanceCheckpoints(account.id);
        setCheckpoints(cps);
        toast({
          title: "Deleted",
          description: "Balance checkpoint removed.",
        });
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
      toast({
        variant: "success",
        title: "Recalculated",
        description: "All balances have been updated from transactions.",
      });
    } catch (error) {
      console.error("Failed to recalculate balances:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to recalculate balances.",
      });
    } finally {
      setRecalculating(false);
    }
  };

  return (
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
  );
}
