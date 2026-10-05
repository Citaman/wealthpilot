// Dev-only harness: the Cards builder's six cards at ⅓ ½ ⅔ 1 with live data (`/cards.html?demo`).
import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "../ui/fonts";
import "../ui/tokens.css";
import "../ui/base.css";
import "../app/shell.css";
import { ReadingProvider, useReading, useToday } from "../app/context";
import { ToastProvider, useToastList } from "../app/toast";
import { useLedger, useLoaded } from "../data/hooks";
import type { Ledger } from "../domain/ledger";
import type { CardType, CardWidth } from "../domain/types";
import { AccountsCard } from "../features/dashboard/cards/AccountsCard";
import { EnvelopesCard } from "../features/dashboard/cards/EnvelopesCard";
import { InboxCard } from "../features/dashboard/cards/InboxCard";
import { RecentCard } from "../features/dashboard/cards/RecentCard";
import { SpendingCard } from "../features/dashboard/cards/SpendingCard";
import { UpcomingCard } from "../features/dashboard/cards/UpcomingCard";
import type { CardProps } from "../features/dashboard/cards/types";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { ToastView } from "../ui/ToastView";

const cards: [CardType, ComponentType<CardProps>][] = [
  ["envelopes", EnvelopesCard],
  ["upcoming", UpcomingCard],
  ["spending", SpendingCard],
  ["recent", RecentCard],
  ["inbox", InboxCard],
  ["accounts", AccountsCard],
];

const params = new URLSearchParams(location.search);
const only = params.get("card");
const widths = (params.get("w") ?? "4,6,8,12")
  .split(",")
  .map(Number) as CardWidth[];

function Grid() {
  const asOf = useToday();
  const ledger = useLedger(asOf);
  return (
    <ReadingProvider ledger={ledger} asOf={asOf}>
      <Rows ledger={ledger} />
    </ReadingProvider>
  );
}

function Rows({ ledger }: { ledger: Ledger }) {
  const { account, setAccount, range } = useReading();
  return (
    <div style={{ display: "grid", gap: 40 }}>
      <label className="mono">
        Compte du dock{" "}
        <select
          data-harness-account
          value={account}
          onChange={(e) => setAccount(e.currentTarget.value)}
        >
          <option value="">Foyer</option>
          {ledger.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.id}
            </option>
          ))}
        </select>{" "}
        · {range.label} {range.from} → {range.to}
      </label>
      {cards
        .filter(([type]) => !only || type === only)
        .map(([type, Card]) => (
          <div
            key={type}
            data-harness={type}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gap: "var(--grid-gap)",
              alignItems: "start",
            }}
          >
            {widths.map((width) => (
              <div
                key={width}
                data-width-cols={width}
                style={{ gridColumn: `span ${width}` }}
              >
                <ErrorBoundary>
                  <Card
                    card={{ id: `${type}-${width}`, type, width }}
                    ledger={ledger}
                    account={account}
                    range={range}
                    editing={false}
                    setOption={() => undefined}
                  />
                </ErrorBoundary>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function Toasts() {
  const { toasts, dismiss } = useToastList();
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastView
          key={t.id}
          message={t.message}
          tone={t.tone}
          onClose={() => dismiss(t.id)}
          action={
            t.action && {
              label: t.action.label,
              onClick: () => {
                dismiss(t.id);
                void t.action!.run();
              },
            }
          }
        />
      ))}
    </div>
  );
}

function Harness() {
  const loaded = useLoaded();
  return (
    <ToastProvider>
      <div className="app" style={{ maxWidth: 2000 }}>
        {loaded && <Grid />}
      </div>
      <Toasts />
    </ToastProvider>
  );
}

async function start() {
  if (params.has("demo")) await (await import("./demo")).loadDemoIfEmpty();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Harness />
    </StrictMode>,
  );
}
void start();
