import { Select } from "./Select";
import { PageActions } from "./PageActions";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  Download,
} from "lucide-react";
import { db, importReviewToken } from "./store";
import {
  decodeCSV,
  detectMapping,
  previewImport,
  sha256,
  metadataAccountId,
  automaticMappingIssues,
  fileForImportAccount,
  type ParsedFile,
  type Mapping,
  type Field as CsvField,
} from "./importer";
import type { Snapshot } from "./types";
import { euro, dateLabel } from "./domain";
import { Notice, Field, Modal } from "./ui";
import { download } from "./download";
import "./import-flow.css";
type Field = CsvField;
const fieldLabels: Record<CsvField, string> = {
  date: "Date *",
  label: "Libellé *",
  amount: "Montant signé",
  debit: "Débit",
  credit: "Crédit",
  direction: "Sens (facultatif)",
  account: "Compte",
  merchant: "Commerçant",
  category: "Catégorie",
  internal: "Virement interne",
  currency: "Devise",
};
export function ImportPage({
  snapshot,
  onImported,
  notify,
  active = true,
}: {
  snapshot: Snapshot;
  onImported: (month: string) => void;
  notify: (s: string) => void;
  active?: boolean;
}) {
  const [file, setFile] = useState<ParsedFile | null>(null),
    [name, setName] = useState(""),
    [hash, setHash] = useState(""),
    [mapping, setMapping] = useState<Mapping>(detectMapping([])),
    [account, setAccount] = useState("Compte courant"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<number | null>(null),
    [step, setStep] = useState(1),
    [included, setIncluded] = useState<Set<number>>(new Set()),
    [reviewed, setReviewed] = useState(false),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [undo, setUndo] = useState<string | null>(null);
  const [undoError, setUndoError] = useState("");
  const [mappingOpen, setMappingOpen] = useState(false),
    [accountDialog, setAccountDialog] = useState(false),
    [accountChoice, setAccountChoice] = useState<"existing" | "new" | "file">(
      "new",
    ),
    [existingAccount, setExistingAccount] = useState(""),
    [accountSearch, setAccountSearch] = useState(""),
    [newAccount, setNewAccount] = useState(""),
    [keepFileAccounts, setKeepFileAccounts] = useState(true),
    [accountError, setAccountError] = useState("");
  const worker = useRef<Worker | null>(null),
    generation = useRef(0),
    input = useRef<HTMLInputElement>(null);
  const reviewStart = useRef<HTMLElement>(null);
  const reviewedCount = useRef(0);
  const reviewedState = useRef("");
  const [checkpointDecisions, setCheckpointDecisions] = useState<
    Record<string, "accept" | "keep" | "derived">
  >({});
  const importFile = useMemo(
    () => (file ? fileForImportAccount(file, account, keepFileAccounts) : null),
    [file, account, keepFileAccounts],
  );
  const importMapping = useMemo(
    () => (keepFileAccounts ? mapping : { ...mapping, account: "" }),
    [mapping, keepFileAccounts],
  );
  const checkpoints = importFile?.metadata?.accounts ?? [];
  const fileAccounts = useMemo(
    () =>
      file && mapping.account
        ? [
            ...new Set(
              file.rows
                .map((row) => row[mapping.account]?.trim())
                .filter(Boolean),
            ),
          ]
        : [],
    [file, mapping.account],
  );
  const bankId =
    file?.metadata?.profile === "sg"
      ? file.metadata.accounts[0]?.bankAccountId
      : undefined;
  const identifiedAccount = bankId
    ? snapshot.accounts.find((a) => a.bankAccountId === bankId)
    : undefined;
  const multiAccount =
    fileAccounts.length > 1 || (file?.metadata?.accounts.length ?? 0) > 1;
  const mappingReady =
    !!mapping.date &&
    !!(mapping.label || mapping.merchant) &&
    !!(mapping.amount || mapping.debit || mapping.credit) &&
    !(mapping.amount && (mapping.debit || mapping.credit)) &&
    !file?.errors.length;
  const checkpointsReady = checkpoints.every(
    (entry) =>
      !entry.checkpoints.length ||
      checkpointDecisions[metadataAccountId(entry, account, snapshot.accounts)],
  );
  useEffect(
    () => () => {
      generation.current++;
      worker.current?.terminate();
    },
    [],
  );
  const candidates = useMemo(
    () =>
      importFile
        ? previewImport(
            importFile,
            importMapping,
            account,
            snapshot.transactions,
          )
        : [],
    [importFile, importMapping, account, snapshot.transactions],
  );
  const duplicates = candidates.filter((c) => c.duplicate).length,
    invalid = candidates.filter((c) => c.error).length;
  const selected = candidates.filter(
    (c) => c.transaction && included.has(c.row),
  );
  const sameFile = snapshot.batches.some((b) => b.hash === hash);
  const visible = candidates.filter(
    (c) =>
      filter === "all" ||
      (filter === "errors"
        ? c.error
        : filter === "duplicates"
          ? c.duplicate
          : !c.error && !c.duplicate),
  );
  const resetReview = () => {
    setStep(2);
    setReviewed(false);
    setPage(0);
    setCheckpointDecisions({});
  };
  async function readFile(f: File) {
    const token = ++generation.current;
    worker.current?.terminate();
    setBusy(true);
    setProgress(0);
    setError("");
    setFile(null);
    setAccountDialog(false);
    setKeepFileAccounts(true);
    setFilter("all");
    setStep(1);
    try {
      if (f.size > 20 * 1024 * 1024)
        throw new Error("Fichier trop volumineux : limite de 20 Mo.");
      if (!/\.csv$/i.test(f.name))
        throw new Error("Choisissez un fichier .csv.");
      const data = await f.arrayBuffer(),
        digest = await sha256(data);
      setProgress(10);
      if (token !== generation.current) return;
      const w = new Worker(new URL("./import.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      w.onmessage = (e) => {
        if (token !== generation.current) return;
        if (typeof e.data.progress === "number") {
          setProgress(10 + Math.floor(e.data.progress * 0.9));
          return;
        }
        w.terminate();
        setBusy(false);
        setProgress(null);
        if (!e.data.ok) {
          setError(e.data.error);
          return;
        }
        const parsed = e.data.file as ParsedFile;
        setFile(parsed);
        const nextMapping = detectMapping(parsed.fields);
        const sourceAccounts = nextMapping.account
          ? [
              ...new Set(
                parsed.rows
                  .map((row) => row[nextMapping.account]?.trim())
                  .filter(Boolean),
              ),
            ]
          : [];
        const bank =
          parsed.metadata?.profile === "sg"
            ? parsed.metadata.accounts[0]?.bankAccountId
            : undefined;
        const identified = bank
          ? snapshot.accounts.find((a) => a.bankAccountId === bank)
          : undefined;
        setExistingAccount(identified?.id ?? snapshot.accounts[0]?.id ?? "");
        setNewAccount(sourceAccounts.length === 1 ? sourceAccounts[0] : "");
        setAccountChoice(
          identified
            ? "existing"
            : sourceAccounts.length
              ? "file"
              : snapshot.accounts.length
                ? "existing"
                : "new",
        );
        setAccountError("");
        setAccountSearch("");
        setMapping(nextMapping);
        const manual =
          automaticMappingIssues(parsed).length > 0 || parsed.errors.length > 0;
        setMappingOpen(manual);
        setAccountDialog(!manual);
        setName(f.name);
        setHash(digest);
        setStep(2);
        setReviewed(false);
        setPage(0);
        setIncluded(new Set());
        setCheckpointDecisions({});
      };
      w.onerror = () => {
        if (token === generation.current) {
          setError("Lecture impossible. Réessayez avec un CSV UTF-8.");
          setBusy(false);
          setProgress(null);
        }
        w.terminate();
      };
      w.postMessage(decodeCSV(data));
    } catch (e) {
      if (token === generation.current) {
        setError((e as Error).message);
        setBusy(false);
        setProgress(null);
      }
    }
  }
  function review(
    nextFile = importFile,
    nextMapping = importMapping,
    nextAccount = account,
  ) {
    if (!nextFile) return;
    const nextCandidates = previewImport(
      nextFile,
      nextMapping,
      nextAccount,
      snapshot.transactions,
    );
    reviewedCount.current = snapshot.transactions.length;
    reviewedState.current = importReviewToken(
      snapshot.transactions,
      snapshot.accounts,
    );
    setIncluded(
      new Set(
        nextCandidates
          .filter((c) => c.transaction && !c.duplicate)
          .map((c) => c.row),
      ),
    );
    setReviewed(!nextCandidates.some((c) => c.duplicate || c.error));
    setStep(3);
    setPage(0);
  }
  function chooseAccount() {
    if (!file) return;
    setAccountError("");
    const useSource = accountChoice === "file" && !identifiedAccount;
    const chosen =
      identifiedAccount?.id ??
      (accountChoice === "new" ? newAccount.trim() : existingAccount);
    if (!useSource && (!chosen || chosen.length > 100)) {
      setAccountError("Donnez un nom de compte entre 1 et 100 caractères.");
      return;
    }
    if (
      accountChoice === "new" &&
      snapshot.accounts.some(
        (a) => a.id.toLocaleLowerCase() === chosen.toLocaleLowerCase(),
      )
    ) {
      setAccountError(
        "Ce compte existe déjà : choisissez-le dans les comptes existants.",
      );
      return;
    }
    if (
      !useSource &&
      !identifiedAccount &&
      accountChoice === "existing" &&
      !snapshot.accounts.some((a) => a.id === chosen)
    ) {
      setAccountError(
        "Ce compte n’est plus disponible. Choisissez un compte existant ou créez-en un.",
      );
      return;
    }
    if (
      bankId &&
      snapshot.accounts.some(
        (a) => a.id === chosen && a.bankAccountId && a.bankAccountId !== bankId,
      )
    ) {
      setAccountError(
        "Ce compte est lié à un autre identifiant bancaire. Choisissez un autre compte.",
      );
      return;
    }
    if (multiAccount && !useSource) {
      setAccountError(
        "Conservez les comptes distincts de ce fichier pour ne pas mélanger leurs opérations.",
      );
      return;
    }
    if (
      useSource &&
      (!mapping.account ||
        file.rows.some((row) => !row[mapping.account]?.trim()))
    ) {
      setAccountError(
        "Certaines lignes n’ont pas de compte. Corrigez le fichier ou choisissez un compte unique si ce relevé n’en contient qu’un.",
      );
      return;
    }
    const destination = useSource ? "" : chosen;
    const nextMapping = useSource ? mapping : { ...mapping, account: "" };
    const nextFile = fileForImportAccount(file, destination, useSource);
    setAccount(destination);
    setKeepFileAccounts(useSource);
    setCheckpointDecisions({});
    setAccountDialog(false);
    setMappingOpen(false);
    review(nextFile, nextMapping, destination);
    requestAnimationFrame(() => {
      const section = reviewStart.current;
      if (!section || section.closest("[hidden]")) return;
      section.focus({ preventScroll: true });
      section.scrollIntoView({ block: "start", behavior: "auto" });
    });
  }
  async function commit() {
    if (
      busy ||
      !reviewed ||
      sameFile ||
      !checkpointsReady ||
      (!selected.length && !checkpoints.length)
    )
      return;
    setBusy(true);
    setError("");
    try {
      const batch = await db.importBatch(
        name,
        hash,
        candidates,
        included,
        reviewedCount.current,
        {
          metadata: importFile?.metadata,
          fallbackAccount: account,
          checkpointDecisions,
          reviewedState: reviewedState.current,
        },
      );
      setFile(null);
      setStep(1);
      notify(batch.count + " opérations importées.");
      onImported(batch.maxDate.slice(0, 7));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page import-page">
      <h1 className="sr-only">Import CSV</h1>
      <PageActions page="import">
        <button
          className="dock-action"
          onClick={() =>
            download(
              "exemple-wealthpilot.csv",
              "date;account;amount;merchant;libelle;category;is_internal;currency\n2026-10-01;Compte courant;2400.00;Salaire;Salaire octobre;Revenus;N;EUR\n2026-10-02;Compte courant;-45.20;Épicerie;Achats alimentaires;Courses;N;EUR\n",
              "text/csv;charset=utf-8",
            )
          }
        >
          <Download size={16} />
          <span>CSV exemple</span>
        </button>
      </PageActions>
      <div className="steps" aria-label="Étapes d’import">
        {["Fichier", "Compte", "Vérification"].map((label, i) => (
          <div
            className={step === i + 1 ? "active" : step > i + 1 ? "done" : ""}
            key={label}
          >
            <span>{step > i + 1 ? <Check size={16} /> : i + 1}</span>
            {label}
          </div>
        ))}
      </div>
      {error && <Notice error>{error}</Notice>}
      <section
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f && !busy) void readFile(f);
        }}
      >
        <div className="upload-icon">
          <Upload size={30} />
        </div>
        <h2>
          {busy
            ? "Traitement du fichier…"
            : file
              ? name
              : "Votre CSV, et c’est parti."}
        </h2>
        <p>Glissez votre relevé ici. Le fichier reste sur cet appareil.</p>
        {progress !== null && (
          <div className="import-progress" role="status">
            <progress max="100" value={progress} />
            <span>
              {progress} % · Lecture des lignes et détection des colonnes
            </span>
          </div>
        )}
        <input
          ref={input}
          className="sr-only"
          aria-label="Fichier CSV"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
            e.target.value = "";
          }}
        />
        <button
          className="button dark"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <FileSpreadsheet size={18} />
          {file ? "Choisir un autre CSV" : "Choisir un CSV"}
        </button>
        <small>
          CSV · UTF-8 ou Windows-1252 · 20 Mo maximum · 50 000 lignes
        </small>
      </section>
      {file && (
        <>
          <section className="card import-detection">
            <div className="card-heading">
              <div>
                <span className="eyebrow">
                  {file.metadata?.profile === "sg"
                    ? "RELEVÉ SOCIÉTÉ GÉNÉRALE"
                    : "LECTURE DU CSV"}
                </span>
                <h2>
                  {mappingOpen ? "Vérifier les colonnes" : "Colonnes détectées"}
                </h2>
              </div>
              <span className="badge">{file.rows.length} lignes</span>
            </div>
            {file.errors.map((e, i) => (
              <Notice error key={i}>
                {e}
              </Notice>
            ))}
            {!mappingOpen && (
              <div className="import-detection-summary">
                <p>
                  <b>Date</b> {mapping.date} <span>·</span> <b>Montant</b>{" "}
                  {mapping.amount ||
                    [mapping.debit, mapping.credit]
                      .filter(Boolean)
                      .join(" / ")}{" "}
                  <span>·</span> <b>Libellé</b>{" "}
                  {mapping.label || mapping.merchant}
                </p>
                {step >= 3 && (
                  <p>
                    <b>Destination</b>{" "}
                    {keepFileAccounts ? fileAccounts.join(", ") : account}
                  </p>
                )}
              </div>
            )}
            {mappingOpen && (
              <>
                <p className="muted">
                  Confirmez les colonnes ci-dessous. Dates françaises ou ISO ;
                  montant signé, ou débit / crédit. Aucune donnée n’est
                  enregistrée à cette étape.
                </p>
                {automaticMappingIssues(file).map((issue) => (
                  <p className="import-mapping-issue" key={issue}>
                    {issue}
                  </p>
                ))}
                <div className="mapping-grid">
                  {(Object.keys(fieldLabels) as Field[]).map((k) => (
                    <Field label={fieldLabels[k]} key={k}>
                      <Select
                        aria-label={fieldLabels[k]}
                        value={mapping[k]}
                        onChange={(e) => {
                          setMapping({ ...mapping, [k]: e.target.value });
                          resetReview();
                        }}
                      >
                        <option value="">Non utilisée</option>
                        {file.fields.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>
              </>
            )}
            <div className="actions">
              {!mappingOpen && (
                <button className="button" onClick={() => setMappingOpen(true)}>
                  Corriger les colonnes
                </button>
              )}
              <button
                className={step >= 3 && !mappingOpen ? "button" : "button dark"}
                disabled={busy || !mappingReady}
                onClick={() => {
                  setAccountError("");
                  setAccountDialog(true);
                }}
              >
                {mappingOpen
                  ? "Confirmer les colonnes et choisir le compte"
                  : step >= 3
                    ? "Changer le compte"
                    : "Choisir le compte"}
                <ArrowRight size={17} />
              </button>
            </div>
          </section>
          {step >= 3 && (
            <>
              {!!checkpoints.length && (
                <section
                  className="card"
                  ref={reviewStart}
                  tabIndex={-1}
                  aria-label="Confirmer les soldes du relevé"
                >
                  <h2>Soldes et couverture à confirmer</h2>
                  {importFile?.metadata?.warnings.map((w) => (
                    <Notice key={w}>{w}</Notice>
                  ))}
                  {checkpoints.map((entry, i) => {
                    const id = metadataAccountId(
                        entry,
                        account,
                        snapshot.accounts,
                      ),
                      latest = entry.checkpoints.toSorted((a, b) =>
                        b.date.localeCompare(a.date),
                      )[0],
                      previous = snapshot.accounts.find(
                        (a) => a.id === id,
                      )?.checkpoint;
                    const derived = entry.checkpoints.some(
                      (c) => c.status === "derived",
                    );
                    return (
                      <div className="import-checkpoint" key={id + i}>
                        <h3>{id || "Choisissez le compte"}</h3>
                        {entry.coverageFrom && (
                          <p>
                            Relevé : {dateLabel(entry.coverageFrom)} —{" "}
                            {dateLabel(entry.coverageThrough!)}
                          </p>
                        )}
                        {latest && (
                          <p>
                            {derived
                              ? "Solde reconstruit, non observé"
                              : "Solde bancaire observé"}{" "}
                            : <b>{euro(latest.amount)}</b> au{" "}
                            {dateLabel(latest.date)}.{" "}
                            {previous &&
                              `Actuellement : ${euro(previous.amount)} au ${dateLabel(previous.date)}.`}
                          </p>
                        )}
                        <Field label={`Décision pour le solde ${id}`}>
                          <Select
                            value={checkpointDecisions[id] ?? ""}
                            onChange={(e) =>
                              setCheckpointDecisions({
                                ...checkpointDecisions,
                                [id]: e.target.value as
                                  | "accept"
                                  | "keep"
                                  | "derived",
                              })
                            }
                          >
                            <option value="">Choisir explicitement</option>
                            <option value={derived ? "derived" : "accept"}>
                              {derived
                                ? "Utiliser comme ancrage reconstruit (à vérifier)"
                                : "Accepter cette observation bancaire"}
                            </option>
                            <option value="keep">
                              Conserver mon ancrage actuel
                            </option>
                          </Select>
                        </Field>
                      </div>
                    );
                  })}
                </section>
              )}
              <div className="import-stats">
                <div>
                  <span>Lignes lues</span>
                  <strong>{candidates.length}</strong>
                </div>
                <div>
                  <span>Sélectionnées</span>
                  <strong>{selected.length}</strong>
                </div>
                <div>
                  <span>Déjà présentes à vérifier</span>
                  <strong>{duplicates}</strong>
                </div>
                <div>
                  <span>Lignes invalides</span>
                  <strong>{invalid}</strong>
                </div>
              </div>
              {sameFile && (
                <Notice>
                  Ce fichier exact figure déjà dans les imports. Il ne sera pas
                  ajouté une seconde fois.
                </Notice>
              )}
              <section
                className="card"
                ref={checkpoints.length ? undefined : reviewStart}
                tabIndex={-1}
                aria-label="Vérifier les opérations du relevé"
              >
                <div className="card-heading">
                  <h2>Aperçu des opérations</h2>
                  <Select
                    aria-label="Filtrer les lignes importées"
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="all">Toutes les lignes</option>
                    <option value="new">Nouvelles</option>
                    <option value="duplicates">Déjà présentes</option>
                    <option value="errors">Invalides</option>
                  </Select>
                </div>
                <p
                  className="table-scroll-hint"
                  id="import-preview-scroll-help"
                >
                  Faites défiler horizontalement pour voir toutes les colonnes
                  et les contrôles.
                </p>
                <div
                  className="scroll-table"
                  role="region"
                  aria-label="Aperçu des opérations à importer"
                  aria-describedby="import-preview-scroll-help"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Importer</th>
                        <th>Date</th>
                        <th>Commerçant / libellé</th>
                        <th>Compte</th>
                        <th>Montant</th>
                        <th>Contrôle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.slice(page * 20, page * 20 + 20).map((c) => (
                        <tr key={c.row}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={"Importer ligne " + c.row}
                              checked={included.has(c.row)}
                              disabled={!!c.error || sameFile}
                              onChange={(e) =>
                                setIncluded((prev) => {
                                  const n = new Set(prev);
                                  e.target.checked
                                    ? n.add(c.row)
                                    : n.delete(c.row);
                                  return n;
                                })
                              }
                            />
                          </td>
                          <td>
                            {c.transaction
                              ? dateLabel(c.transaction.date)
                              : "Ligne " + c.row}
                          </td>
                          <td className="text-cell">
                            {c.transaction?.merchant ?? c.error}
                          </td>
                          <td>{c.transaction?.account}</td>
                          <td className="amount">
                            {c.transaction ? euro(c.transaction.amount) : "—"}
                          </td>
                          <td>
                            <span
                              className={
                                "badge " +
                                (c.error
                                  ? "red"
                                  : c.duplicate
                                    ? "pink"
                                    : "cyan")
                              }
                            >
                              {c.error
                                ? "À corriger"
                                : c.duplicate
                                  ? "Similaire existante"
                                  : "Nouvelle"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pagination">
                  <span>
                    {visible.length} lignes · page {page + 1} /{" "}
                    {Math.max(1, Math.ceil(visible.length / 20))}
                  </span>
                  <button
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Précédent
                  </button>
                  <button
                    disabled={(page + 1) * 20 >= visible.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Suivant
                  </button>
                </div>
              </section>
              <section className="card import-summary">
                <div>
                  <span className="eyebrow">AVANT D’ENREGISTRER</span>
                  <h2>{selected.length} opérations sélectionnées</h2>
                  <p>
                    Les lignes invalides sont exclues. Les ressemblances sont
                    décochées ; cochez-les si ce sont des opérations distinctes.
                  </p>
                  {!!(duplicates || invalid) && (
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={reviewed}
                        onChange={(e) => setReviewed(e.target.checked)}
                      />
                      J’ai vérifié les doublons possibles et les lignes exclues.
                    </label>
                  )}
                </div>
                <button
                  className="button yellow"
                  disabled={
                    busy ||
                    !reviewed ||
                    (!selected.length && !checkpoints.length) ||
                    !checkpointsReady ||
                    sameFile ||
                    !!file.errors.length
                  }
                  onClick={() => void commit()}
                >
                  {busy
                    ? "Enregistrement…"
                    : "Importer " + selected.length + " opérations"}
                  <ArrowRight size={18} />
                </button>
              </section>
            </>
          )}
        </>
      )}
      <section className="card">
        <div className="card-heading">
          <h2>Historique des imports</h2>
          <span className="badge">{snapshot.batches.length} lots</span>
        </div>
        {!snapshot.batches.length ? (
          <p className="muted">
            Aucun import pour l’instant. Vos données ne sont jamais remplacées
            par un nouveau CSV.
          </p>
        ) : (
          <div>
            <p className="table-scroll-hint" id="import-history-scroll-help">
              Faites défiler horizontalement pour voir toutes les colonnes et
              les actions.
            </p>
            <div
              className="scroll-table"
              role="region"
              aria-label="Historique des lots importés"
              aria-describedby="import-history-scroll-help"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Fichier</th>
                    <th>Période</th>
                    <th>Opérations</th>
                    <th>Importé le</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...snapshot.batches]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .map((b) => (
                      <tr key={b.id}>
                        <td className="text-cell">{b.name}</td>
                        <td>
                          {dateLabel(b.minDate)} → {dateLabel(b.maxDate)}
                        </td>
                        <td>{b.count}</td>
                        <td>{dateLabel(b.createdAt.slice(0, 10))}</td>
                        <td>
                          <button
                            onClick={() => {
                              setUndoError("");
                              setUndo(b.id);
                            }}
                          >
                            Annuler ce lot
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      {active && accountDialog && file && (
        <Modal
          title="Sur quel compte importer ?"
          onClose={() => setAccountDialog(false)}
        >
          <div className="import-account-dialog">
            <p className="muted">
              {name} · {file.rows.length} opérations. Le compte ne sera créé
              qu’après validation de l’import.
            </p>
            {accountError && <Notice error>{accountError}</Notice>}
            {identifiedAccount ? (
              <div className="import-account-identified">
                <Check size={20} />
                <div>
                  <strong>{identifiedAccount.id}</strong>
                  <p>
                    Compte reconnu par son identifiant bancaire. Les opérations
                    et le solde restent rattachés à ce compte.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <fieldset className="import-account-options">
                  <legend className="sr-only">
                    Destination des opérations
                  </legend>
                  {fileAccounts.length > 0 && (
                    <label>
                      <input
                        type="radio"
                        name="import-account-mode"
                        checked={accountChoice === "file"}
                        onChange={() => setAccountChoice("file")}
                      />
                      <span>
                        <strong>Conserver les comptes du CSV</strong>
                        <small>
                          {fileAccounts.slice(0, 4).join(", ")}
                          {fileAccounts.length > 4
                            ? ` et ${fileAccounts.length - 4} autres`
                            : ""}
                        </small>
                      </span>
                    </label>
                  )}
                  {!multiAccount && snapshot.accounts.length > 0 && (
                    <label>
                      <input
                        type="radio"
                        name="import-account-mode"
                        checked={accountChoice === "existing"}
                        onChange={() => setAccountChoice("existing")}
                      />
                      <span>
                        <strong>Un compte existant</strong>
                        <small>Ajouter ce relevé à un compte du foyer</small>
                      </span>
                    </label>
                  )}
                  {!multiAccount && (
                    <label>
                      <input
                        type="radio"
                        name="import-account-mode"
                        checked={accountChoice === "new"}
                        onChange={() => setAccountChoice("new")}
                      />
                      <span>
                        <strong>Un nouveau compte</strong>
                        <small>
                          Créer une nouvelle destination pour ce relevé
                        </small>
                      </span>
                    </label>
                  )}
                </fieldset>
                {accountChoice === "existing" && !multiAccount && (
                  <fieldset className="import-existing-accounts">
                    <legend>Compte de destination</legend>
                    {snapshot.accounts.length > 6 && (
                      <input
                        type="search"
                        aria-label="Rechercher un compte"
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        placeholder="Nom du compte"
                      />
                    )}
                    <div className="import-account-list">
                      {snapshot.accounts
                        .filter((a) =>
                          a.id
                            .toLocaleLowerCase()
                            .includes(accountSearch.toLocaleLowerCase()),
                        )
                        .map((a) => (
                          <label key={a.id}>
                            <input
                              type="radio"
                              name="import-existing-account"
                              checked={existingAccount === a.id}
                              onChange={() => setExistingAccount(a.id)}
                              disabled={
                                !!bankId &&
                                !!a.bankAccountId &&
                                a.bankAccountId !== bankId
                              }
                            />
                            <span>
                              {a.id}
                              {!!bankId &&
                                !!a.bankAccountId &&
                                a.bankAccountId !== bankId && (
                                  <small>Autre identifiant bancaire</small>
                                )}
                            </span>
                          </label>
                        ))}
                    </div>
                    {accountSearch &&
                      !snapshot.accounts.some((a) =>
                        a.id
                          .toLocaleLowerCase()
                          .includes(accountSearch.toLocaleLowerCase()),
                      ) && <p>Aucun compte correspondant.</p>}
                  </fieldset>
                )}
                {accountChoice === "new" && !multiAccount && (
                  <Field label="Nom du nouveau compte">
                    <input
                      value={newAccount}
                      maxLength={100}
                      placeholder="Ex. Compte commun"
                      onChange={(e) => setNewAccount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          chooseAccount();
                        }
                      }}
                    />
                  </Field>
                )}
                {multiAccount && (
                  <p className="muted">
                    Ce fichier contient plusieurs comptes. Leurs affectations
                    sont conservées pour ne pas mélanger les opérations et les
                    soldes.
                  </p>
                )}
              </>
            )}
            <div className="actions">
              <button
                className="button"
                onClick={() => setAccountDialog(false)}
              >
                Revenir au fichier
              </button>
              <button className="button dark" onClick={chooseAccount}>
                Voir les opérations <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {active && undo && (
        <Modal
          title="Annuler cet import ?"
          onClose={() => {
            if (!busy) setUndo(null);
          }}
        >
          {undoError && <Notice error>{undoError}</Notice>}
          <p>
            Les opérations de ce lot seront retirées, y compris leurs
            corrections. Les échéances rapprochées de ces opérations
            redeviendront à vérifier. Les soldes observés, budgets et autres
            lots restent conservés.
          </p>
          <Notice>
            Exportez une sauvegarde depuis « Sauvegardes » avant cette action si
            vous souhaitez conserver ces corrections.
          </Notice>
          <div className="actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => setUndo(null)}
            >
              Conserver le lot
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setUndoError("");
                try {
                  await db.undoBatch(undo);
                  setUndo(null);
                  notify("Lot annulé. Les autres imports sont conservés.");
                } catch (e) {
                  setUndoError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmer l’annulation
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
