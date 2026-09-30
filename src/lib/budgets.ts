import { db, type Budget } from "./db";

export interface BudgetPreferences {
  preset: string;
  monthlyIncome: string;
  customAllocations: {
    needs: number;
    wants: number;
    savings: number;
  };
}

export const DEFAULT_BUDGET_PREFERENCES: BudgetPreferences = {
  preset: "50-30-20",
  monthlyIncome: "",
  customAllocations: { needs: 50, wants: 30, savings: 20 },
};

const BUDGET_PREFERENCES_KEY = "budgetPreferences";

export async function getBudgetPreferences(): Promise<BudgetPreferences> {
  const [stored, legacyRule] = await Promise.all([
    db.settings.where("key").equals(BUDGET_PREFERENCES_KEY).first(),
    db.settings.where("key").equals("budgetRule").first(),
  ]);

  if (!stored) {
    return {
      ...DEFAULT_BUDGET_PREFERENCES,
      preset: legacyRule?.value || DEFAULT_BUDGET_PREFERENCES.preset,
    };
  }

  try {
    const parsed = JSON.parse(stored.value) as Partial<BudgetPreferences>;
    const allocations = parsed.customAllocations;
    return {
      preset: typeof parsed.preset === "string" ? parsed.preset : DEFAULT_BUDGET_PREFERENCES.preset,
      monthlyIncome: typeof parsed.monthlyIncome === "string" ? parsed.monthlyIncome : "",
      customAllocations: {
        needs: Number.isFinite(allocations?.needs) ? Number(allocations?.needs) : 50,
        wants: Number.isFinite(allocations?.wants) ? Number(allocations?.wants) : 30,
        savings: Number.isFinite(allocations?.savings) ? Number(allocations?.savings) : 20,
      },
    };
  } catch {
    return DEFAULT_BUDGET_PREFERENCES;
  }
}

export async function saveBudgetPreferences(preferences: BudgetPreferences): Promise<void> {
  const existing = await db.settings.where("key").equals(BUDGET_PREFERENCES_KEY).first();
  const value = JSON.stringify(preferences);
  if (existing?.id) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.add({ key: BUDGET_PREFERENCES_KEY, value });
  }
}

/** Upsert one budget period without overwriting another month in the same year. */
export async function saveBudgetAmount(
  category: string,
  amount: number,
  year: number,
  month?: number
): Promise<number> {
  const period: Budget["period"] = month === undefined ? "yearly" : "monthly";
  const existing = await db.budgets
    .where("category")
    .equals(category)
    .filter((budget) => (
      budget.year === year &&
      budget.month === month &&
      budget.period === period
    ))
    .first();
  const now = new Date().toISOString();

  if (existing?.id) {
    await db.budgets.update(existing.id, { amount, updatedAt: now });
    return existing.id;
  }

  return db.budgets.add({
    category,
    amount,
    period,
    year,
    month,
    createdAt: now,
    updatedAt: now,
  });
}
