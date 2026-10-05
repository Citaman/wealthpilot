import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
  mappingFields,
  mappingIssues,
  type Field,
  type Mapping,
} from "../../data/importer/mapping";
import type { ParsedFile } from "../../data/importer/parse";
import { formatDate, parseDate } from "../../domain/dates";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { Picker } from "../../ui/Picker";
import { StepHeading } from "./StepHeading";
import { fileFacts, plural } from "./labels";

const fieldLabels: Record<Field, string> = {
  date: "Date",
  label: "Libellé",
  amount: "Montant",
  debit: "Débit",
  credit: "Crédit",
  direction: "Sens",
  account: "Compte",
  merchant: "Commerçant",
  category: "Catégorie",
  internal: "Virement interne",
  currency: "Devise",
  balance: "Solde",
};
const IGNORE = "ignore" as const;
type Role = Field | typeof IGNORE;
const SAMPLE = 8;

function dateFormat(value: string | undefined) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return "AAAA-MM-JJ";
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value.trim())) return "JJ/MM/AAAA";
  return "non reconnu";
}

export function MappingStep({
  file,
  initial,
  backLabel,
  onBack,
  onConfirm,
}: {
  file: ParsedFile;
  initial: Mapping;
  backLabel: string;
  onBack(): void;
  onConfirm(mapping: Mapping): void;
}) {
  const [mapping, setMapping] = useState(initial);
  const issues = mappingIssues(mapping);
  const fieldOf = (column: string): Role =>
    mappingFields.find((f) => mapping[f] === column) ?? IGNORE;
  const assign = (column: string, field: Role) =>
    setMapping((m) => {
      const next = { ...m };
      for (const f of mappingFields) if (next[f] === column) next[f] = "";
      if (field !== IGNORE) next[field] = column;
      return next;
    });
  const format = dateFormat(file.rows[0]?.[mapping.date]);
  const firstDate = parseDate(file.rows[0]?.[mapping.date] ?? "", mapping.dateFormat);
  const options: { value: Role; label: string }[] = [
    { value: IGNORE, label: "Ignorer" },
    ...mappingFields.map((f) => ({ value: f, label: fieldLabels[f] })),
  ];

  return (
    <CardShell
      className="import-card"
      title={<StepHeading>Colonnes</StepHeading>}
      actions={
        <Button variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
      }
    >
      <p className="mono muted import-facts">
        {file.name} · {plural(file.rows.length, "ligne", "lignes")} ·{" "}
        {fileFacts(file)}
      </p>
      {mapping.date && (
        <div className="import-date-format">
          <Picker
            label="Format des dates"
            size="compact"
            value={mapping.dateFormat ?? "auto"}
            onValueChange={(v) => setMapping((m) => ({ ...m, dateFormat: v }))}
            options={[
              { value: "auto", label: `Automatique${format ? ` (${format})` : ""}` },
              { value: "dmy", label: "JJ/MM/AAAA" },
              { value: "mdy", label: "MM/JJ/AAAA" },
              { value: "ymd", label: "AAAA-MM-JJ" },
            ]}
          />
          <span className="mono muted">
            {firstDate ? `1re ligne : ${formatDate(firstDate)}` : "Date de la 1re ligne illisible"}
          </span>
        </div>
      )}
      {file.errors.length > 0 && (
        <div className="import-block" data-tone="error">
          <p className="import-block-title">
            <TriangleAlert size={16} aria-hidden /> Problèmes du fichier
          </p>
          <ul>
            {file.errors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
            {file.errors.length > 6 && (
              <li>+ {plural(file.errors.length - 6, "autre", "autres")}</li>
            )}
          </ul>
        </div>
      )}
      <div className="mapping-scroll">
        <table className="mapping-table">
          <caption className="sr-only">
            Rôle de chaque colonne, {SAMPLE} premières lignes
          </caption>
          <thead>
            <tr>
              {file.fields.map((column) => (
                <th key={column} scope="col">
                  <span className="mapping-column mono">{column}</span>
                  <Picker
                    size="compact"
                    label={`Rôle de la colonne ${column}`}
                    value={fieldOf(column)}
                    onValueChange={(v) => assign(column, v)}
                    options={options}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {file.rows.slice(0, SAMPLE).map((row, i) => (
              <tr key={i}>
                {file.fields.map((column) => (
                  <td
                    key={column}
                    data-ignored={fieldOf(column) === IGNORE || undefined}
                  >
                    {row[column]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="import-footer">
        <p className="import-live" aria-live="polite">
          {issues.length ? (
            <span className="import-missing">{issues.join(" ")}</span>
          ) : (
            <span className="mono muted">Colonnes complètes</span>
          )}
        </p>
        <Button
          variant="primary"
          size="m"
          disabledReason={issues[0]}
          onClick={() => onConfirm(mapping)}
        >
          Continuer
        </Button>
      </div>
    </CardShell>
  );
}
