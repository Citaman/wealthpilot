export type ImportQuality = "imported" | "reconciled" | "needs-review";

export function getImportQuality(
  reconciliation: { isReconciled: boolean } | null,
  errorCount: number
): ImportQuality {
  if (errorCount > 0 || reconciliation?.isReconciled === false) {
    return "needs-review";
  }

  return reconciliation?.isReconciled === true ? "reconciled" : "imported";
}
