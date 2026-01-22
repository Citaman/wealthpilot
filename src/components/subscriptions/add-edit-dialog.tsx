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
}: AddEditRecurringDialogProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [mode, setMode] = useState<"new" | "link">("new");
  const [existingRecurring, setExistingRecurring] = useState<RecurringTransaction[]>([]);
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { getAccountCurrency } = useMoney();

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
  }, [recurring, initialValues, defaultType, open]);

  const handleSubmit = () => {
    const amount = parseFloat(formData.amount);
    if (!formData.name || isNaN(amount)) return;

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
            {isEditing ? "Edit" : "Add"}{" "}
            {formData.type === "subscription"
              ? "Subscription"
              : formData.type === "bill"
              ? "Bill"
              : formData.type === "loan"
              ? "Loan"
              : "Income"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the details of this recurring item"
              : showLinkOption
              ? "Create new or link to existing recurring item"
              : "Add a new recurring payment or income"}
          </DialogDescription>
        </DialogHeader>

        {showLinkOption ? (
          <Tabs value={mode} onValueChange={(v) => setMode(v as "new" | "link")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new" className="gap-2">
                <Plus className="h-4 w-4" />
                Create New
              </TabsTrigger>
              <TabsTrigger value="link" className="gap-2">
                <Link2 className="h-4 w-4" />
                Link to Existing
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
                  <Label>Search Recurring Items</Label>
                  <Input
                    placeholder="Search by name or merchant..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <ScrollArea className="h-[300px] border rounded-lg p-2">
                  {filteredExisting.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {existingRecurring.length === 0
                        ? "No existing recurring items found"
                        : "No matches found"}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredExisting.map((item) => {
                        const categoryInfo = CATEGORIES[item.category];
                        const isSelected = selectedExistingId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => setSelectedExistingId(item.id!)}
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
                                {item.occurrences.length} payment{item.occurrences.length !== 1 ? "s" : ""} tracked
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {sourceTransaction && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm font-medium mb-1">Transaction to link:</p>
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
            Cancel
          </Button>
          {mode === "link" && showLinkOption ? (
            <Button
              onClick={handleLinkToExisting}
              disabled={!selectedExistingId}
            >
              Link Transaction
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.amount}
            >
              {isEditing ? "Save Changes" : "Create"}
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
            <SelectItem value="subscription">Subscription</SelectItem>
            <SelectItem value="bill">Bill</SelectItem>
            <SelectItem value="loan">Loan</SelectItem>
            <SelectItem value="income">Income</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Name and Merchant */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name *</Label>
          <Input
            placeholder="e.g., Netflix, Rent, Mortgage"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
        </div>
        <div>
          <Label>Merchant</Label>
          <Input
            placeholder="Company name"
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
          <Label>Amount *</Label>
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
          <Label>Frequency</Label>
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
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="biweekly">Biweekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category and Subcategory */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Category</Label>
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
            <Label>Subcategory</Label>
            <Select
              value={formData.subcategory}
              onValueChange={(v) =>
                setFormData({ ...formData, subcategory: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
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
          <Label>Expected Day of Month</Label>
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
          <Label>Start Date</Label>
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
            Amount varies each time
          </Label>
        </div>
      )}

      {/* Loan-specific fields */}
      {formData.type === "loan" && (
        <>
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Loan Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Principal Amount</Label>
                <Input
                  type="number"
                  placeholder="Total loan amount"
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
                <Label>Interest Rate (%)</Label>
                <Input
                  type="number"
                  placeholder="Annual rate"
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
                <Label>Term (months)</Label>
                <Input
                  type="number"
                  placeholder="Loan duration"
                  min="1"
                  value={formData.termMonths}
                  onChange={(e) =>
                    setFormData({ ...formData, termMonths: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Remaining Balance</Label>
                <Input
                  type="number"
                  placeholder="Current balance"
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
