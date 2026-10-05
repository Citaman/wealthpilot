import { Pencil } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { parseMoney } from "../domain/money";
import type { Cents } from "../domain/types";
import { Money, type MoneySize } from "./Money";
import "./Editable.css";

type Commit<T> = (next: T) => Promise<void> | void;

interface InlineEditOptions<T> {
  value: T;
  toDraft: (value: T) => string;
  parse: (
    draft: string,
  ) => { ok: true; value: T } | { ok: false; error: string };
  equals: (a: T, b: T) => boolean;
  onCommit: Commit<T>;
}

function useInlineEdit<T>({
  value,
  toDraft,
  parse,
  equals,
  onCommit,
}: InlineEditOptions<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [width, setWidth] = useState(0);
  const display = useRef<HTMLButtonElement>(null);
  const settling = useRef(false);
  const active = useRef(false);

  const start = () => {
    active.current = true;
    setWidth(display.current?.getBoundingClientRect().width ?? 0);
    setDraft(toDraft(value));
    setError(null);
    setEditing(true);
  };

  const stop = (refocus: boolean) => {
    active.current = false;
    setEditing(false);
    setError(null);
    if (refocus) requestAnimationFrame(() => display.current?.focus());
  };

  const commit = async (refocus: boolean) => {
    if (settling.current || !active.current) return;
    const parsed = parse(draft);
    if (!parsed.ok) return setError(parsed.error);
    if (equals(parsed.value, value)) return stop(refocus);
    settling.current = true;
    setPending(true);
    try {
      await onCommit(parsed.value);
      stop(refocus);
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : "Échec de l'enregistrement",
      );
    } finally {
      settling.current = false;
      setPending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      stop(true);
    }
  };

  return {
    editing,
    draft,
    setDraft,
    error,
    pending,
    width,
    display,
    start,
    commit,
    onKeyDown,
  };
}

interface EditableShellProps {
  label: string;
  edit: ReturnType<typeof useInlineEdit<unknown>>;
  size?: MoneySize;
  inputMode?: "decimal" | "text";
  placeholder?: string;
  maxLength?: number;
  className?: string;
  children: ReactNode;
}

function EditableShell({
  label,
  edit,
  size,
  inputMode,
  placeholder,
  maxLength,
  className,
  children,
}: EditableShellProps) {
  const errorId = useId();
  if (!edit.editing)
    return (
      <button
        ref={edit.display}
        type="button"
        className={["ui-editable", className].filter(Boolean).join(" ")}
        aria-label={`${label} : modifier`}
        onClick={edit.start}
      >
        {children}
        <Pencil className="ui-editable-pen" size={12} aria-hidden />
      </button>
    );
  return (
    <span
      className={["ui-editable-field", className].filter(Boolean).join(" ")}
    >
      <input
        autoFocus
        className={size ? "ui-editable-input ui-money" : "ui-editable-input"}
        data-size={size}
        data-font={
          size && size !== "text" && size !== "inherit" ? "display" : undefined
        }
        aria-label={label}
        aria-invalid={edit.error ? true : undefined}
        aria-describedby={edit.error ? errorId : undefined}
        aria-busy={edit.pending || undefined}
        readOnly={edit.pending}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        value={edit.draft}
        style={{ minWidth: Math.max(edit.width, 48) }}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => edit.setDraft(event.currentTarget.value)}
        onKeyDown={edit.onKeyDown}
        onBlur={() => void edit.commit(false)}
      />
      {edit.error && (
        <span id={errorId} className="ui-editable-error" role="alert">
          {edit.error}
        </span>
      )}
    </span>
  );
}

export interface EditableMoneyProps {
  value: Cents | null;
  onCommit: Commit<Cents | null>;
  label: string;
  size?: MoneySize;
  /** An empty field commits `null` (e.g. remove an envelope). */
  allowEmpty?: boolean;
  validate?: (value: Cents) => string | null;
  className?: string;
}

export function EditableMoney({
  value,
  onCommit,
  label,
  size = "inherit",
  allowEmpty = false,
  validate,
  className,
}: EditableMoneyProps) {
  const edit = useInlineEdit<Cents | null>({
    value,
    onCommit,
    equals: (a, b) => a === b,
    toDraft: (current) =>
      current === null
        ? ""
        : (current / 100)
            .toFixed(current % 100 === 0 ? 0 : 2)
            .replace(".", ","),
    parse: (draft) => {
      if (!draft.trim())
        return allowEmpty
          ? { ok: true, value: null }
          : { ok: false, error: "Montant requis" };
      const cents = parseMoney(draft);
      if (cents === null) return { ok: false, error: "Montant invalide" };
      const problem = validate?.(cents);
      return problem
        ? { ok: false, error: problem }
        : { ok: true, value: cents };
    },
  });
  return (
    <EditableShell
      label={label}
      edit={edit as ReturnType<typeof useInlineEdit<unknown>>}
      size={size}
      inputMode="decimal"
      className={className}
    >
      <Money value={value} size={size} tone="none" unknownReason="À saisir" />
    </EditableShell>
  );
}

export interface EditableTextProps {
  value: string;
  onCommit: Commit<string>;
  label: string;
  placeholder?: string;
  maxLength?: number;
  validate?: (value: string) => string | null;
  className?: string;
}

export function EditableText({
  value,
  onCommit,
  label,
  placeholder,
  maxLength = 80,
  validate,
  className,
}: EditableTextProps) {
  const edit = useInlineEdit<string>({
    value,
    onCommit,
    equals: (a, b) => a === b,
    toDraft: (current) => current,
    parse: (draft) => {
      const next = draft.trim();
      const problem = validate?.(next) ?? (next ? null : "Texte requis");
      return problem
        ? { ok: false, error: problem }
        : { ok: true, value: next };
    },
  });
  return (
    <EditableShell
      label={label}
      edit={edit as ReturnType<typeof useInlineEdit<unknown>>}
      inputMode="text"
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
    >
      {value || <span className="muted">{placeholder}</span>}
    </EditableShell>
  );
}
