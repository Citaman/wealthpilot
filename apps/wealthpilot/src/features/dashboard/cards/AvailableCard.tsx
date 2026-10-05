import { useState } from "react";
import { hrefFor, navigate } from "../../../app/router";
import { useToast } from "../../../app/toast";
import { setSafety } from "../../../data/commands";
import { available } from "../../../domain/available";
import { formatDay, weekStart } from "../../../domain/dates";
import { effectiveDate, type Occurrence } from "../../../domain/events";
import { accountName, accountsIn, type Ledger } from "../../../domain/ledger";
import { formatEuro } from "../../../domain/money";
import { weekPlan } from "../../../domain/week";
import { Button } from "../../../ui/Button";
import { CardShell } from "../../../ui/CardShell";
import { Disclosure } from "../../../ui/Disclosure";
import { EditableMoney } from "../../../ui/Editable";
import { Money } from "../../../ui/Money";
import { Waterfall, type WaterfallRow } from "../../../ui/charts/Waterfall";
import type { CardProps } from "./types";
import "./AvailableCard.css";

const SHOWN_CHARGES = 5;

export function AvailableCard({ card, ledger, account }: CardProps) {
  const a = available(ledger, account);
  const week = weekPlan(ledger, account, weekStart(ledger.asOf));
  const scope = account
    ? accountName(ledger, account)
    : `Foyer · ${accountsIn(ledger, "").length} comptes`;
  const short = a.free !== null && a.free < 0;

  return (
    <CardShell
      palette={card.palette}
      motif
      eyebrow={`Libre jusqu’au ${formatDay(a.until)}`}
      footer={
        <div className="available-foot">
          <a
            className="available-week"
            href={hrefFor("week", { acct: account || undefined })}
          >
            <span className="eyebrow">Cette semaine</span>
            <Money
              value={week.totals.possible}
              size="xl"
              tone="none"
              cents="never"
            />
          </a>
          <span className="mono muted available-scope">{scope}</span>
          {!a.unknownBalance && (
            <Disclosure summary="Voir le calcul" className="available-calc">
              <Calculation ledger={ledger} account={account} />
            </Disclosure>
          )}
        </div>
      }
    >
      {a.unknownBalance ? (
        <div className="available-hero">
          <span className="available-unknown">À confirmer</span>
          <Button
            variant="outline"
            onClick={() => navigate("import", { acct: account || undefined })}
          >
            Importer un relevé
          </Button>
        </div>
      ) : (
        <div className="available-hero" data-short={short || undefined}>
          {short && <span className="available-short">Il manque</span>}
          <Money
            className="available-amount"
            value={short ? -a.free! : a.free}
            size="hero"
            tone="none"
            aria-label={
              short
                ? `Il manque ${formatEuro(-a.free!)}`
                : `Libre ${formatEuro(a.free!)}`
            }
          />
          <p className="available-sub">
            {a.sharedReserveNote
              ? "réserve foyer non répartie"
              : "après charges et réserves"}
          </p>
        </div>
      )}
    </CardShell>
  );
}

function Calculation({ ledger, account }: { ledger: Ledger; account: string }) {
  const toast = useToast();
  const a = available(ledger, account);
  const [chargesOpen, setChargesOpen] = useState(false);
  const rows: WaterfallRow[] = [
    { key: "cash", label: "Trésorerie", value: a.cash ?? 0, kind: "base" },
    {
      key: "charges",
      label: (
        <button
          type="button"
          className="available-toggle"
          aria-expanded={chargesOpen}
          disabled={!a.charges.length}
          onClick={() => setChargesOpen((open) => !open)}
        >
          Charges à venir
          {a.charges.length > 0 && (
            <span className="mono muted"> · {a.charges.length}</span>
          )}
        </button>
      ),
      value: -a.chargesTotal,
      kind: "step",
      detail: chargesOpen ? (
        <Charges charges={a.charges} asOf={ledger.asOf} />
      ) : undefined,
    },
    {
      key: "envelopes",
      label: "Enveloppes restantes",
      value: -a.envelopesFree,
      kind: "step",
    },
  ];
  if (!account)
    rows.push({
      key: "safety",
      label: "Réserve de sécurité",
      value: -a.safety,
      kind: "step",
      amount: (
        <EditableMoney
          value={a.safety}
          size="s"
          label="Réserve de sécurité"
          validate={(v) => (v < 0 ? "Montant positif attendu" : null)}
          onCommit={async (next) => {
            const undo = await setSafety(next ?? 0);
            toast.undoable("Réserve de sécurité modifiée", undo);
          }}
        />
      ),
    });
  if (a.projects > 0)
    rows.push({
      key: "projects",
      label: "Réservé aux projets",
      value: -a.projects,
      kind: "step",
    });
  rows.push({ key: "free", label: "Libre", value: a.free ?? 0, kind: "total" });

  return (
    <div className="available-calculation">
      <Waterfall label="Calcul du disponible" rows={rows} />
      {a.sharedReserveNote && (
        <p className="mono muted">Réserve foyer non répartie</p>
      )}
      {a.expectedIncome.length > 0 && (
        <div className="available-income">
          <span className="eyebrow muted">Non comptés</span>
          <ul>
            {a.expectedIncome.map((o) => (
              <li key={o.id}>
                <span>{o.label}</span>
                <span className="mono">
                  ≈ {formatEuro(o.amount, { cents: "never" })} le{" "}
                  {formatDay(o.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Charges({ charges, asOf }: { charges: Occurrence[]; asOf: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? charges : charges.slice(0, SHOWN_CHARGES);
  const hidden = charges.length - shown.length;
  return (
    <ul className="available-charges">
      {shown.map((o) => (
        <li key={o.id}>
          <span className="mono muted">
            {formatDay(effectiveDate(o, asOf))}
          </span>
          <span className="available-charge-label">{o.label}</span>
          <Money value={o.amount} tone="none" cents="never" />
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            className="available-more"
            onClick={() => setAll(true)}
          >
            +{hidden}
          </button>
        </li>
      )}
    </ul>
  );
}
