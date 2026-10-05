import type { Transaction } from "./types";

/** Identity normalisation. Frozen: recurrence keys and estimate ids depend on it. */
export const normalizedText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Bank references/dates are not counterparty identities. */
export function recurrenceIdentity(
  t: Pick<Transaction, "merchant" | "label" | "raw">,
): string {
  const candidates = [
    t.merchant,
    t.label,
    ...Object.entries(t.raw ?? {})
      .filter(([key]) =>
        /^(detail|detail de l ecriture|libelle|label|description)$/.test(
          normalizedText(key),
        ),
      )
      .map(([, value]) => String(value)),
  ];
  for (const candidate of candidates) {
    const sender = candidate?.match(
      /\bDE\s*:\s*(.+?)(?=\s+(?:MOTIF|REF(?:ERENCE)?|DATE|POUR|CHEZ)\s*:|$)/i,
    );
    if (sender) return normalizedText(sender[1]);
  }
  const identity = normalizedText(t.merchant || t.label);
  return /^(?:vir|virement)(?: recu| permanent| instantane| sepa| emis)*$/.test(
    identity,
  )
    ? ""
    : identity;
}
