"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  db,
  CATEGORIES,
  type RecurringTransaction,
  type RecurringType,
  type LoanDetails,
  type Transaction,
} from "@/lib/db";
import { Money } from "@/components/ui/money";
import { useMoney } from "@/hooks/use-money";
import { useAccount } from "@/contexts/account-context";

interface InitialValues {
  name?: string;
  merchant?: string;
  amount?: number;
  category?: string;
  subcategory?: string;
  startDate?: string;
  transactionId?: number;
}

interface AddEditRecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurring: RecurringTransaction | null;
  onSave: (data: Partial<RecurringTransaction>) => void;
  onLinkToExisting?: (recurringId: number, transactionId: number) => void;
  defaultType?: RecurringType;
  initialValues?: InitialValues;
  sourceTransaction?: Transaction | null;
  defaultAccountId?: number;
}

const initialFormData = {
  name: "",
  merchant: "",
  amount: "",
  type: "subscription" as RecurringType,
  frequency: "monthly" as RecurringTransaction["frequency"],
  category: "Bills",
  subcategory: "",
  expectedDay: "",
  isVariable: false,
  startDate: format(new Date(), "yyyy-MM-dd"),
  // Loan fields
  principalAmount: "",
  interestRate: "",
  termMonths: "",
  remainingBalance: "",
};

export function AddEditRecurringDialog({
  open,
  onOpenChange,
  recurring,
  onSave,
  onLinkToExisting,
  defaultType = "subscription",
  initialValues,
  sourceTransaction,
  defaultAccountId,
}: AddEditRecurringDialogProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [mode, setMode] = useState<"new" | "link">("new");
  const [existingRecurring, setExistingRecurring] = useState<RecurringTransaction[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { getAccountCurrency } = useMoney();
  const { accounts } = useAccount();
  const [accountId, setAccountId] = useState("");

  const isEditing = !!recurring?.id;
  const showLinkOption = !!sourceTransaction && !isEditing;

  // Load existing recurring items for linking
  useEffect(() => {
    if (open && showLinkOption) {
      db.recurringTransactions
        .filter((r) => r.status === "active" && !r.isExcluded)
        .toArray()
        .then(setExistingRecurring);
    }
  }, [open, showLinkOption]);

  // Filter existing by search term
  const filteredExisting = useMemo(() => {
    if (!searchTerm) return existingRecurring;
    const term = searchTerm.toLowerCase();
    return existingRecurring.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.merchant?.toLowerCase().includes(term)
    );
  }, [existingRecurring, searchTerm]);

  // Initialize form when recurring or initialValues changes
  useEffect(() => {
    setAccountId(String(recurring?.accountId || sourceTransaction?.accountId || defaultAccountId || ""));
    if (recurring) {
      setFormData({
        name: recurring.name,
        merchant: recurring.merchant || "",
        amount: Math.abs(recurring.amount).toString(),
        type: recurring.type || "subscription",
        frequency: recurring.frequency,
        category: recurring.category,
        subcategory: recurring.subcategory || "",
        expectedDay: recurring.expectedDay?.toString() || "",
        isVariable: recurring.isVariable || false,
        startDate: recurring.startDate || format(new Date(), "yyyy-MM-dd"),
        principalAmount: recurring.loan?.principalAmount?.toString() || "",
        interestRate: recurring.loan?.interestRate?.toString() || "",
        termMonths: recurring.loan?.termMonths?.toString() || "",
        remainingBalance: recurring.loan?.remainingBalance?.toString() || "",
      });
    } else if (initialValues) {
      setFormData({
        ...initialFormData,
        name: initialValues.name || "",
        merchant: initialValues.merchant || "",
        amount: initialValues.amount ? Math.abs(initialValues.amount).toString() : "",
        type: defaultType,
        category: initialValues.category || (defaultType === "income" ? "Income" : "Bills"),
        subcategory: initialValues.subcategory || "",
        startDate: initialValues.startDate || format(new Date(), "yyyy-MM-dd"),
      });
    } else {
      setFormData({ ...initialFormData, type: defaultType });
    }
    setMode("new");
    setSelectedExistingId(null);
    setSearchTerm("");
  }, [recurring, initialValues, defaultType, open, sourceTransaction, defaultAccountId]);

  const handleSubmit = () => {
    const amount = parseFloat(formData.amount);
    if (!formData.name || isNaN(amount) || !accountId) return;

    // Build loan details if type is loan
    let loanDetails: LoanDetails | undefined;
    if (formData.type === "loan") {
      const principalAmount = parseFloat(formData.principalAmount) || 0;
      const interestRate = parseFloat(formData.interestRate) || 0;
      const termMonths = parseInt(formData.termMonths) || 0;
      const remainingBalance = parseFloat(formData.remainingBalance) || principalAmount;
      const totalPaid = recurring?.loan?.totalPaid || 0;
      const totalInterestPaid = recurring?.loan?.totalInterestPaid || 0;
      const paymentsMade = recurring?.loan?.paymentsMade || 0;

      loanDetails = {
        principalAmount,
        interestRate,
        termMonths,
        remainingBalance,
        totalPaid,
        totalInterestPaid,
        paymentsMade,
        paymentsRemaining: termMonths - paymentsMade,
      };
    }

    // Determine sign based on type
    const signedAmount =
      formData.type === "income" ? Math.abs(amount) : -Math.abs(amount);

    const data: Partial<RecurringTransaction> = {
      name: formData.name,
      merchant: formData.merchant || undefined,
      amount: signedAmount,
      type: formData.type,
      frequency: formData.frequency,
      category: formData.category,
      subcategory: formData.subcategory || "",
      expectedDay: formData.expectedDay ? parseInt(formData.expectedDay) : undefined,
      isVariable: formData.isVariable,
      startDate: formData.startDate,
      loan: loanDetails,
      status: recurring?.status || "active",
      isUserCreated: true,
      accountId: Number(accountId),
    };

    onSave(data);
    onOpenChange(false);
  };

  const handleLinkToExisting = () => {
    if (selectedExistingId && sourceTransaction?.id && onLinkToExisting) {
      onLinkToExisting(selectedExistingId, sourceTransaction.id);
      onOpenChange(false);
    }
  };

  const categoryOptions = Object.keys(CATEGORIES).filter((cat) => {
    if (formData.type === "income") return cat === "Income";
    return cat !== "Income";
  });

  const subcategoryOptions =
    formData.category && CATEGORIES[formData.category]
      ? CATEGORIES[formData.category].subcategories
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier" : "Ajouter"}{" "}
            {formData.type === "subscription"
              ? "un abonnement"
              : formData.type === "bill"
              ? "une facture"
              : formData.type === "loan"
              ? "un crédit"
              : "un revenu"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifiez les informations de cet élément récurrent."
              : showLinkOption
              ? "Créez un élément ou reliez la transaction à un élément existant."
              : "Ajoutez un nouveau paiement ou revenu récurrent."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="recurring-account">Compte concerné</Label>
          <Select value={accountId} onValueChange={setAccountId} disabled={!!sourceTransaction}>
            <SelectTrigger id="recurring-account" aria-label="Compte concerné">
              <SelectValue placeholder="Choisir un compte" />
            </SelectTrigger>
            <SelectContent>
              {accounts.filter((account) => account.isActive !== false && account.id).map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!accountId && <p role="alert" className="text-sm text-destructive">Le compte est obligatoire.</p>}
        </div>

        {showLinkOption ? (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "new" | "link")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new" className="gap-2">
                <Plus className="h-4 w-4" />
                Créer
              </TabsTrigger>
              <TabsTrigger value="link" className="gap-2">
                <Link2 className="h-4 w-4" />
                Relier à un existant
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-4">
              <FormFields
                formData={formData}
                setFormData={setFormData}
                categoryOptions={categoryOptions}
                subcategoryOptions={subcategoryOptions}
              />
            </TabsContent>

            <TabsContent value="link" className="mt-4">
              <div className="space-y-4">
                <div>
                  <Label>Rechercher un élément récurrent</Label>
                  <Input
                    placeholder="Rechercher par nom ou marchand…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  {filteredExisting.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {existingRecurring.length === 0
                        ? "Aucun élément récurrent existant"
                        : "Aucun résultat"}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredExisting.map((item) => {
                        const categoryInfo = CATEGORIES[item.category];
                        const isSelected = selectedExistingId === item.id;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            className={`w-full p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted"
                            }`}
                            onClick={() => setSelectedExistingId(item.id!)}
                            aria-pressed={isSelected}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                                  style={{
                                    backgroundColor: `${categoryInfo?.color}15`,
                                    color: categoryInfo?.color,
                                  }}
                                >
                                  {categoryInfo?.icon && (
                                    <categoryInfo.icon className="h-4 w-4" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  {item.merchant && (
                                    <p className="text-xs text-muted-foreground">
                                      {item.merchant}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold">
                                  <Money
                                    amount={Math.abs(item.amount)}
                                    currency={getAccountCurrency(item.accountId)}
                                    minimumFractionDigits={2}
                                    maximumFractionDigits={2}
                                  />
                                </p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {item.frequency} • {item.type || "subscription"}
                                </p>
                              </div>
                            </div>
                            {item.occurrences && item.occurrences.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {item.occurrences.length} paiement{item.occurrences.length !== 1 ? "s" : ""} suivi{item.occurrences.length !== 1 ? "s" : ""}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {sourceTransaction && (
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm font-medium mb-1">Transaction à relier :</p>
                    <p className="text-sm">
                      {sourceTransaction.merchant} -{" "}
                      <Money
                        amount={Math.abs(sourceTransaction.amount)}
                        currency={getAccountCurrency(sourceTransaction.accountId)}
                        minimumFractionDigits={2}
                        maximumFractionDigits={2}
                      />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(sourceTransaction.date), "MMMM d, yyyy")}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <FormFields
            formData={formData}
            setFormData={setFormData}
            categoryOptions={categoryOptions}
            subcategoryOptions={subcategoryOptions}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {mode === "link" && showLinkOption ? (
            <Button
              onClick={handleLinkToExisting}
              disabled={!selectedExistingId}
            >
              Relier la transaction
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.amount || !accountId}
            >
              {isEditing ? "Enregistrer" : "Créer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Extracted form fields component
function FormFields({
  formData,
  setFormData,
  categoryOptions,
  subcategoryOptions,
}: {
  formData: typeof initialFormData;
  setFormData: React.Dispatch<React.SetStateAction<typeof initialFormData>>;
  categoryOptions: string[];
  subcategoryOptions: readonly string[];
}) {
  return (
    <div className="space-y-4">
      {/* Type Selection */}
      <div>
        <Label>Type</Label>
        <Select
          value={formData.type}
          onValueChange={(v) => {
            const newType = v as RecurringType;
            setFormData({
              ...formData,
              type: newType,
              category:
                newType === "income"
                  ? "Income"
                  : newType === "loan"
                  ? "Housing"
                  : "Bills",
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subscription">Abonnement</SelectItem>
            <SelectItem value="bill">Facture</SelectItem>
            <SelectItem value="loan">Crédit</SelectItem>
            <SelectItem value="income">Revenu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Name and Merchant */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Nom *</Label>
          <Input
            placeholder="Ex. Netflix, loyer, prêt immobilier"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
        </div>
        <div>
          <Label>Marchand</Label>
          <Input
            placeholder="Nom de l’entreprise"
            value={formData.merchant}
            onChange={(e) =>
              setFormData({ ...formData, merchant: e.target.value })
            }
          />
        </div>
      </div>

      {/* Amount and Frequency */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Montant *</Label>
          <Input
            type="number"
            placeholder="0.00"
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
          />
        </div>
        <div>
          <Label>Fréquence</Label>
          <Select
            value={formData.frequency}
            onValueChange={(v) =>
              setFormData({
                ...formData,
                frequency: v as RecurringTransaction["frequency"],
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Hebdomadaire</SelectItem>
              <SelectItem value="biweekly">Toutes les deux semaines</SelectItem>
              <SelectItem value="monthly">Mensuelle</SelectItem>
              <SelectItem value="quarterly">Trimestrielle</SelectItem>
              <SelectItem value="yearly">Annuelle</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category and Subcategory */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Catégorie</Label>
          <Select
            value={formData.category}
            onValueChange={(v) =>
              setFormData({ ...formData, category: v, subcategory: "" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {subcategoryOptions.length > 0 && (
          <div>
            <Label>Sous-catégorie</Label>
            <Select
              value={formData.subcategory}
              onValueChange={(v) =>
                setFormData({ ...formData, subcategory: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {subcategoryOptions.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    {sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Expected Day and Start Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Jour prévu du mois</Label>
          <Input
            type="number"
            placeholder="1-31"
            min="1"
            max="31"
            value={formData.expectedDay}
            onChange={(e) =>
              setFormData({ ...formData, expectedDay: e.target.value })
            }
          />
        </div>
        <div>
          <Label>Date de début</Label>
          <Input
            type="date"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
          />
        </div>
      </div>

      {/* Variable Amount */}
      {formData.type !== "loan" && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isVariable"
            checked={formData.isVariable}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isVariable: !!checked })
            }
          />
          <Label htmlFor="isVariable" className="text-sm font-normal">
            Le montant varie à chaque échéance
          </Label>
        </div>
      )}

      {/* Loan-specific fields */}
      {formData.type === "loan" && (
        <>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Détails du crédit</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Capital emprunté</Label>
                <Input
                  type="number"
                  placeholder="Montant total emprunté"
                  min="0"
                  step="0.01"
                  value={formData.principalAmount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      principalAmount: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Taux d’intérêt (%)</Label>
                <Input
                  type="number"
                  placeholder="Taux annuel"
                  min="0"
                  step="0.01"
                  value={formData.interestRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      interestRate: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Durée (mois)</Label>
                <Input
                  type="number"
                  placeholder="Durée du crédit"
                  min="1"
                  value={formData.termMonths}
                  onChange={(e) =>
                    setFormData({ ...formData, termMonths: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Capital restant dû</Label>
                <Input
                  type="number"
                  placeholder="Solde actuel"
                  min="0"
                  step="0.01"
                  value={formData.remainingBalance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      remainingBalance: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
