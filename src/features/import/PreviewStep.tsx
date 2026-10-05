import { ChevronLeft, ChevronRight, Info, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../app/toast";
import {
  commitImport,
  ImportError,
  StaleError,
  type CheckpointDecision,
} from "../../data/importer/commit";
import type { AccountChoice, Mapping } from "../../data/importer/mapping";
import type { ParsedFile } from "../../data/importer/parse";
import {
  buildPreview,
  type PreviewCheckpoint,
  type PreviewRow,
} from "../../data/importer/preview";
import { formatDay } from "../../domain/dates";
import { accountName, type Ledger } from "../../domain/ledger";
import type { Batch } from "../../domain/types";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { CardShell } from "../../ui/CardShell";
import { IconButton } from "../../ui/IconButton";
import { Money } from "../../ui/Money";
import { Segmented } from "../../ui/Segmented";
import { fileFacts, namesLabel, plural } from "./labels";
import { StepHeading } from "./StepHeading";

export interface Outcome {
  batch: Batch;
  names: string[];
  skipped: number;
  balances: { name: string; date: string; decision: CheckpointDecision }[];
}

type Tab = PreviewRow["status"];
const PAGE = 50;

const defaultDecision = (c: PreviewCheckpoint): CheckpointDecision =>
  c.status === "derived" ? "derived" : "accept";

export function PreviewStep({
  file,
  mapping,
  choice,
  ledger,
  onCommitted,
  onFixColumns,
  onChangeAccount,
  onAbandon,
}: {
  file: ParsedFile;
  mapping: Mapping;
  choice: AccountChoice;
  ledger: Ledger;
  onCommitted(outcome: Outcome): void;
  onFixColumns(): void;
  onChangeAccount(): void;
  onAbandon(): void;
}) {
  const toast = useToast();
  const { transactions, accounts } = ledger;
  const preview = useMemo(
    () => buildPreview(file, mapping, choice, { transactions, accounts }),
    [file, mapping, choice, transactions, accounts],
  );
  const { counts } = preview;
  const [tab, setTab] = useState<Tab>(() =>
    counts.new ? "new" : counts.invalid ? "invalid" : "duplicate",
  );
  const [page, setPage] = useState(0);
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [decisions, setDecisions] = useState<
    Record<string, CheckpointDecision>
  >({});
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // A write elsewhere (other tab, undo) rebuilds the preview: say so.
  const token = useRef(preview.token);
  useEffect(() => {
    if (token.current === preview.token) return;
    token.current = preview.token;
    setChanged(true);
  }, [preview.token]);

  const existing = useMemo(
    () => new Map(transactions.map((t) => [t.id, t])),
    [transactions],
  );
  const batchNames = useMemo(
    () => new Map(ledger.batches.map((b) => [b.id, b.name])),
    [ledger.batches],
  );
  const matchOf = (id: string | undefined) => {
    const t = id ? existing.get(id) : undefined;
    return t && { ...t, source: batchNames.get(t.batchId) };
  };
  const newRows = preview.rows.filter((r) => r.status === "new");
  const selected = new Set(
    newRows.filter((r) => !excluded.has(r.index)).map((r) => r.index),
  );
  const name = (id: string) => accountName(ledger, id);
  const destinations = [
    ...new Set(
      preview.rows
        .filter((r) => r.tx && (!selected.size || selected.has(r.index)))
        .map((r) => r.tx!.account),
    ),
  ].map(name);
  const decisionOf = (c: PreviewCheckpoint) =>
    decisions[c.account] ?? defaultDecision(c);

  const shown = preview.rows.filter((r) => r.status === tab);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const current = Math.min(page, pages - 1);
  const visible = shown.slice(current * PAGE, (current + 1) * PAGE);

  const toggle = (index: number, on: boolean) =>
    setExcluded((set) => {
      const next = new Set(set);
      if (on) next.delete(index);
      else next.add(index);
      return next;
    });

  const blocked = preview.errors.length
    ? "Corrigez d'abord les erreurs du fichier."
    : !selected.size && !preview.metadata.accounts.length
      ? "Aucune opération sélectionnée."
      : undefined;
  const cta = selected.size
    ? `Importer ${plural(selected.size, "opération", "opérations")} dans ${namesLabel(destinations)}`
    : `Enregistrer le solde de ${namesLabel(preview.checkpoints.map((c) => name(c.account)))}`;

  async function commit() {
    setBusy(true);
    setFailure(null);
    try {
      const checkpointDecisions = Object.fromEntries(
        preview.checkpoints.map((c) => [c.account, decisionOf(c)]),
      );
      const batch = await commitImport(preview, {
        selected,
        checkpointDecisions,
      });
      onCommitted({
        batch,
        names: destinations,
        skipped: counts.duplicate,
        balances: preview.checkpoints.map((c) => ({
          name: name(c.account),
          date: c.date,
          decision: decisionOf(c),
        })),
      });
    } catch (error) {
      if (error instanceof StaleError) setChanged(true);
      else if (error instanceof ImportError) setFailure(error.message);
      else toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell
      className="import-card"
      title={<StepHeading>{file.name}</StepHeading>}
      actions={
        <div className="import-card-actions">
          <Button variant="ghost" onClick={onFixColumns}>
            Corriger les colonnes
          </Button>
          <Button variant="ghost" onClick={onChangeAccount}>
            Changer de compte
          </Button>
        </div>
      }
    >
      <p className="mono muted import-facts">
        {plural(file.rows.length, "ligne", "lignes")} · {fileFacts(file)}
      </p>
      {changed && (
        <p className="import-notice" data-tone="info" role="status">
          <Info size={16} aria-hidden />
          Les données ont changé, aperçu recalculé
        </p>
      )}
      {preview.errors.length > 0 && <Errors errors={preview.errors} />}
      {preview.checkpoints.length > 0 && (
        <div className="checkpoints">
          {preview.checkpoints.map((c) => (
            <CheckpointTile
              key={c.account}
              checkpoint={c}
              name={name(c.account)}
              decision={decisionOf(c)}
              onDecision={(d) =>
                setDecisions((all) => ({ ...all, [c.account]: d }))
              }
            />
          ))}
        </div>
      )}
      <div className="preview-toolbar">
        <Segmented
          label="Lignes affichées"
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(0);
          }}
          options={[
            {
              value: "new",
              label: plural(counts.new, "nouvelle", "nouvelles"),
            },
            {
              value: "duplicate",
              label: plural(
                counts.duplicate,
                "déjà présente",
                "déjà présentes",
              ),
            },
            {
              value: "invalid",
              label: plural(counts.invalid, "erreur", "erreurs"),
            },
          ]}
        />
        {tab === "new" && newRows.length > 0 && (
          <label className="preview-all">
            <input
              type="checkbox"
              checked={selected.size === newRows.length}
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    selected.size > 0 && selected.size < newRows.length;
              }}
              onChange={(e) =>
                setExcluded(
                  e.target.checked
                    ? new Set()
                    : new Set(newRows.map((r) => r.index)),
                )
              }
            />
            <span className="mono">
              {selected.size} / {newRows.length} sélectionnées
            </span>
          </label>
        )}
      </div>
      {shown.length === 0 ? (
        <p className="ui-empty">Aucune ligne</p>
      ) : (
        <ul className="preview-rows" aria-label="Lignes du fichier">
          {visible.map((row) => (
            <Row
              key={row.index}
              row={row}
              raw={file.rows[row.index - file.firstDataRow]}
              account={row.tx ? name(row.tx.account) : ""}
              match={matchOf(row.existingId)}
              checked={selected.has(row.index)}
              onToggle={(on) => toggle(row.index, on)}
            />
          ))}
        </ul>
      )}
      {pages > 1 && (
        <Pager
          page={current}
          pages={pages}
          total={shown.length}
          onPage={setPage}
        />
      )}
      <div className="import-footer">
        <Button variant="ghost" onClick={onAbandon}>
          Abandonner
        </Button>
        {failure && (
          <p className="import-missing" role="alert">
            {failure}
          </p>
        )}
        <Button
          variant="accent"
          size="m"
          loading={busy}
          disabledReason={blocked}
          onClick={commit}
        >
          {cta}
        </Button>
      </div>
    </CardShell>
  );
}

function Errors({ errors }: { errors: string[] }) {
  return (
    <div className="import-block" data-tone="error" role="alert">
      <p className="import-block-title">
        <TriangleAlert size={16} aria-hidden /> Import impossible
      </p>
      <ul>
        {errors.slice(0, 6).map((e) => (
          <li key={e}>{e}</li>
        ))}
        {errors.length > 6 && (
          <li>+ {plural(errors.length - 6, "autre", "autres")}</li>
        )}
      </ul>
    </div>
  );
}

function CheckpointTile({
  checkpoint: c,
  name,
  decision,
  onDecision,
}: {
  checkpoint: PreviewCheckpoint;
  name: string;
  decision: CheckpointDecision;
  onDecision(d: CheckpointDecision): void;
}) {
  const derived = c.status === "derived";
  return (
    <section className="checkpoint" aria-label={`Solde de ${name}`}>
      <div className="checkpoint-text">
        <p className="eyebrow">
          {derived ? "Solde reconstruit" : "Solde observé"} · {name}
        </p>
        <p className="checkpoint-amount">
          <Money value={c.amount} size="s" tone="none" cents="always" />
          <span className="mono muted">au {formatDay(c.date)}</span>
        </p>
        <p className="mono muted">
          {c.delta === undefined ? (
            "aucun solde calculé à comparer"
          ) : c.delta === 0 ? (
            "identique au solde calculé"
          ) : (
            <>
              écart{" "}
              <Money value={c.delta} size="inherit" signed cents="always" /> vs
              calculé
            </>
          )}
          {c.coverageFrom &&
            c.coverageThrough &&
            ` · relevé ${formatDay(c.coverageFrom)} → ${formatDay(c.coverageThrough)}`}
        </p>
      </div>
      <Segmented
        size="compact"
        label={`Solde de ${name}`}
        value={decision}
        onChange={onDecision}
        options={[
          derived
            ? { value: "derived", label: "Utiliser" }
            : { value: "accept", label: "Enregistrer" },
          { value: "keep", label: "Ignorer" },
        ]}
      />
    </section>
  );
}

const badges = {
  new: { tone: "new", label: "Nouvelle" },
  duplicate: { tone: "duplicate", label: "Déjà présente" },
  invalid: { tone: "error", label: "Erreur" },
} as const;

function Row({
  row,
  raw,
  account,
  match,
  checked,
  onToggle,
}: {
  row: PreviewRow;
  raw: Record<string, string> | undefined;
  account: string;
  match: { date: string; label: string; source?: string } | undefined;
  checked: boolean;
  onToggle(on: boolean): void;
}) {
  const { tx } = row;
  const badge = badges[row.status];
  return (
    <li className="preview-row" data-status={row.status}>
      {row.status === "new" && tx ? (
        <label className="preview-check">
          <input
            type="checkbox"
            checked={checked}
            aria-label={`Importer ligne ${row.index} : ${tx.label}`}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </label>
      ) : (
        <span className="preview-check" />
      )}
      <span className="mono muted preview-line">L.{row.index}</span>
      <span className="mono preview-date">{tx ? formatDay(tx.date) : "—"}</span>
      <span className="preview-main">
        {tx ? (
          <>
            <span className="preview-label">{tx.label}</span>
            <span className="mono muted preview-meta">
              {account} · {tx.category}
              {match &&
                ` · existante : ${formatDay(match.date)} · ${match.label}${match.source ? ` (${match.source})` : ""}`}
            </span>
          </>
        ) : (
          <>
            <span className="preview-label preview-reason">{row.reason}</span>
            <span className="mono muted preview-meta">
              {raw ? Object.values(raw).join(" ; ") : ""}
            </span>
          </>
        )}
      </span>
      <span className="preview-amount">
        {tx && <Money value={tx.amount} size="text" signed cents="always" />}
      </span>
      <span className="preview-badge">
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </span>
    </li>
  );
}

function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage(page: number): void;
}) {
  const from = page * PAGE + 1;
  const to = Math.min(total, (page + 1) * PAGE);
  return (
    <nav className="preview-pager" aria-label="Pages de l'aperçu">
      <IconButton
        label="Page précédente"
        icon={<ChevronLeft />}
        variant="outline"
        disabledReason={page === 0 ? "Première page" : undefined}
        onClick={() => onPage(page - 1)}
      />
      <span className="mono tabular">
        {from}–{to} sur {total}
      </span>
      <IconButton
        label="Page suivante"
        icon={<ChevronRight />}
        variant="outline"
        disabledReason={page === pages - 1 ? "Dernière page" : undefined}
        onClick={() => onPage(page + 1)}
      />
    </nav>
  );
}
