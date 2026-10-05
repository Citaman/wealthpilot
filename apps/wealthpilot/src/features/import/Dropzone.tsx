import { FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import type { Ref } from "react";
import { formatDay } from "../../domain/dates";
import type { Batch } from "../../domain/types";
import { Button } from "../../ui/Button";
import { localDay, plural } from "./labels";

export type DropNotice =
  | { kind: "error"; message: string }
  | { kind: "already"; batch: Batch };

export type ZoneState =
  | { kind: "idle" }
  | { kind: "reading"; name: string; progress: number; onCancel(): void }
  | { kind: "loaded"; name: string; facts: string };

export function Dropzone({
  state,
  dragging,
  notice,
  onFile,
  onShowBatch,
  chooseRef,
}: {
  state: ZoneState;
  dragging: boolean;
  notice?: DropNotice;
  onFile(file: File): void;
  onShowBatch(batch: Batch): void;
  chooseRef: Ref<HTMLButtonElement>;
}) {
  const inputId = "import-file-input";
  return (
    <section
      className="dropzone"
      data-drag={dragging || undefined}
      aria-labelledby="dropzone-title"
    >
      {state.kind === "reading" ? (
        <Reading {...state} />
      ) : (
        <>
          <span className="dropzone-icon" aria-hidden>
            {state.kind === "loaded" ? <FileSpreadsheet /> : <Upload />}
          </span>
          <h2 id="dropzone-title" className="dropzone-title">
            {state.kind === "loaded" ? state.name : "Déposer un relevé CSV"}
          </h2>
          {notice && <Notice notice={notice} onShowBatch={onShowBatch} />}
          <div className="dropzone-actions">
            <Button
              ref={chooseRef}
              variant="primary"
              icon={<FileSpreadsheet aria-hidden />}
              onClick={() => document.getElementById(inputId)?.click()}
            >
              {state.kind === "loaded"
                ? "Choisir un autre fichier"
                : "Choisir un fichier"}
            </Button>
            <span className="mono muted">
              {state.kind === "loaded"
                ? state.facts
                : "CSV · 20 Mo · 50 000 lignes max"}
            </span>
          </div>
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onFile(file);
            }}
          />
        </>
      )}
    </section>
  );
}

function Reading({
  name,
  progress,
  onCancel,
}: Extract<ZoneState, { kind: "reading" }>) {
  return (
    <div className="dropzone-reading">
      <h2 id="dropzone-title" className="dropzone-title">
        {name}
      </h2>
      <div
        className="import-progress"
        role="progressbar"
        aria-label={`Lecture de ${name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="dropzone-actions">
        <span className="mono muted tabular">Analyse · {progress} %</span>
        <Button variant="outline" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

function Notice({
  notice,
  onShowBatch,
}: {
  notice: DropNotice;
  onShowBatch(batch: Batch): void;
}) {
  if (notice.kind === "error")
    return (
      <p className="import-notice" data-tone="error" role="alert">
        <TriangleAlert size={16} aria-hidden />
        {notice.message}
      </p>
    );
  const { batch } = notice;
  return (
    <p className="import-notice" data-tone="warning" role="status">
      <span>
        Déjà importé le {formatDay(localDay(batch.createdAt))} (
        {plural(batch.count, "opération", "opérations")})
      </span>
      <span aria-hidden>·</span>
      <button
        type="button"
        className="import-link"
        onClick={() => onShowBatch(batch)}
      >
        Voir le lot
      </button>
    </p>
  );
}
