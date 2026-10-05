import { Lock } from "lucide-react";
import { useId, useRef, useState } from "react";
import type { AccountChoice, Mapping } from "../../data/importer/mapping";
import type { ParsedFile } from "../../data/importer/parse";
import { accountChoiceIssues } from "../../data/importer/preview";
import { accountStatus } from "../../domain/balances";
import { formatDay } from "../../domain/dates";
import type { Ledger } from "../../domain/ledger";
import { formatEuro } from "../../domain/money";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { Field } from "../../ui/Field";
import { Picker } from "../../ui/Picker";
import { identifiedAccount, sourceAccounts } from "./flow";
import { localDay, plural } from "./labels";

// Picker values: "id:<account id>" or NEW (Radix reserves "").
const NEW = "new";

interface Row {
  mode: "existing" | "new";
  id: string;
  name: string;
}

export function AccountDialog({
  open,
  file,
  mapping,
  initial,
  ledger,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  file: ParsedFile;
  mapping: Mapping;
  initial: AccountChoice;
  ledger: Ledger;
  onCancel(): void;
  onSubmit(choice: AccountChoice): void;
}) {
  const formId = useId();
  const accounts = ledger.accounts;
  const status = accountStatus(ledger);
  const sources = sourceAccounts(file, mapping);
  const locked = identifiedAccount(file, accounts);
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      sources.map((source) => {
        const value = initial[source] ?? source;
        const existing = accounts.some((a) => a.id === value);
        return [
          source,
          existing
            ? { mode: "existing", id: value, name: "" }
            : { mode: "new", id: "", name: value },
        ];
      }),
    ),
  );
  const choice: AccountChoice = Object.fromEntries(
    sources.map((s) => {
      const row = rows[s];
      return [s, row?.mode === "existing" ? row.id : (row?.name ?? "")];
    }),
  );
  const issues = accountChoiceIssues(file, mapping, choice, accounts);
  // Opening focus: the first name to type, else « Continuer » (Enter submits).
  const names = useRef(new Map<string, HTMLInputElement>());
  // The picker gives focus back to its trigger on close: move it to the name after.
  const focusName = (source: string) =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => names.current.get(source)?.focus()),
    );
  const [focusSource] = useState(() =>
    sources.find((s) => rows[s]?.mode === "new" && !(locked && !s)),
  );
  const counts = new Map<string, number>();
  for (const r of file.rows) {
    const source = mapping.account ? (r[mapping.account]?.trim() ?? "") : "";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  const update = (source: string, patch: Partial<Row>) =>
    setRows((all) => ({ ...all, [source]: { ...all[source], ...patch } }));

  const options = status.map((s) => ({
    value: `id:${s.id}`,
    label: s.name,
    meta:
      s.balance === null
        ? "à confirmer"
        : formatEuro(s.balance, { cents: "never" }),
    description: s.lastImport
      ? `importé le ${formatDay(localDay(s.lastImport))}`
      : undefined,
  }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={
        sources.length > 1
          ? `Ce relevé contient ${sources.length} comptes`
          : "Ce relevé concerne quel compte\u00a0?"
      }
      description={
        <span className="mono">
          {file.name} · {plural(file.rows.length, "ligne", "lignes")}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant="primary"
            type="submit"
            form={formId}
            disabledReason={issues[0]}
            autoFocus={focusSource === undefined}
          >
            Continuer
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="account-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!issues.length) onSubmit(choice);
        }}
      >
        {sources.map((source) => {
          const row = rows[source];
          const count = counts.get(source) ?? 0;
          const heading = source || (sources.length > 1 ? "Sans compte" : "");
          return (
            <fieldset key={source} className="account-row">
              <legend className={heading ? "account-source" : "sr-only"}>
                {heading || "Compte de destination"}
                {heading && (
                  <span className="mono muted">
                    {" "}
                    · {plural(count, "ligne", "lignes")}
                  </span>
                )}
              </legend>
              {locked && !source ? (
                <div className="account-locked">
                  <Lock size={16} aria-hidden />
                  <strong>
                    {status.find((s) => s.id === locked.id)?.name ?? locked.id}
                  </strong>
                  <Badge tone="neutral" title={`n° ${locked.bankAccountId}`}>
                    reconnu par son numéro
                  </Badge>
                </div>
              ) : (
                <>
                  {accounts.length > 0 && (
                    <Picker
                      label={`Destination${source ? ` de ${source}` : ""}`}
                      className="account-picker"
                      value={row.mode === "new" ? NEW : `id:${row.id}`}
                      valueLabel={
                        row.mode === "new" ? "Nouveau compte" : undefined
                      }
                      onValueChange={(value) => {
                        if (value !== NEW)
                          return update(source, {
                            mode: "existing",
                            id: value.slice(3),
                          });
                        focusName(source);
                        update(source, {
                          mode: "new",
                          name: row.name || source,
                        });
                      }}
                      sections={[
                        { label: "Comptes", options },
                        { options: [{ value: NEW, label: "Nouveau compte" }] },
                      ]}
                    />
                  )}
                  {row.mode === "new" && (
                    <Field
                      label="Nom du nouveau compte"
                      value={row.name}
                      maxLength={100}
                      autoFocus={source === focusSource}
                      ref={(el) => {
                        if (el) names.current.set(source, el);
                        else names.current.delete(source);
                      }}
                      onChange={(event) =>
                        update(source, { name: event.target.value })
                      }
                    />
                  )}
                </>
              )}
            </fieldset>
          );
        })}
        {issues.length > 0 && (
          <ul className="import-issues" aria-live="polite">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </form>
    </Dialog>
  );
}
