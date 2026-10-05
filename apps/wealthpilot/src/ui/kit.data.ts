// Fake French household used by the Kit only (brief §25 scene, week 12–18 oct. 2026).
import { addDays, eachDay } from "../domain/dates";
import type { IsoDate } from "../domain/types";
import type { LineSeries } from "./charts/LineChart";
import type { FlowBar } from "./charts/DivergingBars";
import type { RankedRow } from "./charts/RankedBars";
import type { StripDay } from "./charts/DayStrip";

export const TODAY: IsoDate = "2026-10-14";
const euros = (value: number) => Math.round(value * 100);

export const categories = {
  courses: { label: "Courses", color: "var(--series-1)" },
  transport: { label: "Transport", color: "var(--series-2)" },
  restaurants: { label: "Restaurants", color: "var(--series-3)" },
  logement: { label: "Logement", color: "var(--series-4)" },
  loisirs: { label: "Loisirs", color: "var(--series-7)" },
  sante: { label: "Santé", color: "var(--series-6)" },
  autres: { label: "Autres", color: "var(--series-other)" },
} as const;

export const accounts = [
  {
    id: "joint",
    name: "Joint",
    balance: euros(1070),
    color: "var(--series-1)",
    observed: "2026-10-13",
  },
  {
    id: "alex",
    name: "Alex",
    balance: euros(880),
    color: "var(--series-2)",
    observed: "2026-10-12",
  },
  {
    id: "sam",
    name: "Sam",
    balance: euros(490),
    color: "var(--series-3)",
    observed: "2026-10-03",
  },
];

export const envelopes = [
  {
    key: "courses",
    ...categories.courses,
    allocated: euros(200),
    paid: euros(70),
    committed: euros(60),
  },
  {
    key: "restaurants",
    ...categories.restaurants,
    allocated: euros(90),
    paid: euros(20),
    committed: 0,
  },
  {
    key: "transport",
    ...categories.transport,
    allocated: euros(60),
    paid: euros(10),
    committed: euros(20),
  },
  {
    key: "loisirs",
    ...categories.loisirs,
    allocated: euros(80),
    paid: euros(95),
    committed: 0,
  },
  {
    key: "sante",
    ...categories.sante,
    allocated: euros(40),
    paid: 0,
    committed: 0,
  },
];

/** Observed household balance from 18 sept. to today, with a coverage gap. */
export function balanceSeries(): LineSeries[] {
  const from: IsoDate = "2026-09-18";
  const end: IsoDate = "2026-10-31";
  const observed = eachDay({ from, to: TODAY }).map((date, i) => {
    let value = 2100 + Math.sin(i / 2.3) * 90 + i * 6;
    if (date >= "2026-09-26") value += 2650;
    if (date >= "2026-10-01") value -= 920;
    if (date >= "2026-10-05") value -= 1150;
    if (date >= "2026-10-09") value -= 380;
    const gap = date >= "2026-09-29" && date <= "2026-09-30";
    return { date, value: gap ? null : euros(Math.round(value)) };
  });
  observed[observed.length - 1] = { date: TODAY, value: euros(2440) };
  const forecast = eachDay({ from: TODAY, to: end }).map((date, i) => {
    let value = 2440 - i * 45;
    if (date >= "2026-10-16") value += 1200;
    if (date >= "2026-10-20") value -= 1980;
    if (date >= "2026-10-26") value += 900;
    return { date, value: euros(Math.round(value)) };
  });
  return [
    { id: "observed", label: "Réel", kind: "observed", points: observed },
    { id: "forecast", label: "Prévision", kind: "forecast", points: forecast },
  ];
}

export function balanceBand(series: LineSeries[]) {
  const forecast = series.find((s) => s.kind === "forecast")!;
  return forecast.points.map((p, i) => ({
    date: p.date,
    low: (p.value ?? 0) - euros(i * 18),
    high: (p.value ?? 0) + euros(i * 12),
  }));
}

export const balanceAnnotations = [
  {
    date: "2026-09-18",
    value: euros(2100),
    label: "Ouverture du compte Joint · solde initial importé",
  },
  { date: "2026-09-26", value: euros(4823), label: "Salaire Alex +2 650 €" },
  { date: "2026-10-01", value: euros(3900), label: "Loyer −920 €" },
  { date: "2026-10-20", value: euros(940), label: "Point bas 940 €" },
];

export const flows: FlowBar[] = [
  ["2026-05", "Mai", 4620, 3980],
  ["2026-06", "Juin", 4710, 4420],
  ["2026-07", "Juil.", 4630, 5210],
  ["2026-08", "Août", 4650, 3870],
  ["2026-09", "Sept.", 4830, 3412],
  ["2026-10", "Oct.", 2650, 1740],
].map(([key, label, income, spending], i, all) => ({
  key: key as string,
  label: label as string,
  title: (label as string).replace(".", "") + " 2026",
  income: euros(income as number),
  spending: euros(spending as number),
  incomplete: i === all.length - 1,
}));

export const spending: RankedRow[] = [
  {
    key: "logement",
    ...categories.logement,
    amount: euros(920),
    share: 0.38,
    usual: euros(920),
    deltaPct: null,
  },
  {
    key: "courses",
    ...categories.courses,
    amount: euros(486),
    share: 0.2,
    usual: euros(430),
    deltaPct: null,
  },
  {
    key: "restaurants",
    ...categories.restaurants,
    amount: euros(212),
    share: 0.09,
    usual: euros(149),
    deltaPct: 42,
  },
  {
    key: "transport",
    ...categories.transport,
    amount: euros(168),
    share: 0.07,
    usual: euros(175),
    deltaPct: null,
  },
  {
    key: "loisirs",
    ...categories.loisirs,
    amount: euros(95),
    share: 0.04,
    usual: euros(120),
    deltaPct: null,
  },
  {
    key: "autres",
    ...categories.autres,
    amount: euros(540),
    share: 0.22,
    usual: null,
    deltaPct: null,
  },
];

export const week: StripDay[] = eachDay({
  from: "2026-10-12",
  to: "2026-10-18",
}).map((date, i) => ({
  date,
  spent: date <= TODAY ? euros([46, 32, 18][i] ?? 0) : null,
  charges:
    date === "2026-10-15"
      ? [{ label: "Internet", amount: euros(30) }]
      : date === "2026-10-16"
        ? [
            { label: "École", amount: euros(80) },
            { label: "Assurance", amount: euros(90), estimated: true },
          ]
        : [],
  incomes:
    date === "2026-10-16"
      ? [{ label: "Salaire Sam", amount: euros(1200), estimated: true }]
      : [],
  endBalance: euros([2504, 2472, 2440, 2380, 3410, 3330, 3190][i]),
}));

export const upcoming = [
  {
    id: "u1",
    date: "2026-10-15",
    name: "Free Internet",
    category: categories.logement,
    amount: euros(-30),
    estimated: false,
    src: "/merchant-assets/free.png",
  },
  {
    id: "u2",
    date: "2026-10-16",
    name: "Cantine école",
    category: categories.autres,
    amount: euros(-80),
    estimated: false,
  },
  {
    id: "u3",
    date: "2026-10-16",
    name: "Salaire Sam",
    category: categories.autres,
    amount: euros(1200),
    estimated: true,
  },
  {
    id: "u4",
    date: "2026-10-17",
    name: "MAIF Assurance",
    category: categories.sante,
    amount: euros(-90),
    estimated: true,
    src: "/merchant-assets/introuvable.png",
  },
  {
    id: "u5",
    date: "2026-10-26",
    name: "Salaire Alex",
    category: categories.autres,
    amount: euros(2650),
    estimated: true,
  },
];

export const availableRows = (reserve: number) => [
  {
    key: "cash",
    label: "Trésorerie",
    value: euros(2440),
    kind: "base" as const,
  },
  {
    key: "charges",
    label: "Charges à venir",
    value: -euros(200),
    kind: "step" as const,
  },
  {
    key: "envelopes",
    label: "Enveloppes restantes",
    value: -euros(170),
    kind: "step" as const,
  },
  {
    key: "reserve",
    label: "Réserve de sécurité",
    value: -reserve,
    kind: "step" as const,
  },
  {
    key: "free",
    label: "Libre",
    value: euros(2440 - 200 - 170) - reserve,
    kind: "total" as const,
  },
];

export const sparkValues = (seed: number) =>
  Array.from({ length: 20 }, (_, i) =>
    Math.round(1000 + Math.sin((i + seed) / 2.4) * 140 + i * seed * 3),
  );

export const dayAfter = (n: number) => addDays(TODAY, n);
