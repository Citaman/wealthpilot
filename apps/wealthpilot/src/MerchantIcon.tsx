import { useState } from "react";
import {
  ShoppingBasket,
  Utensils,
  TrainFront,
  Music2,
  House,
  Store,
  Landmark,
  HeartPulse,
  FlaskConical,
  Coffee,
  Fuel,
  Car,
  Wifi,
  Smartphone,
  Gamepad2,
  Shirt,
  GraduationCap,
  Baby,
  PawPrint,
  Plane,
  ShieldCheck,
  Dumbbell,
  Gift,
  Zap,
  ArrowLeftRight,
  Stethoscope,
  Pill,
  Film,
  type LucideIcon,
} from "lucide-react";
import { brandFor } from "./merchants";
import { normalize } from "./search";
const categories: [RegExp, LucideIcon, string, string][] = [
  [/laborat|analyse|biolog/, FlaskConical, "lavender", "Laboratoire"],
  [/pharm|medicament|pharmacy/, Pill, "mint", "Pharmacie"],
  [/dent|medec|doctor|consult/, Stethoscope, "mint", "Soins"],
  [/sante|health|hospital/, HeartPulse, "pink", "Santé"],
  [/cafe|coffee|boulanger|bakery/, Coffee, "sand", "Café et boulangerie"],
  [
    /restaurant|mcdo|mcdonald|macdonald|food delivery|restaur|fast food/,
    Utensils,
    "pink",
    "Restaurant",
  ],
  [
    /courses|grocer|supermar|aliment|carrefour|lidl|auchan/,
    ShoppingBasket,
    "yellow",
    "Courses",
  ],
  [/carburant|fuel|essence|station/, Fuel, "sand", "Carburant"],
  [/train|sncf|metro|transport/, TrainFront, "cyan", "Transport"],
  [/voiture|car |parking|garage|auto/, Car, "cyan", "Voiture"],
  [/avion|flight|travel|voyage/, Plane, "cyan", "Voyage"],
  [/internet|wifi|telecom|broadband/, Wifi, "lavender", "Internet"],
  [/telephone|mobile|phone/, Smartphone, "lavender", "Téléphone"],
  [/netflix|cinema|film|video/, Film, "pink", "Cinéma et vidéo"],
  [/spotify|music|musique/, Music2, "mint", "Musique"],
  [/jeu|gaming|game/, Gamepad2, "lavender", "Jeux"],
  [/vetement|cloth|fashion|shopping/, Shirt, "pink", "Vêtements"],
  [/education|scolar|ecole|school/, GraduationCap, "yellow", "Éducation"],
  [/enfant|baby|child/, Baby, "pink", "Enfants"],
  [/animal|pet|veterin/, PawPrint, "sand", "Animaux"],
  [/sport|fitness|gym/, Dumbbell, "mint", "Sport"],
  [/cadeau|gift|donation/, Gift, "pink", "Cadeaux"],
  [/energie|electric|gaz|utility/, Zap, "yellow", "Énergie"],
  [/assurance|insurance/, ShieldCheck, "mint", "Assurance"],
  [/loyer|logement|rent|housing/, House, "sand", "Logement"],
  [/virement|transfer/, ArrowLeftRight, "cyan", "Virement"],
  [
    /salaire|revenu|salary|income|tax|impot|banque|cyberbank|cyberban/,
    Landmark,
    "mint",
    "Finances",
  ],
];
export function MerchantIcon({
  name,
  category = "",
  subcategory = "",
}: {
  name: string;
  category?: string;
  subcategory?: string;
}) {
  const [failed, setFailed] = useState("");
  const brand = brandFor(name);
  const match =
    categories.find(([pattern]) => pattern.test(normalize(subcategory))) ??
    categories.find(([pattern]) =>
      pattern.test(normalize(category + " " + name)),
    );
  const [, Icon, tone, label] = match ?? [/.*/, Store, "sand", "Commerce"];
  return (
    <span
      className={
        "merchant-icon merchant-" +
        (brand && failed !== brand.slug ? "brand" : tone)
      }
      title={brand?.title ?? label}
    >
      {brand && failed !== brand.slug ? (
        <img
          src={brand.src ?? "/brands/" + brand.slug + ".svg"}
          alt=""
          width="24"
          height="24"
          loading="lazy"
          onError={() => setFailed(brand.slug)}
        />
      ) : (
        <Icon size={21} strokeWidth={1.7} />
      )}
    </span>
  );
}
