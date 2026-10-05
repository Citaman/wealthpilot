import { Check, LayoutGrid, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PageProps } from "../../app/App";
import { PeriodPicker, SharedAccountPicker } from "../../app/ContextControls";
import { useReading } from "../../app/context";
import { DockActions } from "../../app/DockSlot";
import { navigate } from "../../app/router";
import { useToast } from "../../app/toast";
import { saveDashboard } from "../../data/commands";
import { useDashboardLayout } from "../../data/hooks";
import type {
  CardType,
  DashboardCard,
  DashboardLayout,
} from "../../domain/types";
import { Button } from "../../ui/Button";
import { Empty } from "../../ui/Empty";
import { AddCardSheet } from "./AddCardSheet";
import { Board } from "./Board";
import { createCard, defaultLayout, readLayout } from "./layout";
import "./dashboard.css";

type OptionValue = string | number | boolean;

export function DashboardPage({ ledger, active }: PageProps) {
  const toast = useToast();
  const { account, range } = useReading();
  const stored = useDashboardLayout();
  const saved = useMemo(() => readLayout(stored), [stored]);
  // A written layout stays shown until the live query brings it back.
  const [written, setWritten] = useState<{
    over: unknown;
    layout: DashboardLayout;
  } | null>(null);
  const shown = written && written.over === stored ? written.layout : saved;
  const [draft, setDraft] = useState<DashboardLayout | null>(null);
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const focused = useRef<string | null>(null);
  const organizeButton = useRef<HTMLButtonElement>(null);
  const finishButton = useRef<HTMLButtonElement>(null);
  const editing = draft !== null;
  const cards = (draft ?? shown).cards;

  const latest = useRef({ shown, stored, draft });
  latest.current = { shown, stored, draft };

  const write = useCallback(
    async (layout: DashboardLayout) => {
      setWritten({ over: latest.current.stored, layout });
      latest.current.shown = layout;
      try {
        await saveDashboard(layout);
      } catch (error) {
        setWritten(null);
        throw error;
      }
    },
    [],
  );

  // Presentation options (forecast toggle…) are saved at once, even outside organize mode.
  const onOption = useCallback(
    (id: string, key: string, value: OptionValue) => {
      const patch = (layout: DashboardLayout): DashboardLayout => ({
        ...layout,
        cards: layout.cards.map((c) =>
          c.id === id ? { ...c, options: { ...c.options, [key]: value } } : c,
        ),
      });
      if (latest.current.draft) setDraft((d) => d && patch(d));
      write(patch(latest.current.shown)).catch(toast.error);
    },
    [toast, write],
  );

  const setCards = (next: DashboardCard[]) =>
    setDraft((d) => d && { ...d, cards: next });

  const start = () => {
    setDraft(structuredClone(shown));
    setAnnouncement("Mode organisation");
  };

  const cancel = () => {
    setDraft(null);
    setAnnouncement("Organisation annulée");
  };

  const finish = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await write(draft);
      setDraft(null);
      toast.show({ message: "Disposition enregistrée" });
    } catch (error) {
      toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  // The dock swaps its commands: keep the focus on the swapped control.
  const wasEditing = useRef(editing);
  useEffect(() => {
    if (wasEditing.current === editing) return;
    wasEditing.current = editing;
    if (!active) return;
    requestAnimationFrame(() =>
      (editing ? finishButton : organizeButton).current?.focus({
        preventScroll: true,
      }),
    );
  }, [editing, active]);

  const remove = (id: string) => {
    const list = draft?.cards ?? [];
    const index = list.findIndex((c) => c.id === id);
    if (index < 0) return;
    const card = list[index];
    const neighbour = list[index + 1] ?? list[index - 1];
    setCards(list.filter((c) => c.id !== id));
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          neighbour
            ? `[data-card-id="${neighbour.id}"] [data-sort-handle]`
            : "[data-page='dashboard'] h1",
        )
        ?.focus({ preventScroll: true }),
    );
    toast.undoable("Carte retirée", () => {
      const restore = (layout: DashboardLayout): DashboardLayout =>
        layout.cards.some((c) => c.id === card.id)
          ? layout
          : {
              ...layout,
              cards: [
                ...layout.cards.slice(0, index),
                card,
                ...layout.cards.slice(index),
              ],
            };
      if (latest.current.draft) setDraft((d) => d && restore(d));
      else write(restore(latest.current.shown)).catch(toast.error);
    });
  };

  const add = (type: CardType) => {
    const card = createCard(type);
    const list = draft?.cards ?? [];
    const after = list.findIndex((c) => c.id === focused.current);
    const next = [...list];
    next.splice(after < 0 ? list.length : after + 1, 0, card);
    setCards(next);
    setSheet(false);
    setHighlight(card.id);
    focused.current = card.id;
  };

  const reset = () => {
    const previous = draft;
    setDraft(defaultLayout());
    setSheet(false);
    toast.undoable("Disposition par défaut rétablie", () =>
      setDraft((d) => (d && previous ? previous : d)),
    );
  };

  // Scroll to the added card once the sheet has closed, and mark it for a second.
  useEffect(() => {
    if (!highlight) return;
    const frame = requestAnimationFrame(() => {
      const cell = document.querySelector<HTMLElement>(
        `[data-card-id="${highlight}"]`,
      );
      cell?.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      cell
        ?.querySelector<HTMLElement>("[data-sort-handle]")
        ?.focus({ preventScroll: true });
    });
    const timer = setTimeout(() => setHighlight(null), 1200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [highlight]);

  const counts = useMemo(() => {
    const map = new Map<CardType, number>();
    for (const c of cards) map.set(c.type, (map.get(c.type) ?? 0) + 1);
    return map;
  }, [cards]);

  const empty = !ledger.transactions.length;

  return (
    <div className="dashboard">
      <DockActions>
        <div className="dash-dock">
          {editing ? (
            <>
              <Button
                variant="ghost"
                className="dash-dock-button"
                icon={<Plus aria-hidden />}
                onClick={() => setSheet(true)}
              >
                Ajouter
              </Button>
              <Button
                variant="ghost"
                className="dash-dock-button"
                onClick={cancel}
              >
                Annuler
              </Button>
              <Button
                ref={finishButton}
                variant="accent"
                className="dash-dock-button"
                icon={<Check aria-hidden />}
                loading={saving}
                onClick={finish}
              >
                Terminer
              </Button>
            </>
          ) : (
            <>
              <SharedAccountPicker ledger={ledger} />
              <PeriodPicker ledger={ledger} />
              <Button
                ref={organizeButton}
                variant="ghost"
                className="dash-dock-button"
                icon={<LayoutGrid aria-hidden />}
                disabledReason={
                  empty ? "Importez d’abord un relevé" : undefined
                }
                onClick={start}
              >
                <span className="dash-dock-label">Organiser</span>
              </Button>
            </>
          )}
        </div>
      </DockActions>

      {empty ? (
        <Empty
          action={
            <Button variant="primary" onClick={() => navigate("import")}>
              Importer un relevé
            </Button>
          }
        >
          Aucune opération
        </Empty>
      ) : cards.length ? (
        <Board
          ledger={ledger}
          cards={cards}
          editing={editing}
          account={account}
          range={range}
          onOption={onOption}
          onChange={setCards}
          onRemove={remove}
          onFocusCard={(id) => (focused.current = id)}
          highlight={highlight}
        />
      ) : (
        <Empty
          action={
            <Button
              variant="primary"
              icon={<Plus aria-hidden />}
              onClick={() => {
                if (!editing) start();
                setSheet(true);
              }}
            >
              Ajouter une carte
            </Button>
          }
        >
          Aucune carte
        </Empty>
      )}

      <AddCardSheet
        open={sheet && editing}
        onOpenChange={setSheet}
        ledger={ledger}
        account={account}
        range={range}
        counts={counts}
        onAdd={add}
        onReset={reset}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
