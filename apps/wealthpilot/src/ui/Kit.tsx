import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Download,
  GripVertical,
  MoreVertical,
  Palette,
  Plus,
  Rows3,
  Rows4,
  ShoppingCart,
  Trash2,
  Rows2,
  List,
  CircleDot,
} from "lucide-react";
import { formatDay, formatWeekday } from "../domain/dates";
import { formatEuro } from "../domain/money";
import { cardPaletteIds, type CardPaletteId } from "../domain/types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { CardShell } from "./CardShell";
import { CategoryDot } from "./CategoryDot";
import { DateChip } from "./DateChip";
import { Dialog, DialogClose } from "./Dialog";
import { Disclosure } from "./Disclosure";
import { EditableMoney, EditableText } from "./Editable";
import { Empty } from "./Empty";
import { ErrorBoundary } from "./ErrorBoundary";
import { Field } from "./Field";
import { IconButton } from "./IconButton";
import { Menu } from "./Menu";
import { MerchantLogo } from "./MerchantLogo";
import { Money } from "./Money";
import { Picker } from "./Picker";
import { Popover, PopoverClose } from "./Popover";
import { ProgressBar } from "./ProgressBar";
import { Segmented } from "./Segmented";
import { Sheet } from "./Sheet";
import { Skeleton } from "./Skeleton";
import { ToastView } from "./ToastView";
import { moveItem, useSortable } from "./sortable";
import { ConcentricRings } from "./charts/ConcentricRings";
import { DayStrip } from "./charts/DayStrip";
import { DivergingBars } from "./charts/DivergingBars";
import { LineChart } from "./charts/LineChart";
import { RankedBars } from "./charts/RankedBars";
import { SegmentBar } from "./charts/SegmentBar";
import { Sparkline } from "./charts/Sparkline";
import { Waterfall } from "./charts/Waterfall";
import * as data from "./kit.data";
import "./kit.css";

const paletteNames: Record<CardPaletteId, string> = {
  paper: "Papier",
  ink: "Encre",
  yellow: "Jaune",
  pink: "Rose",
  cyan: "Cyan",
  coral: "Corail",
  lavender: "Lavande",
  plum: "Prune",
  midnight: "Bleu nuit",
  sage: "Sauge",
  forest: "Forêt",
  sand: "Sable",
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="kit-section" aria-labelledby={id}>
      <h2 id={id} className="eyebrow kit-section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Kit() {
  const [theme, setTheme] = useState<"paper" | "ink">("paper");
  return (
    <div className="kit" data-theme={theme === "ink" ? "ink" : undefined}>
      <header className="kit-header">
        <p className="kit-logo display">
          wealthpilot <span className="kit-logo-mark" aria-hidden />
        </p>
        <h1 className="eyebrow">Kit · primitives et graphes</h1>
        <Segmented
          label="Thème"
          value={theme}
          onChange={setTheme}
          options={[
            { value: "paper", label: "Papier" },
            { value: "ink", label: "Encre" },
          ]}
        />
      </header>
      <Scene />
      <Section id="kit-controls" title="Contrôles">
        <Controls />
      </Section>
      <Section id="kit-values" title="Montants et édition">
        <Values />
      </Section>
      <Section id="kit-feedback" title="États et retours">
        <Feedback />
      </Section>
      <Section id="kit-lines" title="Courbe · trois largeurs">
        <LineWidths />
      </Section>
      <Section id="kit-charts" title="Graphes">
        <Charts />
      </Section>
      <Section id="kit-palettes" title="Douze palettes de carte">
        <PaletteGrid />
      </Section>
      <Section id="kit-sort-grid" title="Organiser · grille">
        <SortableGrid />
      </Section>
      <Section id="kit-sort-list" title="Organiser · liste">
        <SortableList />
      </Section>
    </div>
  );
}

/* Scene ------------------------------------------------------------------ */

function Scene() {
  const [reserve, setReserve] = useState(120_000);
  const [activeRing, setActiveRing] = useState<number | null>(null);
  const [period, setPeriod] = useState("2026-10");
  const [view, setView] = useState<"rings" | "list">("rings");
  const [mode, setMode] = useState<"real" | "forecast">("forecast");
  const series = data.balanceSeries();
  const rows = data.availableRows(reserve);
  const free = rows[rows.length - 1].value;
  const spent = data.envelopes.reduce((total, e) => total + e.paid, 0);

  return (
    <div className="kit-grid" id="kit-scene">
      <CardShell
        palette="ink"
        motif
        eyebrow="Libre jusqu’au 24 oct."
        className="kit-span-4"
        actions={
          <IconButton label="Options de la carte" icon={<MoreVertical />} />
        }
        footer={
          <div className="kit-foot">
            <div>
              <p className="eyebrow">Cette semaine</p>
              <Money value={17_000} size="xl" tone="none" />
            </div>
            <p className="mono muted">Foyer · 3 comptes</p>
            <Disclosure summary="Voir le calcul" className="kit-foot-calc">
              <Waterfall
                label="Calcul du disponible"
                rows={rows.map((row) =>
                  row.key === "reserve"
                    ? {
                        ...row,
                        amount: (
                          <EditableMoney
                            value={reserve}
                            size="s"
                            label="Réserve de sécurité"
                            onCommit={async (next) => {
                              await wait(250);
                              setReserve(next ?? 0);
                            }}
                          />
                        ),
                      }
                    : row,
                )}
              />
            </Disclosure>
          </div>
        }
      >
        <div className="kit-hero">
          <Money
            value={free}
            size="hero"
            tone="none"
            className="kit-highlight"
          />
          <p className="kit-hero-sub">après charges et réserves</p>
        </div>
      </CardShell>

      <CardShell
        title="Solde"
        className="kit-span-8"
        actions={
          <>
            <Picker
              label="Période"
              value={period}
              onValueChange={setPeriod}
              size="compact"
              sections={[
                {
                  label: "Mois budgétaire",
                  options: [
                    {
                      value: "2026-10",
                      label: "Octobre",
                      description: "26 sept. → auj.",
                    },
                    {
                      value: "2026-09",
                      label: "Septembre",
                      description: "26 août → 25 sept.",
                    },
                    {
                      value: "2026-08",
                      label: "Août",
                      description: "1 août → 25 août · partiel",
                    },
                  ],
                },
                {
                  label: "Glissant",
                  options: [
                    { value: "30d", label: "30 jours" },
                    { value: "3m", label: "3 mois" },
                    { value: "all", label: "Tout l’historique" },
                  ],
                },
              ]}
              footer="Mois = du 1er revenu du foyer à la veille du suivant"
            />
            <Segmented
              label="Affichage du solde"
              size="compact"
              value={mode}
              onChange={setMode}
              options={[
                { value: "real", label: "Réel" },
                { value: "forecast", label: "+ Prévision" },
              ]}
            />
          </>
        }
      >
        <div className="kit-hero-row">
          <Money value={244_000} size="l" tone="none" />
          <Money value={112_000} signed size="text" />
          <span className="mono muted">observé le 13 oct.</span>
        </div>
        <LineChart
          label="Solde du foyer, 18 sept. → 31 oct."
          series={mode === "real" ? series.slice(0, 1) : series}
          band={mode === "real" ? undefined : data.balanceBand(series)}
          threshold={{ value: 120_000, label: "Réserve 1 200 €" }}
          today={data.TODAY}
          annotations={
            mode === "real"
              ? data.balanceAnnotations.slice(0, 3)
              : data.balanceAnnotations
          }
          onSelect={() => undefined}
        />
        <div className="kit-tiles">
          <div className="kit-tile">
            <span>Point bas</span>
            <Money value={94_000} size="m" tone="none" />
            <span className="mono muted">20 oct.</span>
          </div>
          <div className="kit-tile">
            <span>Fin du mois</span>
            <Money value={218_000} size="m" tone="none" />
            <span className="mono muted">24 oct.</span>
          </div>
        </div>
      </CardShell>

      <CardShell
        title="Enveloppes"
        className="kit-span-6"
        actions={
          <Segmented
            label="Vue des enveloppes"
            value={view}
            onChange={setView}
            options={[
              { value: "rings", label: <CircleDot />, ariaLabel: "Anneaux" },
              { value: "list", label: <List />, ariaLabel: "Liste" },
            ]}
          />
        }
        footer={
          <div className="kit-footer-line">
            <Money value={17_000} size="m" tone="none" />
            <span>restants cette semaine</span>
          </div>
        }
      >
        <div className="kit-envelopes" data-view={view}>
          {view === "rings" && (
            <ConcentricRings
              label="Enveloppes d’octobre"
              rings={data.envelopes.map((e) => ({
                key: e.key,
                label: e.label,
                value: e.paid + e.committed,
                max: e.allocated,
                color: e.color,
              }))}
              activeIndex={activeRing}
              onActiveChange={setActiveRing}
              center={
                <>
                  <Money value={spent} size="l" tone="none" />
                  <span className="kit-ring-sub">dépensés</span>
                </>
              }
            />
          )}
          <ul className="kit-envelope-list">
            {data.envelopes.map((e, i) => (
              <li
                key={e.key}
                data-active={activeRing === i || undefined}
                onPointerEnter={() => setActiveRing(i)}
                onPointerLeave={() => setActiveRing(null)}
              >
                <span className="kit-envelope-head">
                  <CategoryDot color={e.color} size={12} />
                  <span className="kit-envelope-name">{e.label}</span>
                  <Money
                    value={e.allocated - e.paid - e.committed}
                    size="s"
                    tone="auto"
                    className="kit-envelope-free"
                  />
                </span>
                <span className="mono muted">
                  {formatEuro(e.paid, { cents: "never" })} /{" "}
                  {formatEuro(e.allocated, { cents: "never" })}
                </span>
                <ProgressBar
                  label={e.label}
                  paid={e.paid}
                  committed={e.committed}
                  total={e.allocated}
                  color={e.color}
                  showPercent
                />
              </li>
            ))}
          </ul>
        </div>
      </CardShell>

      <CardShell title="À venir" className="kit-span-6">
        <p className="kit-alert">
          <Badge tone="negative">Sam &lt; 0 le 28 oct.</Badge>
          <span>prévoir 120 € avant le 27</span>
        </p>
        <ul className="kit-agenda">
          {data.upcoming.map((u) => (
            <li key={u.id}>
              <DateChip date={u.date} soon={u.date <= data.dayAfter(3)} />
              <MerchantLogo
                name={u.name}
                color="#9ccbef"
                src={u.src}
                icon={u.amount > 0 ? ArrowUpRight : undefined}
              />
              <span className="kit-agenda-text">
                <span className="kit-agenda-name">{u.name}</span>
                <span className="mono muted">
                  {formatWeekday(u.date)} · {u.category.label}
                </span>
              </span>
              {u.estimated && <Badge tone="estimated">Estimé</Badge>}
              <Money value={u.amount} signed size="s" />
              <Menu
                label={`Actions pour ${u.name}`}
                trigger={
                  <IconButton
                    label={`Actions pour ${u.name}`}
                    icon={<MoreVertical />}
                  />
                }
                items={[
                  {
                    label: "Confirmer cette récurrence",
                    onSelect: () => undefined,
                  },
                  { label: "Modifier le montant", onSelect: () => undefined },
                  { label: "Voir l’historique", onSelect: () => undefined },
                  { type: "separator" },
                  {
                    label: "Ignorer cette occurrence",
                    onSelect: () => undefined,
                    destructive: true,
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      </CardShell>

      <CardShell palette="yellow" title="Cette semaine" className="kit-span-4">
        <div className="kit-hero-row">
          <Money value={17_000} size="xl" tone="none" />
          <span>d’ici dim. 18 oct.</span>
        </div>
        <SegmentBar
          label="Enveloppes de la semaine"
          paid={10_000}
          committed={8_000}
          possible={17_000}
        />
      </CardShell>

      <CardShell title="Où part l’argent" className="kit-span-4">
        <RankedBars
          label="Dépenses par catégorie"
          rows={data.spending.slice(0, 5)}
          onSelect={() => undefined}
        />
      </CardShell>

      <CardShell
        title="Comptes"
        className="kit-span-4"
        footer={<AccountsTotal />}
      >
        <ul className="kit-accounts">
          {data.accounts.map((a, i) => (
            <li key={a.id}>
              <span className="kit-account-name">
                <CategoryDot color={a.color} size={10} />
                <EditableText
                  value={a.name}
                  label={`Nom du compte ${a.name}`}
                  onCommit={() => wait(200)}
                />
              </span>
              <Sparkline
                label={`Solde ${a.name} sur 20 jours`}
                values={data.sparkValues(i + 1)}
                height={28}
              />
              <span className="kit-account-amount">
                <Money value={a.balance} size="s" tone="none" />
                <span className="mono muted">
                  {a.observed >= "2026-10-07"
                    ? `observé le ${formatDay(a.observed)}`
                    : "à actualiser"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardShell>

      <CardShell title="Entrées et sorties" className="kit-span-12">
        <DivergingBars
          label="Entrées et sorties par mois budgétaire"
          data={data.flows}
          onSelect={() => undefined}
        />
      </CardShell>
    </div>
  );
}

function AccountsTotal() {
  return (
    <div className="kit-footer-line">
      <span>Total foyer</span>
      <Money value={244_000} size="s" tone="none" />
    </div>
  );
}

/* Controls ---------------------------------------------------------------- */

function Controls() {
  const [density, setDensity] = useState<
    "compact" | "standard" | "comfortable"
  >("standard");
  const [type, setType] = useState("all");
  const [account, setAccount] = useState("household");
  const [palette, setPalette] = useState<CardPaletteId>("paper");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  return (
    <div className="kit-stack">
      <div className="kit-row">
        <Button variant="primary" icon={<Plus aria-hidden />}>
          Ajouter
        </Button>
        <Button variant="accent" size="m" iconEnd={<Plus aria-hidden />}>
          Ajouter 70 €
        </Button>
        <Button variant="outline" iconEnd={<ArrowUpRight aria-hidden />}>
          Voir le calcul
        </Button>
        <Button variant="ghost">Annuler</Button>
        <Button variant="danger" icon={<Trash2 aria-hidden />}>
          Remplacer mes données
        </Button>
        <Button variant="primary" loading>
          Enregistrement
        </Button>
        <Button variant="outline" disabledReason="Déjà au mois le plus récent">
          Mois suivant
        </Button>
        <IconButton label="Options" icon={<MoreVertical />} />
        <IconButton label="Télécharger" icon={<Download />} variant="outline" />
        <IconButton
          label="Ajouter une carte"
          icon={<Plus />}
          variant="primary"
        />
      </div>
      <div className="kit-row">
        <Segmented
          label="Type d’opération"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "Tout" },
            { value: "out", label: "Dépenses" },
            { value: "in", label: "Revenus" },
            { value: "transfer", label: "Virements" },
          ]}
        />
        <Segmented
          label="Densité"
          size="compact"
          value={density}
          onChange={setDensity}
          options={[
            { value: "compact", label: <Rows4 />, ariaLabel: "Compacte" },
            { value: "standard", label: <Rows3 />, ariaLabel: "Standard" },
            {
              value: "comfortable",
              label: <Rows2 />,
              ariaLabel: "Confortable",
            },
          ]}
        />
        <Picker
          label="Compte"
          value={account}
          onValueChange={setAccount}
          options={[
            { value: "household", label: "Foyer (3 comptes)", meta: "2 440 €" },
            ...data.accounts.map((a) => ({
              value: a.id,
              label: a.name,
              meta: formatEuro(a.balance, { cents: "never" }),
            })),
          ]}
        />
        <Menu
          label="Actions de carte"
          trigger={
            <Button variant="outline" iconEnd={<MoreVertical aria-hidden />}>
              Carte
            </Button>
          }
          items={[
            { type: "label", label: "Déplacer" },
            { label: "Déplacer au début", onSelect: () => undefined },
            { label: "Monter", onSelect: () => undefined },
            { label: "Descendre", onSelect: () => undefined, meta: "Alt ↓" },
            {
              label: "Déplacer à la fin",
              onSelect: () => undefined,
              disabledReason: "Déjà en dernier",
            },
            { type: "separator" },
            {
              label: "Retirer la carte",
              onSelect: () => undefined,
              destructive: true,
              icon: <Trash2 />,
            },
          ]}
        />
        <Popover
          label="Palette de la carte"
          trigger={
            <Button variant="outline" icon={<Palette aria-hidden />}>
              {paletteNames[palette]}
            </Button>
          }
        >
          <div className="kit-swatches" role="group" aria-label="Palettes">
            {cardPaletteIds.map((id) => (
              <PopoverClose asChild key={id}>
                <button
                  type="button"
                  className={`kit-swatch palette-${id}`}
                  aria-label={paletteNames[id]}
                  aria-pressed={palette === id}
                  title={paletteNames[id]}
                  onClick={() => setPalette(id)}
                />
              </PopoverClose>
            ))}
          </div>
        </Popover>
        <Dialog
          title="Annuler cet import ?"
          description="142 opérations du lot « releve-oct.csv » seront supprimées."
          trigger={<Button variant="outline">Dialog</Button>}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Garder</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="danger">Supprimer 142 opérations</Button>
              </DialogClose>
            </>
          }
        />
        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Ajouter une carte"
          trigger={<Button variant="outline">Panneau latéral</Button>}
          toolbar={
            <Field
              label="Rechercher"
              placeholder="Solde, enveloppes…"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          }
          footer={
            <Button variant="ghost">Rétablir la disposition par défaut</Button>
          }
        >
          <ul className="kit-sheet-list">
            {[
              "Solde",
              "Disponible",
              "Cette semaine",
              "Enveloppes",
              "À venir",
              "Entrées et sorties",
              "Où part l’argent",
            ]
              .filter((name) =>
                name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((name) => (
                <li key={name}>
                  <span>
                    <strong>{name}</strong>
                    <span className="mono muted">⅓ · ½ · ⅔</span>
                  </span>
                  <Button variant="primary" onClick={() => setSheetOpen(false)}>
                    Ajouter
                  </Button>
                </li>
              ))}
          </ul>
        </Sheet>
      </div>
      <div className="kit-dock-demo">
        <span className="mono">Dock · menus vers le haut</span>
        <Picker
          variant="dock"
          side="top"
          label="Compte du dock"
          value={account}
          onValueChange={setAccount}
          options={[
            { value: "household", label: "Foyer (3 comptes)", meta: "2 440 €" },
            ...data.accounts.map((a) => ({
              value: a.id,
              label: a.name,
              meta: formatEuro(a.balance, { cents: "never" }),
            })),
          ]}
        />
        <Menu
          side="top"
          align="start"
          label="Exporter"
          trigger={
            <Button
              className="kit-dock-button"
              variant="ghost"
              icon={<Download aria-hidden />}
            >
              Exporter
            </Button>
          }
          items={[
            { label: "Résultat filtré (248)", onSelect: () => undefined },
            { label: "Sélection (12)", onSelect: () => undefined },
          ]}
        />
      </div>
      <div className="kit-fields">
        <Field
          label="Montant"
          inputMode="decimal"
          placeholder="35"
          hint="Payé par Alex"
        />
        <Field label="Date" type="date" defaultValue={data.TODAY} />
        <Field label="Montant" defaultValue="12,345" error="Montant invalide" />
        <Field label="Catégorie">
          {(control) => (
            <Picker
              label="Catégorie"
              value="restaurants"
              onValueChange={() => undefined}
              options={Object.entries(data.categories).map(([value, c]) => ({
                value,
                label: c.label,
              }))}
              className="kit-field-picker"
              {...control}
            />
          )}
        </Field>
      </div>
    </div>
  );
}

/* Values -------------------------------------------------------------------- */

function Values() {
  const [allocated, setAllocated] = useState<number | null>(20_000);
  const [label, setLabel] = useState("Courses du quotidien");
  return (
    <div className="kit-values">
      <div className="kit-money-scale">
        <Money value={125_000} size="hero" tone="none" />
        <Money value={244_000} size="xl" tone="none" />
        <Money value={-12_000} size="l" />
        <Money value={141_800} size="m" signed />
        <Money value={3_450} size="s" />
        <Money value={-8_620} size="text" />
        <Money value={null} size="s" unknownReason="Aucun solde observé" />
      </div>
      <div className="kit-stack">
        <div className="kit-edit-line">
          <span>Alloué</span>
          <EditableMoney
            value={allocated}
            size="s"
            label="Alloué Courses"
            allowEmpty
            validate={(value) => (value < 0 ? "Montant positif attendu" : null)}
            onCommit={async (next) => {
              await wait(300);
              if (next === 66_600) throw new Error("Écriture refusée");
              setAllocated(next);
            }}
          />
          <span className="mono muted">
            Entrée · Tab · Échap · vide = supprimer
          </span>
        </div>
        <div className="kit-edit-line">
          <span>Libellé</span>
          <EditableText
            value={label}
            label="Libellé de l’enveloppe"
            onCommit={(next) => setLabel(next)}
          />
        </div>
        <div className="kit-row">
          <Badge>Neutre</Badge>
          <Badge tone="estimated">Estimé</Badge>
          <Badge tone="positive">Confirmé</Badge>
          <Badge tone="negative">−42 %</Badge>
          <Badge tone="new">Nouvelle</Badge>
          <Badge tone="duplicate">Doublon</Badge>
          <Badge tone="error">Erreur</Badge>
          <Badge tone="warning">+42 % vs habitude</Badge>
        </div>
        <div className="kit-row">
          <DateChip date="2026-10-15" soon />
          <DateChip date="2026-10-26" />
          <MerchantLogo
            name="Free"
            color="#9ccbef"
            src="/merchant-assets/free.png"
          />
          <MerchantLogo name="Carrefour" color="#f3c447" />
          <MerchantLogo name="SNCF" color="#21a9c0" icon={ShoppingCart} />
          <MerchantLogo
            name="Inconnu"
            color="#4d473f"
            src="/merchant-assets/absent.png"
          />
          <CategoryDot color="var(--series-3)" label="Restaurants" />
          <CategoryDot color="var(--series-2)" size={12} />
        </div>
        <div className="kit-progress">
          <ProgressBar
            label="Courses"
            paid={7_000}
            committed={6_000}
            total={20_000}
            color="var(--series-1)"
            showPercent
          />
          <ProgressBar
            label="Loisirs"
            paid={9_500}
            total={8_000}
            color="var(--series-7)"
            showPercent
          />
          <ProgressBar
            label="Santé"
            paid={0}
            total={4_000}
            color="var(--series-6)"
            showPercent
          />
        </div>
      </div>
    </div>
  );
}

/* Feedback ----------------------------------------------------------------- */

function Crash({ crash }: { crash: boolean }) {
  if (crash) throw new Error("kit crash");
  return <p className="muted">Carte en bonne santé</p>;
}

function Feedback() {
  const [crash, setCrash] = useState(false);
  return (
    <div className="kit-feedback">
      <CardShell title="Chargement" headingLevel={3}>
        <Skeleton height={40} width="60%" />
        <Skeleton height={180} shape="tile" />
        <Skeleton height={14} width="40%" />
      </CardShell>
      <CardShell title="Vide" headingLevel={3}>
        <Empty action={<Button variant="outline">Créer</Button>}>
          Aucune enveloppe
        </Empty>
        <Empty>Rien à traiter ✓</Empty>
      </CardShell>
      <CardShell
        title="Erreur"
        headingLevel={3}
        actions={
          <Button variant="ghost" onClick={() => setCrash(true)}>
            Casser
          </Button>
        }
      >
        <ErrorBoundary key={String(crash)}>
          <Crash crash={crash} />
        </ErrorBoundary>
      </CardShell>
      <div className="kit-toasts">
        <ToastView
          message="Carte retirée"
          action={{ label: "Annuler", onClick: () => undefined }}
          onClose={() => undefined}
        />
        <ToastView
          message="Disposition enregistrée"
          onClose={() => undefined}
        />
        <ToastView
          tone="error"
          message="Écriture impossible · réessayer"
          onClose={() => undefined}
        />
      </div>
    </div>
  );
}

/* Charts ------------------------------------------------------------------- */

function LineWidths() {
  const series = data.balanceSeries();
  return (
    <div className="kit-widths">
      {[320, 560, 0].map((width) => (
        <div
          key={width}
          style={width ? { width } : undefined}
          className="kit-width-frame"
        >
          <CardShell
            title={width ? `${width} px` : "Pleine largeur"}
            headingLevel={3}
          >
            <LineChart
              label={`Solde, démonstration ${width || "large"}`}
              series={series}
              band={data.balanceBand(series)}
              threshold={{ value: 120_000, label: "Réserve 1 200 €" }}
              today={data.TODAY}
              annotations={data.balanceAnnotations}
            />
          </CardShell>
        </div>
      ))}
    </div>
  );
}

function Charts() {
  const [day, setDay] = useState<string | null>(null);
  const [reserve, setReserve] = useState(120_000);
  return (
    <div className="kit-grid">
      <CardShell title="Frise 7 jours" className="kit-span-12">
        <DayStrip
          label="Semaine du 12 au 18 oct."
          days={data.week}
          today={data.TODAY}
          selected={day}
          onSelect={(d) => setDay(d === day ? null : d)}
        />
      </CardShell>
      <CardShell title="Frise étroite" className="kit-span-4">
        <DayStrip
          label="Semaine, vue liste"
          days={data.week}
          today={data.TODAY}
        />
      </CardShell>
      <CardShell title="Calcul du disponible" className="kit-span-4">
        <Waterfall
          label="Cascade du disponible"
          rows={data.availableRows(reserve).map((row) =>
            row.key === "reserve"
              ? {
                  ...row,
                  amount: (
                    <EditableMoney
                      value={reserve}
                      size="s"
                      label="Réserve"
                      onCommit={(v) => setReserve(v ?? 0)}
                    />
                  ),
                }
              : row,
          )}
        />
      </CardShell>
      <CardShell title="Où part l’argent" className="kit-span-4">
        <RankedBars label="Toutes les catégories" rows={data.spending} />
      </CardShell>
      <CardShell
        palette="ink"
        eyebrow="Cette semaine · 12 – 18 oct."
        className="kit-span-6"
      >
        <Money value={17_000} size="xl" tone="none" className="kit-highlight" />
        <SegmentBar
          label="Semaine"
          paid={10_000}
          committed={8_000}
          possible={17_000}
        />
      </CardShell>
      <CardShell title="Sparkline" className="kit-span-6">
        <Sparkline label="Solde Joint" values={data.sparkValues(2)} />
        <Sparkline
          label="Solde avec lacune"
          values={[
            ...data.sparkValues(3).slice(0, 8),
            null,
            null,
            ...data.sparkValues(3).slice(10),
          ]}
          height={48}
        />
      </CardShell>
    </div>
  );
}

/* Palettes ----------------------------------------------------------------- */

function PaletteGrid() {
  const [mode, setMode] = useState("month");
  return (
    <div className="kit-palettes">
      {cardPaletteIds.map((id) => (
        <CardShell
          key={id}
          palette={id}
          title={paletteNames[id]}
          headingLevel={3}
          actions={
            <Segmented
              label={`Période ${paletteNames[id]}`}
              size="compact"
              value={mode}
              onChange={setMode}
              options={[
                { value: "month", label: "Mois" },
                { value: "week", label: "Sem." },
              ]}
            />
          }
        >
          <div className="kit-hero-row">
            <Money
              value={125_000}
              size="l"
              tone="none"
              className="kit-highlight"
            />
            <Money value={-4_200} size="text" />
            <Money value={11_200} size="text" signed />
          </div>
          <div className="kit-progress">
            {data.envelopes.slice(0, 3).map((e) => (
              <ProgressBar
                key={e.key}
                label={e.label}
                paid={e.paid}
                committed={e.committed}
                total={e.allocated}
                color={e.color}
                showPercent
              />
            ))}
          </div>
          <LineChart
            label={`Solde, palette ${paletteNames[id]}`}
            series={data.balanceSeries()}
            threshold={{ value: 120_000, label: "Réserve" }}
            today={data.TODAY}
            height={90}
          />
          <div className="kit-row">
            <Button variant="primary">Primaire</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="outline">Contour</Button>
            <Badge tone="estimated">Estimé</Badge>
          </div>
          <p className="mono muted">Méta · observé le 13 oct.</p>
        </CardShell>
      ))}
    </div>
  );
}

/* Sortable ----------------------------------------------------------------- */

const demoCards = [
  { id: "balance", name: "Solde", span: 8, height: 220 },
  { id: "available", name: "Disponible", span: 4, height: 220 },
  { id: "envelopes", name: "Enveloppes", span: 6, height: 300 },
  { id: "upcoming", name: "À venir", span: 6, height: 260 },
  { id: "week", name: "Cette semaine", span: 4, height: 180 },
  { id: "spending", name: "Où part l’argent", span: 4, height: 240 },
  { id: "inbox", name: "À traiter", span: 4, height: 140 },
  { id: "recent", name: "Opérations", span: 12, height: 200 },
] as const;
type DemoId = (typeof demoCards)[number]["id"];
const demoName = (id: string) => demoCards.find((c) => c.id === id)?.name ?? id;

function SortableGrid() {
  const [ids, setIds] = useState<DemoId[]>(demoCards.map((c) => c.id));
  const sortable = useSortable({
    ids,
    onCommit: setIds,
    axis: "grid",
    label: demoName,
  });
  return (
    <>
      <p className="mono muted kit-order" data-testid="grid-order">
        {ids.join(" · ")}
      </p>
      <div className="kit-grid" data-testid="sort-grid">
        {sortable.order.map((id, index) => {
          const card = demoCards.find((c) => c.id === id)!;
          const item = sortable.getItemProps(id);
          return (
            <div
              key={id}
              className={`kit-sort-card kit-span-${card.span}`}
              {...item}
              style={{ ...item.style, minHeight: card.height }}
            >
              <CardShell
                palette={index % 5 === 1 ? "ink" : undefined}
                className="kit-sort-shell"
              >
                <div className="kit-editbar">
                  <button
                    type="button"
                    className="kit-handle"
                    {...sortable.getHandleProps(id)}
                  >
                    <GripVertical aria-hidden />
                  </button>
                  <span className="kit-editbar-name">{card.name}</span>
                  <Menu
                    label={`Déplacer ${card.name}`}
                    trigger={
                      <IconButton
                        label={`Menu de ${card.name}`}
                        icon={<MoreVertical />}
                      />
                    }
                    items={[
                      {
                        label: "Déplacer au début",
                        onSelect: () => setIds(moveItem(ids, id, 0)),
                      },
                      {
                        label: "Monter",
                        onSelect: () =>
                          setIds(moveItem(ids, id, ids.indexOf(id) - 1)),
                      },
                      {
                        label: "Descendre",
                        onSelect: () =>
                          setIds(moveItem(ids, id, ids.indexOf(id) + 1)),
                      },
                      {
                        label: "Déplacer à la fin",
                        onSelect: () => setIds(moveItem(ids, id, ids.length)),
                      },
                    ]}
                  />
                </div>
                <div className="kit-sort-body" inert>
                  <Money value={(index + 2) * 41_000} size="m" tone="none" />
                  <span className="mono muted">{card.span}/12</span>
                </div>
              </CardShell>
            </div>
          );
        })}
      </div>
      {sortable.placeholder}
      {sortable.status}
    </>
  );
}

function SortableList() {
  const [ids, setIds] = useState(data.envelopes.map((e) => e.key));
  const sortable = useSortable({
    ids,
    onCommit: setIds,
    axis: "y",
    label: (id) => data.envelopes.find((e) => e.key === id)?.label ?? id,
  });
  return (
    <CardShell title="Enveloppes" className="kit-sort-list-card">
      <p className="mono muted" data-testid="list-order">
        {ids.join(" · ")}
      </p>
      <ul className="kit-sort-list" data-testid="sort-list">
        {sortable.order.map((id) => {
          const e = data.envelopes.find((x) => x.key === id)!;
          return (
            <li
              key={id}
              {...sortable.getItemProps(id)}
              onKeyDown={(event) => {
                if (
                  !event.altKey ||
                  (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                )
                  return;
                event.preventDefault();
                setIds(
                  moveItem(
                    ids,
                    id,
                    ids.indexOf(id) + (event.key === "ArrowUp" ? -1 : 1),
                  ),
                );
              }}
            >
              <button
                type="button"
                className="kit-handle"
                {...sortable.getHandleProps(id)}
              >
                <GripVertical aria-hidden />
              </button>
              <CategoryDot color={e.color} size={12} />
              <span className="kit-envelope-name">{e.label}</span>
              <ProgressBar
                label={e.label}
                paid={e.paid}
                committed={e.committed}
                total={e.allocated}
                color={e.color}
              />
              <Money value={e.allocated - e.paid - e.committed} size="s" />
            </li>
          );
        })}
      </ul>
      {sortable.placeholder}
      {sortable.status}
    </CardShell>
  );
}
