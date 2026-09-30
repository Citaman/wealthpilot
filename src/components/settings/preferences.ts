import { getStringSetting, setStringSetting } from "@/lib/backups";

export const SETTINGS_PREFERENCE_KEYS = {
  budgetAlertThreshold: "budgetAlertThreshold",
} as const;

export const SETTINGS_PREFERENCE_EVENT = "wealthpilot:preference-change";
export const BUDGET_ALERT_THRESHOLDS = [50, 75, 80, 90, 100] as const;
export type BudgetAlertThreshold = (typeof BUDGET_ALERT_THRESHOLDS)[number];

export async function getBudgetAlertThreshold(): Promise<BudgetAlertThreshold> {
  const stored = Number(await getStringSetting(SETTINGS_PREFERENCE_KEYS.budgetAlertThreshold));
  return BUDGET_ALERT_THRESHOLDS.includes(stored as BudgetAlertThreshold)
    ? (stored as BudgetAlertThreshold)
    : 80;
}

export async function setBudgetAlertThreshold(value: BudgetAlertThreshold): Promise<void> {
  await setStringSetting(SETTINGS_PREFERENCE_KEYS.budgetAlertThreshold, String(value));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SETTINGS_PREFERENCE_EVENT, {
      detail: { key: SETTINGS_PREFERENCE_KEYS.budgetAlertThreshold, value },
    }));
  }
}
