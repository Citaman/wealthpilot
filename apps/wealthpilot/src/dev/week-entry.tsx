// Dev-only harness: Ma semaine inside a minimal shell, and the week and
// purchase cards at their allowed widths, on real data (`week.html?demo`).
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../ui/fonts";
import "../ui/tokens.css";
import "../ui/base.css";
import "../app/shell.css";
import { ReadingProvider, useReading, useToday } from "../app/context";
import { Dock } from "../app/Dock";
import { PageScope } from "../app/DockSlot";
import { useRoute } from "../app/router";
import { ToastProvider, useToastList } from "../app/toast";
import { useLedger, useLoaded } from "../data/hooks";
import type { Ledger } from "../domain/ledger";
import type { CardPaletteId, CardType, DashboardCard } from "../domain/types";
import { SimulateCard } from "../features/dashboard/cards/SimulateCard";
import { WeekCard } from "../features/dashboard/cards/WeekCard";
import { WeekPage } from "../features/week/WeekPage";
import { ToastView } from "../ui/ToastView";

const cards: { type: CardType; span: number; palette?: CardPaletteId }[] = [
  { type: "week", span: 4 },
  { type: "week", span: 6, palette: "yellow" },
  { type: "simulate", span: 4 },
  { type: "simulate", span: 6, palette: "ink" },
  { type: "week", span: 3, palette: "ink" },
];

function Cards({ ledger }: { ledger: Ledger }) {
  const { account, range } = useReading();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: "var(--grid-gap)",
        alignItems: "start",
      }}
    >
      {cards.map((c, i) => {
        const card: DashboardCard = { id: `c${i}`, type: c.type, width: 4, palette: c.palette };
        const props = { card, ledger, account, range, editing: false, setOption: () => undefined };
        return (
          <div key={card.id} style={{ gridColumn: `span ${c.span}`, minWidth: 0 }} data-card={c.type}>
            {c.type === "week" ? <WeekCard {...props} /> : <SimulateCard {...props} />}
          </div>
        );
      })}
    </div>
  );
}

function Harness() {
  const asOf = useToday();
  const loaded = useLoaded();
  const ledger = useLedger(asOf);
  const route = useRoute();
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const { toasts, dismiss } = useToastList();
  if (!loaded) return null;
  const week = route.page === "week";
  return (
    <ReadingProvider ledger={ledger} asOf={asOf}>
      <div className="app">
        <section className="page" data-page={route.page}>
          <PageScope target={dock} active>
            {week ? <WeekPage ledger={ledger} params={route.params} active /> : <Cards ledger={ledger} />}
          </PageScope>
        </section>
      </div>
      <Dock page={week ? "week" : "dashboard"} slotRef={setDock} />
      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastView
            key={t.id}
            message={t.message}
            tone={t.tone}
            onClose={() => dismiss(t.id)}
            action={t.action && { label: t.action.label, onClick: () => { dismiss(t.id); void t.action!.run(); } }}
          />
        ))}
      </div>
    </ReadingProvider>
  );
}

async function start() {
  if (new URLSearchParams(location.search).has("demo"))
    await (await import("./demo")).loadDemoIfEmpty();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ToastProvider>
        <Harness />
      </ToastProvider>
    </StrictMode>,
  );
}
void start();
