import { Ellipsis } from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { navigate } from "../../app/router";
import { useToast } from "../../app/toast";
import {
  adjustOccurrence,
  confirmRecurrence,
  deleteDue,
  dismissRecurrence,
  ignoreOccurrence,
  type Undo,
} from "../../data/commands";
import type { Occurrence } from "../../domain/events";
import type { Ledger } from "../../domain/ledger";
import { activeRecurrences } from "../../domain/recurring";
import type { Due } from "../../domain/types";
import { EditableMoney } from "../../ui/Editable";
import { IconButton } from "../../ui/IconButton";
import { Menu, type MenuEntry } from "../../ui/Menu";
import "./OccurrenceMenu.css";

export interface OccurrenceMenuProps {
  ledger: Ledger;
  occurrence: Occurrence;
}

/** The persisted shape `adjustOccurrence` expects for this occurrence. */
function asDue(o: Occurrence, ledger: Ledger): Due | null {
  if (o.kind === "due") return ledger.dues.find((d) => d.id === o.id) ?? null;
  if (o.kind !== "estimate") return null;
  return {
    id: o.id,
    label: o.label,
    amount: o.amount,
    date: o.date,
    account: o.account,
    category: o.category,
    internal: o.internal,
    recurrenceKey: o.recurrenceKey,
    confidence: o.confidence,
    estimated: true,
  };
}

/** « ⋯ » menu of an expected movement: confirm, ignore (undo toast), edit amount, stop tracking, history. */
export function OccurrenceMenu({ ledger, occurrence: o }: OccurrenceMenuProps) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLSpanElement>(null);

  const due = asDue(o, ledger);
  const key = o.recurrenceKey;
  const recurrence = key
    ? activeRecurrences(ledger).find(
        (r) => r.key === key || r.aliases.includes(key),
      )
    : undefined;
  const rule = recurrence?.ruleId
    ? ledger.prefs.recurrenceRules.find((r) => r.id === recurrence.ruleId)
    : undefined;

  const run = async (message: string, command: () => Promise<Undo>) => {
    try {
      toast.undoable(message, await command());
    } catch (error) {
      toast.error(error);
    }
  };

  // EditableMoney opens on click: open it as soon as it replaces the trigger.
  useEffect(() => {
    if (editing)
      field.current?.querySelector<HTMLButtonElement>(".ui-editable")?.click();
  }, [editing]);

  const close = (refocus: boolean) => {
    setEditing(false);
    // An adjusted estimate becomes a due: its row (and this menu) remounts.
    if (refocus)
      requestAnimationFrame(() =>
        (trigger.current?.isConnected
          ? trigger.current
          : document.querySelector<HTMLElement>(
              `[aria-label="${CSS.escape(`Actions pour ${o.label}`)}"]`,
            )
        )?.focus(),
      );
  };

  if (editing && due)
    return (
      <span
        ref={field}
        className="occurrence-edit"
        onKeyDownCapture={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }
        }}
        // Back to display mode (unchanged value) means the edit is over.
        onFocusCapture={(event) => {
          if ((event.target as HTMLElement).matches(".ui-editable"))
            close(true);
        }}
        onBlurCapture={(event: FocusEvent<HTMLSpanElement>) => {
          if (event.currentTarget.contains(event.relatedTarget as Node)) return;
          // An invalid draft keeps its error; a pending save closes itself.
          requestAnimationFrame(() => {
            const input = field.current?.querySelector("input");
            if (
              input?.getAttribute("aria-invalid") !== "true" &&
              !input?.getAttribute("aria-busy")
            )
              close(false);
          });
        }}
      >
        <EditableMoney
          value={Math.abs(o.amount)}
          label={`Montant de ${o.label}`}
          size="text"
          validate={(cents) => (cents === 0 ? "Montant requis" : null)}
          onCommit={async (cents) => {
            const amount = Math.sign(o.amount) * Math.abs(cents ?? 0);
            try {
              toast.undoable(
                "Montant modifié",
                await adjustOccurrence(due, { amount }),
              );
              close(true);
            } catch (error) {
              // Bad input stays in the field; a conflict is not fixed by retyping.
              if (error instanceof RangeError) throw error;
              toast.error(error);
              close(true);
            }
          }}
        />
      </span>
    );

  const items: MenuEntry[] = [];
  if (recurrence && !recurrence.confirmed)
    items.push({
      label: "Confirmer cette récurrence",
      onSelect: () =>
        void run("Récurrence confirmée", () =>
          confirmRecurrence({
            id: crypto.randomUUID(),
            name: recurrence.name,
            account: recurrence.account,
            amount: recurrence.amount,
            category: recurrence.category,
            frequency: recurrence.frequency,
            next: recurrence.next,
            sourceKey: recurrence.key,
          }),
        ),
    });
  if (due)
    items.push({
      label: "Modifier le montant",
      onSelect: () => setEditing(true),
    });
  if (o.kind === "known")
    items.push({
      label: "Voir l’opération",
      onSelect: () =>
        navigate("transactions", { tx: o.id.slice("known:".length) }),
    });
  items.push({
    label: "Voir l’historique",
    onSelect: () => navigate("transactions", { q: o.label, acct: o.account }),
  });

  const stop: MenuEntry[] = [];
  if (o.kind === "estimate")
    stop.push({
      label: "Ignorer cette occurrence",
      onSelect: () =>
        void run("Occurrence ignorée", () => ignoreOccurrence(o.id)),
    });
  if (o.kind === "due" && due)
    stop.push({
      label: due.originOccurrenceId
        ? "Ignorer cette occurrence"
        : "Supprimer l’échéance",
      destructive: !due.originOccurrenceId,
      onSelect: () =>
        void run(
          due.originOccurrenceId ? "Occurrence ignorée" : "Échéance supprimée",
          () => deleteDue(o.id),
        ),
    });
  if (recurrence && !recurrence.paused)
    stop.push({
      label: "Arrêter le suivi",
      destructive: true,
      onSelect: () =>
        void run("Suivi arrêté", () =>
          rule
            ? confirmRecurrence({ ...rule, paused: true })
            : dismissRecurrence(recurrence.key),
        ),
    });
  if (stop.length) items.push({ type: "separator" }, ...stop);

  return (
    <Menu
      label={`Actions pour ${o.label}`}
      trigger={
        <IconButton
          ref={trigger}
          className="occurrence-trigger"
          label={`Actions pour ${o.label}`}
          icon={<Ellipsis />}
        />
      }
      items={items}
    />
  );
}
