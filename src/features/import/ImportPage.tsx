import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PageProps } from "../../app/App";
import { navigate } from "../../app/router";
import { useToast } from "../../app/toast";
import { undoImport } from "../../data/importer/commit";
import {
  analyzeFile,
  type AccountChoice,
  type Mapping,
} from "../../data/importer/mapping";
import type { ParsedFile } from "../../data/importer/parse";
import { fileProblem, startImport } from "../../data/importer/start";
import type { Batch } from "../../domain/types";
import { AccountDialog } from "./AccountDialog";
import { BackupMenu, downloadDemoCsv } from "./BackupMenu";
import { BatchHistory } from "./BatchHistory";
import { Dropzone, type DropNotice, type ZoneState } from "./Dropzone";
import { initialChoice } from "./flow";
import { fileFacts, namesLabel, plural } from "./labels";
import { MappingStep } from "./MappingStep";
import { PreviewStep, type Outcome } from "./PreviewStep";
import { ResultStep } from "./ResultStep";
import { Stepper } from "./Stepper";
import "./import.css";

type Draft = { file: ParsedFile; mapping: Mapping };
type Phase =
  | { step: "idle"; notice?: DropNotice }
  | { step: "reading"; name: string; progress: number }
  /** `choice` is set when the user came back from the preview. */
  | (Draft & { step: "mapping"; choice?: AccountChoice })
  | (Draft & { step: "account"; choice: AccountChoice; back?: AccountChoice })
  | (Draft & { step: "preview"; choice: AccountChoice })
  | { step: "done"; outcome: Outcome };

const stepIndex: Record<Phase["step"], number> = {
  idle: 0,
  reading: 0,
  mapping: 0,
  account: 1,
  preview: 2,
  done: 3,
};

const hasFiles = (event: DragEvent) =>
  Boolean(event.dataTransfer?.types.includes("Files"));

export function ImportPage({ ledger, params, active }: PageProps) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const job = useRef<{ cancel(): void } | null>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const latest = useRef(ledger);
  const preferred = useRef<string | null>(null);
  const seen = useRef(false);

  useLayoutEffect(() => {
    latest.current = ledger;
  }, [ledger]);
  const acct = params.get("acct");
  useEffect(() => {
    if (acct) preferred.current = acct;
  }, [acct]);
  useEffect(() => () => job.current?.cancel(), []);

  const focusChooser = () =>
    requestAnimationFrame(() => chooseRef.current?.focus());
  const reset = useCallback(() => setPhase({ step: "idle" }), []);

  const start = useCallback((file: File) => {
    const problem = fileProblem(file);
    if (problem)
      return setPhase({
        step: "idle",
        notice: { kind: "error", message: problem },
      });
    job.current?.cancel();
    const run = startImport(file, (progress) =>
      setPhase((p) =>
        p.step === "reading" && job.current === run ? { ...p, progress } : p,
      ),
    );
    job.current = run;
    setPhase({ step: "reading", name: file.name, progress: 0 });
    run.promise.then(
      (parsed) => {
        if (job.current !== run) return;
        job.current = null;
        const { accounts, batches } = latest.current;
        const analysis = analyzeFile(parsed, { accounts, batches });
        const draft = { file: parsed, mapping: analysis.mapping };
        if (analysis.alreadyImported)
          setPhase({
            step: "idle",
            notice: { kind: "already", batch: analysis.alreadyImported },
          });
        else if (analysis.mappingIssues.length)
          setPhase({ step: "mapping", ...draft });
        else
          setPhase({
            step: "account",
            ...draft,
            choice: initialChoice(
              parsed,
              analysis.mapping,
              accounts,
              preferred.current,
            ),
          });
      },
      (error: unknown) => {
        if (job.current !== run) return;
        job.current = null;
        if (error instanceof DOMException && error.name === "AbortError")
          setPhase({ step: "idle" });
        else
          setPhase({
            step: "idle",
            notice: {
              kind: "error",
              message: error instanceof Error ? error.message : String(error),
            },
          });
      },
    );
  }, []);

  // Files can be dropped anywhere on the page while no import is in progress.
  const accepting = phase.step === "idle" || phase.step === "done";
  useEffect(() => {
    if (!active) return;
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(accepting);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer!.dropEffect = accepting ? "copy" : "none";
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const files = event.dataTransfer!.files;
      if (!accepting || !files.length) return;
      if (files.length > 1)
        setPhase({
          step: "idle",
          notice: {
            kind: "error",
            message: "Déposez un seul fichier à la fois.",
          },
        });
      else start(files[0]);
    };
    addEventListener("dragenter", enter);
    addEventListener("dragover", over);
    addEventListener("dragleave", leave);
    addEventListener("drop", drop);
    return () => {
      removeEventListener("dragenter", enter);
      removeEventListener("dragover", over);
      removeEventListener("dragleave", leave);
      removeEventListener("drop", drop);
      setDragging(false);
    };
  }, [active, accepting, start]);

  // The result disappears once its batch is undone (toast, history, other tab).
  useEffect(() => {
    if (phase.step !== "done") return;
    const present = ledger.batches.some((b) => b.id === phase.outcome.batch.id);
    if (present) seen.current = true;
    else if (seen.current) {
      seen.current = false;
      setPhase({ step: "idle" });
    }
  }, [phase, ledger.batches]);

  function committed(outcome: Outcome) {
    seen.current = false;
    setPhase({ step: "done", outcome });
    const { batch } = outcome;
    toast.undoable(
      `${plural(batch.count, "opération importée", "opérations importées")} dans ${namesLabel(outcome.names)}`,
      async () => {
        try {
          await undoImport(batch.id);
          toast.show({ message: "Import annulé" });
        } catch (error) {
          toast.error(error);
        }
      },
    );
  }

  const showBatch = (batch: Batch) =>
    navigate("transactions", { batch: batch.id });

  const zone: ZoneState =
    phase.step === "reading"
      ? {
          kind: "reading",
          name: phase.name,
          progress: phase.progress,
          onCancel() {
            job.current?.cancel();
            focusChooser();
          },
        }
      : phase.step === "account"
        ? {
            kind: "loaded",
            name: phase.file.name,
            facts: fileFacts(phase.file),
          }
        : { kind: "idle" };
  const empty = !ledger.transactions.length && !ledger.batches.length;
  // The preview stays visible behind the account dialog reopened from it.
  const reviewed =
    phase.step === "preview"
      ? phase
      : phase.step === "account" && phase.back
        ? { ...phase, choice: phase.back }
        : null;

  let main;
  if (phase.step === "mapping")
    main = (
      <MappingStep
        key={phase.file.hash}
        file={phase.file}
        initial={phase.mapping}
        backLabel={phase.choice ? "Retour à l'aperçu" : "Abandonner"}
        onBack={() => {
          const { choice } = phase;
          setPhase(
            choice ? { ...phase, step: "preview", choice } : { step: "idle" },
          );
        }}
        onConfirm={(mapping) => {
          const fresh = initialChoice(
            phase.file,
            mapping,
            ledger.accounts,
            preferred.current,
          );
          const choice = Object.fromEntries(
            Object.keys(fresh).map((s) => [s, phase.choice?.[s] ?? fresh[s]]),
          );
          setPhase({
            step: "account",
            file: phase.file,
            mapping,
            choice,
            back: phase.choice && choice,
          });
        }}
      />
    );
  else if (reviewed)
    main = (
      <PreviewStep
        key={`${reviewed.file.hash}:${JSON.stringify([reviewed.mapping, reviewed.choice])}`}
        file={reviewed.file}
        mapping={reviewed.mapping}
        choice={reviewed.choice}
        ledger={ledger}
        onCommitted={committed}
        onFixColumns={() => setPhase({ ...reviewed, step: "mapping" })}
        onChangeAccount={() =>
          setPhase({ ...reviewed, step: "account", back: reviewed.choice })
        }
        onAbandon={() => {
          reset();
          focusChooser();
        }}
      />
    );
  else if (phase.step === "done")
    main = (
      <ResultStep
        key={phase.outcome.batch.id}
        outcome={phase.outcome}
        ledger={ledger}
        onAnother={() => {
          reset();
          focusChooser();
        }}
      />
    );
  else
    main = (
      <>
        <Dropzone
          state={zone}
          dragging={dragging}
          notice={phase.step === "idle" ? phase.notice : undefined}
          onFile={start}
          onShowBatch={showBatch}
          chooseRef={chooseRef}
        />
        {empty && phase.step === "idle" && (
          <p className="import-hint">
            Pas encore de relevé{"\u00a0?"}{" "}
            <button
              type="button"
              className="import-link"
              onClick={downloadDemoCsv}
            >
              CSV exemple
            </button>
          </p>
        )}
      </>
    );

  return (
    <div className="import" data-dragging={dragging || undefined}>
      <Stepper current={stepIndex[phase.step]} />
      <div
        className="import-layout"
        data-aside={ledger.batches.length > 0 || undefined}
      >
        <div className="import-main">
          {dragging && phase.step === "done" ? (
            <Dropzone
              state={{ kind: "idle" }}
              dragging
              onFile={start}
              onShowBatch={showBatch}
              chooseRef={chooseRef}
            />
          ) : (
            main
          )}
        </div>
        <BatchHistory
          ledger={ledger}
          onUndone={(batch) =>
            setPhase((p) =>
              p.step === "idle" &&
              p.notice?.kind === "already" &&
              p.notice.batch.id === batch.id
                ? { step: "idle" }
                : p,
            )
          }
        />
      </div>
      {phase.step === "account" && (
        <AccountDialog
          key={phase.file.hash}
          open
          file={phase.file}
          mapping={phase.mapping}
          initial={phase.choice}
          ledger={ledger}
          onCancel={() => {
            if (phase.back)
              setPhase({ ...phase, step: "preview", choice: phase.back });
            else {
              reset();
              focusChooser();
            }
          }}
          onSubmit={(choice) => setPhase({ ...phase, step: "preview", choice })}
        />
      )}
      <BackupMenu ledger={ledger} onRestored={reset} />
    </div>
  );
}
