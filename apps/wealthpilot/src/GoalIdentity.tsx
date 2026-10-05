import {
  Target,
  House,
  Smartphone,
  Car,
  Plane,
  ShieldCheck,
  GraduationCap,
  Baby,
  Laptop,
  Heart,
  Armchair,
  Bath,
  BedDouble,
  Building2,
  CookingPot,
  DoorOpen,
  Hammer,
  KeyRound,
  Lamp,
  Sofa,
  Bike,
  Bus,
  Caravan,
  Compass,
  Fuel,
  Luggage,
  Map,
  Mountain,
  Sailboat,
  TrainFront,
  BookOpen,
  BriefcaseBusiness,
  Camera,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gift,
  Guitar,
  Headphones,
  Music,
  Monitor,
  Printer,
  Tablet,
  Tv,
  Watch,
  Wifi,
  Wrench,
  Palette,
  Pencil,
  ShoppingBag,
  Cat,
  Dog,
  Flower2,
  Leaf,
  PawPrint,
  Sprout,
  Stethoscope,
  Tent,
  Umbrella,
  Users,
  Wallet,
  PiggyBank,
  Landmark,
  CircleDollarSign,
  Gem,
  Star,
  Trophy,
  Sparkles,
  Cake,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { Goal } from "./types";
import { useState, type CSSProperties } from "react";
import "./goal-controls.css";
export const goalIcons: Record<
  string,
  { label: string; icon: LucideIcon; group?: string }
> = {
  target: { label: "Projet", icon: Target },
  house: { label: "Maison", icon: House },
  phone: { label: "Téléphone", icon: Smartphone },
  car: { label: "Voiture", icon: Car },
  travel: { label: "Voyage", icon: Plane },
  safety: { label: "Sécurité", icon: ShieldCheck },
  education: { label: "Études", icon: GraduationCap },
  child: { label: "Enfant", icon: Baby },
  computer: { label: "Ordinateur", icon: Laptop },
  heart: { label: "Bien-être", icon: Heart },
  armchair: { label: "Fauteuil", icon: Armchair, group: "Maison" },
  bath: { label: "Salle de bain", icon: Bath, group: "Maison" },
  bed: { label: "Literie", icon: BedDouble, group: "Maison" },
  building: { label: "Appartement", icon: Building2, group: "Maison" },
  cooking: { label: "Cuisine", icon: CookingPot, group: "Maison" },
  door: { label: "Déménagement", icon: DoorOpen, group: "Maison" },
  hammer: { label: "Travaux", icon: Hammer, group: "Maison" },
  key: { label: "Clés", icon: KeyRound, group: "Maison" },
  lamp: { label: "Éclairage", icon: Lamp, group: "Maison" },
  sofa: { label: "Canapé", icon: Sofa, group: "Maison" },
  bike: { label: "Vélo", icon: Bike, group: "Voyages" },
  bus: { label: "Bus", icon: Bus, group: "Voyages" },
  caravan: { label: "Caravane", icon: Caravan, group: "Voyages" },
  compass: { label: "Aventure", icon: Compass, group: "Voyages" },
  fuel: { label: "Carburant", icon: Fuel, group: "Voyages" },
  luggage: { label: "Bagages", icon: Luggage, group: "Voyages" },
  map: { label: "Escapade", icon: Map, group: "Voyages" },
  mountain: { label: "Montagne", icon: Mountain, group: "Voyages" },
  boat: { label: "Bateau", icon: Sailboat, group: "Voyages" },
  train: { label: "Train", icon: TrainFront, group: "Voyages" },
  book: { label: "Livres", icon: BookOpen, group: "Loisirs" },
  work: { label: "Entreprise", icon: BriefcaseBusiness, group: "Loisirs" },
  camera: { label: "Photo", icon: Camera, group: "Loisirs" },
  coffee: { label: "Café", icon: Coffee, group: "Loisirs" },
  sport: { label: "Sport", icon: Dumbbell, group: "Loisirs" },
  games: { label: "Jeux vidéo", icon: Gamepad2, group: "Loisirs" },
  gift: { label: "Cadeaux", icon: Gift, group: "Loisirs" },
  guitar: { label: "Guitare", icon: Guitar, group: "Loisirs" },
  headphones: { label: "Casque audio", icon: Headphones, group: "Loisirs" },
  music: { label: "Musique", icon: Music, group: "Loisirs" },
  monitor: { label: "Écran", icon: Monitor, group: "Équipement" },
  printer: { label: "Imprimante", icon: Printer, group: "Équipement" },
  tablet: { label: "Tablette", icon: Tablet, group: "Équipement" },
  tv: { label: "Télévision", icon: Tv, group: "Équipement" },
  watch: { label: "Montre", icon: Watch, group: "Équipement" },
  wifi: { label: "Internet", icon: Wifi, group: "Équipement" },
  wrench: { label: "Réparation", icon: Wrench, group: "Équipement" },
  art: { label: "Art", icon: Palette, group: "Équipement" },
  pencil: { label: "Fournitures", icon: Pencil, group: "Équipement" },
  shopping: { label: "Achats", icon: ShoppingBag, group: "Équipement" },
  cat: { label: "Chat", icon: Cat, group: "Famille" },
  dog: { label: "Chien", icon: Dog, group: "Famille" },
  flower: { label: "Fleurs", icon: Flower2, group: "Famille" },
  leaf: { label: "Écologie", icon: Leaf, group: "Famille" },
  pet: { label: "Animaux", icon: PawPrint, group: "Famille" },
  garden: { label: "Jardin", icon: Sprout, group: "Famille" },
  health: { label: "Santé", icon: Stethoscope, group: "Famille" },
  camping: { label: "Camping", icon: Tent, group: "Famille" },
  umbrella: { label: "Imprévus", icon: Umbrella, group: "Famille" },
  family: { label: "Famille", icon: Users, group: "Famille" },
  wallet: { label: "Portefeuille", icon: Wallet, group: "Épargne" },
  piggy: { label: "Tirelire", icon: PiggyBank, group: "Épargne" },
  bank: { label: "Banque", icon: Landmark, group: "Épargne" },
  money: { label: "Financement", icon: CircleDollarSign, group: "Épargne" },
  gem: { label: "Bijoux", icon: Gem, group: "Épargne" },
  star: { label: "Rêve", icon: Star, group: "Épargne" },
  trophy: { label: "Réussite", icon: Trophy, group: "Épargne" },
  sparkles: { label: "Plaisir", icon: Sparkles, group: "Épargne" },
  cake: { label: "Anniversaire", icon: Cake, group: "Épargne" },
  food: { label: "Restaurant", icon: Utensils, group: "Épargne" },
};
export const goalColors = [
  "#9b446f",
  "#187080",
  "#7552a4",
  "#a34d27",
  "#356d51",
  "#3e5d9b",
  "#25221d",
  "#67635b",
  "#afa89b",
  "#e5ddc8",
  "#f0c34a",
  "#8b701e",
  "#e88226",
  "#f4ad76",
  "#d64045",
  "#76272e",
  "#ed91c8",
  "#5c294c",
  "#b490de",
  "#45326c",
  "#65a2df",
  "#203f64",
  "#40bfbe",
  "#0b454b",
  "#8cba58",
  "#364a1f",
  "#aed6a6",
  "#c6bc63",
];
export function goalForeground(color: string) {
  if (!/^#[\da-f]{6}$/i.test(color)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
export function goalAppearance(color = goalColors[0]): CSSProperties {
  return {
    "--project-accent": color,
    "--project-foreground": goalForeground(color),
  } as CSSProperties;
}
export function GoalAppearance({
  goal,
  change,
}: {
  goal: Goal;
  change: (key: "icon" | "color", value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const entries = Object.entries(goalIcons).filter(([, item]) =>
    normalize(item.label + " " + (item.group ?? "Essentiels")).includes(
      normalize(query),
    ),
  );
  const groups = [
    ...new Set(entries.map(([, item]) => item.group ?? "Essentiels")),
  ];
  return (
    <details className="project-appearance">
      <summary>Icône et couleur</summary>
      <div className="project-appearance-grid">
        <section aria-label="Choisir une icône">
          <label className="project-icon-search">
            Rechercher une icône
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Maison, vélo, santé…"
            />
          </label>
          <button
            type="button"
            className="button compact"
            aria-pressed={goal.icon === "none"}
            onClick={() => change("icon", "none")}
          >
            Sans icône
          </button>
          <div className="project-icon-library">
            {groups.map((group) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                <div className="goal-icon-options">
                  {entries
                    .filter(
                      ([, item]) => (item.group ?? "Essentiels") === group,
                    )
                    .map(([key, { label, icon: Icon }]) => (
                      <button
                        type="button"
                        key={key}
                        title={label}
                        aria-label={"Icône " + label}
                        aria-pressed={(goal.icon ?? "target") === key}
                        onClick={() => change("icon", key)}
                      >
                        <Icon size={20} />
                        <small>{label}</small>
                      </button>
                    ))}
                </div>
              </fieldset>
            ))}
            {!entries.length && (
              <p role="status">Aucune icône ne correspond à cette recherche.</p>
            )}
          </div>
        </section>
        <section aria-label="Choisir une couleur">
          <p>Couleur du projet</p>
          <div className="goal-color-options">
            {goalColors.map((color, i) => (
              <button
                type="button"
                key={color}
                style={{ background: color, color: goalForeground(color) }}
                aria-label={"Couleur du projet " + (i + 1)}
                title={color}
                aria-pressed={(goal.color ?? goalColors[0]) === color}
                onClick={() => change("color", color)}
              >
                {(goal.color ?? goalColors[0]) === color ? "✓" : ""}
              </button>
            ))}
          </div>
          <label className="project-custom-color">
            Couleur personnalisée
            <input
              type="color"
              value={goal.color ?? goalColors[0]}
              onChange={(e) => change("color", e.target.value)}
            />
          </label>
          <small>Le contraste de l’icône s’adapte automatiquement.</small>
        </section>
      </div>
    </details>
  );
}
export function GoalIdentity({
  goal,
  size = 22,
}: {
  goal: Goal;
  size?: number;
}) {
  if (goal.icon === "none") return null;
  const Icon = goalIcons[goal.icon ?? "target"]?.icon ?? Target;
  return (
    <span
      className="goal-identity"
      aria-hidden="true"
      style={{
        background: goal.color ?? goalColors[0],
        color: goalForeground(goal.color ?? goalColors[0]),
      }}
    >
      <Icon size={size} />
    </span>
  );
}
