import { ChevronLeft, ChevronRight } from "lucide-react";
import { accountStatus } from "../domain/balances";
import { formatRange } from "../domain/dates";
import type { Ledger } from "../domain/ledger";
import { formatEuro } from "../domain/money";
import {
  nextBoundary,
  periodOptions,
  type PeriodValue,
} from "../domain/periods";
import { formatDay } from "../domain/dates";
import { IconButton } from "../ui/IconButton";
import { Picker } from "../ui/Picker";
import { decodePeriod, encodePeriod, useReading } from "./context";

// Radix Select reserves "" for "no value".
const HOUSEHOLD = "household";

export function AccountPicker({
  ledger,
  value,
  onChange,
}: {
  ledger: Ledger;
  value: string;
  onChange(account: string): void;
}) {
  const status = accountStatus(ledger);
  const count = status.length;
  return (
    <Picker
      label="Compte"
      variant="dock"
      side="top"
      value={value || HOUSEHOLD}
      onValueChange={(v) => onChange(v === HOUSEHOLD ? "" : v)}
      valueLabel={value ? status.find((s) => s.id === value)?.name : "Foyer"}
      options={[
        {
          value: HOUSEHOLD,
          label: "Foyer",
          meta: count > 1 ? `${count} comptes` : undefined,
        },
        ...status.map((s) => ({
          value: s.id,
          label: s.name,
          meta:
            s.balance === null
              ? "à confirmer"
              : formatEuro(s.balance, { cents: "never" }),
        })),
      ]}
    />
  );
}

/** Account picker bound to the shared reading context (Dashboard, Transactions). */
export function SharedAccountPicker({ ledger }: { ledger: Ledger }) {
  const { account, setAccount } = useReading();
  return (
    <AccountPicker ledger={ledger} value={account} onChange={setAccount} />
  );
}

export function PeriodPicker({ ledger }: { ledger: Ledger }) {
  const { period, setPeriod, range, asOf } = useReading();
  const options = periodOptions(ledger.calendar, asOf);
  const months = options.filter((o) => o.value.kind === "month");
  const rolling = options.filter((o) => o.value.kind !== "month");
  const current = encodePeriod(period ?? months[0]?.value ?? { kind: "all" });
  const monthIndex = months.findIndex((o) => encodePeriod(o.value) === current);
  const next = nextBoundary(ledger.calendar);

  const select = (value: PeriodValue) =>
    // The newest month is stored as "current" so it keeps following the calendar.
    setPeriod(
      encodePeriod(value) === encodePeriod(months[0]?.value ?? value)
        ? null
        : value,
    );

  const describe = (o: (typeof options)[number]) =>
    [
      formatRange(o.range),
      "partial" in o.range && o.range.partial ? "partiel" : "",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="dock-period">
      {monthIndex >= 0 && (
        <IconButton
          label="Mois précédent"
          icon={<ChevronLeft size={16} aria-hidden />}
          className="dock-step"
          disabledReason={
            monthIndex === months.length - 1
              ? "Premier mois de l’historique"
              : undefined
          }
          onClick={() => select(months[monthIndex + 1].value)}
        />
      )}
      <Picker
        label="Période"
        variant="dock"
        side="top"
        value={current}
        onValueChange={(v) => {
          const value = decodePeriod(v, null);
          if (value) select(value);
        }}
        valueLabel={range.label}
        sections={[
          {
            label: "Mois budgétaire",
            options: months.map((o) => ({
              value: encodePeriod(o.value),
              label: o.label,
              description: describe(o),
            })),
          },
          {
            label: "Glissant",
            options: rolling.map((o) => ({
              value: encodePeriod(o.value),
              label: o.label,
            })),
          },
        ]}
        footer={
          <p className="dock-period-note">
            Un mois va du premier revenu du foyer à la veille du suivant
            {next
              ? ` · prochain ${next.estimated ? "≈ " : ""}${formatDay(next.date)}`
              : ""}
          </p>
        }
      />
      {monthIndex >= 0 && (
        <IconButton
          label="Mois suivant"
          icon={<ChevronRight size={16} aria-hidden />}
          className="dock-step"
          disabledReason={monthIndex === 0 ? "Mois en cours" : undefined}
          onClick={() => select(months[monthIndex - 1].value)}
        />
      )}
    </div>
  );
}
