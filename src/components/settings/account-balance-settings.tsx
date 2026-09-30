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
import { setInitialBalance, addBalanceCheckpoint, getBalanceCheckpoints, deleteBalanceCheckpoint, recalculateBalances } from "@/lib/balance";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { logger } from "@/lib/logger";
import { useAccount } from "@/contexts/account-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Money } from "@/components/ui/money";

export function AccountBalanceSettings() {
  const { toast } = useToast();
  const { accounts, selectedAccountId } = useAccount();
  const [settingsAccountId, setSettingsAccountId] = useState<number | null>(null);
  
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
  const [checkpointToDelete, setCheckpointToDelete] = useState<number | null>(null);
  const currentAccount = accounts.find((candidate) => candidate.id === settingsAccountId);
  const currentCurrency = currentAccount?.currency || "EUR";

  // Recalculate
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateSuccess, setRecalculateSuccess] = useState(false);

  const loadAccountSettings = useCallback(async () => {
    const account = accounts.find((candidate) => candidate.id === settingsAccountId);
    if (account) {
      setInitialBalanceState(account.initialBalance?.toString() || "0");
      setInitialBalanceDate(account.initialBalanceDate || new Date().toISOString().split("T")[0]);
      
      // Load checkpoints for this account
      if (account.id) {
        const cps = await getBalanceCheckpoints(account.id);
        setCheckpoints(cps);
      }
    }
  }, [accounts, settingsAccountId]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSettingsAccountId(null);
      return;
    }
    const preferred = selectedAccountId !== "all" && accounts.some((account) => account.id === selectedAccountId)
      ? selectedAccountId
      : accounts[0].id!;
    setSettingsAccountId((current) => current && accounts.some((account) => account.id === current) ? current : preferred);
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    loadAccountSettings();
  }, [loadAccountSettings]);

  const handleSaveInitialBalance = async () => {
    setSavingBalance(true);
    try {
      const account = accounts.find((candidate) => candidate.id === settingsAccountId);
      if (account && account.id) {
        await setInitialBalance(account.id, parseFloat(initialBalance) || 0, initialBalanceDate);
        toast({
          variant: "success",
          title: "Solde enregistré",
          description: "Le solde initial est enregistré et les soldes ont été recalculés.",
        });
      }
    } catch (error) {
      logger.error("Failed to save initial balance:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d’enregistrer le solde initial.",
      });
    } finally {
      setSavingBalance(false);
    }
  };

  const handleAddCheckpoint = async () => {
    setAddingCheckpoint(true);
    try {
      const account = accounts.find((candidate) => candidate.id === settingsAccountId);
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
          title: "Point de contrôle ajouté",
          description: "Le solde connu a bien été ajouté.",
        });
      }
    } catch (error) {
      logger.error("Failed to add checkpoint:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d’ajouter ce solde connu.",
      });
    } finally {
      setAddingCheckpoint(false);
    }
  };

  const handleDeleteCheckpoint = async (checkpointId: number) => {
    try {
      const account = accounts.find((candidate) => candidate.id === settingsAccountId);
      if (account && account.id) {
        await deleteBalanceCheckpoint(checkpointId, account.id);
        const cps = await getBalanceCheckpoints(account.id);
        setCheckpoints(cps);
        toast({
          variant: "success",
          title: "Point supprimé",
          description: "Le solde connu a été supprimé.",
        });
      }
    } catch (error) {
      logger.error("Failed to delete checkpoint:", error);
    }
  };

  const handleRecalculateAll = async () => {
    setRecalculating(true);
    setRecalculateSuccess(false);
    try {
      if (!settingsAccountId) throw new Error("Sélectionnez d’abord un compte");
      await recalculateBalances(settingsAccountId);
      setRecalculateSuccess(true);
      // Reload account settings to show updated balance
      await loadAccountSettings();
      setTimeout(() => setRecalculateSuccess(false), 3000);
      toast({
        variant: "success",
        title: "Soldes recalculés",
        description: "Le solde du compte a été mis à jour à partir des transactions.",
      });
    } catch (error) {
      logger.error("Failed to recalculate balances:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de recalculer les soldes.",
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
          Solde du compte
        </CardTitle>
        <CardDescription>Définissez un point de départ fiable pour le suivi du solde.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Compte</Label>
          <Select
            value={settingsAccountId?.toString() || ""}
            onValueChange={(value) => setSettingsAccountId(Number(value))}
          >
            <SelectTrigger aria-label="Compte à rapprocher">
              <SelectValue placeholder="Sélectionner un compte" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id!.toString()}>
                  {account.name} · {account.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg bg-muted p-4">
          <p className="mb-2 text-sm text-muted-foreground">
            <strong>Principe :</strong> les soldes sont calculés à partir des transactions et de ce solde initial. Si le solde actuel semble incorrect, ajustez le montant et sa date.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="initial-balance">Solde initial ({currentCurrency})</Label>
            <Input
              id="initial-balance"
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalanceState(e.target.value)}
              placeholder="0.00"
              step="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial-balance-date">Date du solde</Label>
            <Input
              id="initial-balance-date"
              type="date"
              value={initialBalanceDate}
              onChange={(e) => setInitialBalanceDate(e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Indiquez le solde du compte le jour <strong>précédant</strong> la première transaction importée.
        </p>

        <Button onClick={handleSaveInitialBalance} loading={savingBalance}>
          Enregistrer et recalculer
        </Button>

        {/* Balance Checkpoints Section */}
        <div className="border-t pt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-medium">Soldes connus</h4>
              <p className="text-sm text-muted-foreground">
                Ajoutez les dates auxquelles vous connaissez le solde exact, par exemple grâce à un relevé bancaire.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowAddCheckpoint(!showAddCheckpoint)}>
              <Plus className="mr-1 h-4 w-4" />
              Ajouter
            </Button>
          </div>

          {showAddCheckpoint && (
            <div className="mb-4 space-y-4 rounded-lg bg-muted p-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="checkpoint-date">Date</Label>
                  <Input
                    id="checkpoint-date"
                    type="date"
                    value={newCheckpointDate}
                    onChange={(e) => setNewCheckpointDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkpoint-balance">Solde ({currentCurrency})</Label>
                  <Input
                    id="checkpoint-balance"
                    type="number"
                    value={newCheckpointBalance}
                    onChange={(e) => setNewCheckpointBalance(e.target.value)}
                    placeholder="1234.56"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkpoint-note">Note (facultative)</Label>
                  <Input
                    id="checkpoint-note"
                    value={newCheckpointNote}
                    onChange={(e) => setNewCheckpointNote(e.target.value)}
                    placeholder="Relevé bancaire de décembre 2024"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddCheckpoint} loading={addingCheckpoint} size="sm">
                  Ajouter le point
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowAddCheckpoint(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {checkpoints.length > 0 ? (
            <div className="space-y-2">
              {checkpoints.map((cp) => (
                <div key={cp.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="text-sm font-mono">{format(new Date(cp.date), "dd MMM yyyy", { locale: fr })}</div>
                    <div className="font-medium">
                      <Money amount={cp.balance} currency={currentCurrency} />
                    </div>
                    {cp.note && <div className="text-sm text-muted-foreground">{cp.note}</div>}
                  </div>
                  <Button variant="ghost" size="icon" aria-label={`Supprimer le solde connu du ${format(new Date(cp.date), "dd MMM yyyy", { locale: fr })}`} onClick={() => cp.id && setCheckpointToDelete(cp.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Aucun solde connu. Ajoutez-en un pour améliorer la précision.
            </p>
          )}
        </div>

        {/* Balance Maintenance */}
        <div className="border-t pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Recalculer les soldes</p>
              <p className="text-sm text-muted-foreground">
                Corrige les écarts en repartant des transactions du compte.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {recalculateSuccess && (
                <span className="flex items-center gap-1 text-sm text-foreground">
                  <Check className="h-4 w-4" /> Terminé
                </span>
              )}
              <Button variant="outline" onClick={handleRecalculateAll} loading={recalculating}>
                <RefreshCw className={cn("mr-2 h-4 w-4", recalculating && "animate-spin")} />
                Recalculer
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
      <ConfirmationDialog
        open={checkpointToDelete !== null}
        onOpenChange={(open) => { if (!open) setCheckpointToDelete(null); }}
        title="Supprimer ce solde connu ?"
        description="Ce point de contrôle sera retiré. Les transactions et le compte ne seront pas supprimés."
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          if (checkpointToDelete === null) return;
          await handleDeleteCheckpoint(checkpointToDelete);
          setCheckpointToDelete(null);
        }}
      />
    </Card>
  );
}
