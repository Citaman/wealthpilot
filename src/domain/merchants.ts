import brands from "../brands.generated.json";
import localBrands from "../merchant-assets.json";
import { normalize } from "./search";
export type Brand = (typeof brands)[number] & { src?: string };
const catalog = [...localBrands, ...brands].map((b) => ({
  ...b,
  key: normalize(b.title).replace(/ /g, ""),
  slugKey: normalize(b.slug).replace(/ /g, ""),
  phrase: normalize(b.title),
}));
const cache = new Map<string, Brand | null>();
export function brandFor(name: string): Brand | null {
  const normalized = normalize(name),
    cached = cache.get(normalized);
  if (cached !== undefined) return cached;
  // A payment processor is not the merchant; ambiguous combined exports stay generic.
  if (
    /\b(shein\s+temu|temu\s+shein)\b/.test(normalized) ||
    /^(virement|vir|remboursement) (de |a |pour )/.test(normalized)
  )
    return null;
  const words = normalized.split(" "),
    compact = words.join("");
  const aliases: [RegExp, string][] = [
    [/(^| )(amazon|amzn)( |$)/, "amazon"],
    [/(^| )g20( |$)/, "g20"],
    [
      /(^| )(free mobile|free telecom|free haut debit|free ?box)( |$)|^free$/,
      "free-fr",
    ],
    [
      /(^| )(societe generale|socgen)( |$)|^(?:ag )?sg(?: |$)/,
      "societe-generale",
    ],
    [/^(cb |carte )?bk( |$)/, "burgerking"],
    [/(^| )(mcdo|macdonalds?|mc ?donalds?)( |s |$|\d)/, "mcdonalds"],
    [/^carref(?:our)?(?: |$)/, "carrefour"],
    [/^(?:e )?leclerc(?: |$)/, "edotleclerc"],
    [/^(?:h et m|hetm|h m)(?: |$)/, "handm"],
    [/^(?:jd|jdf)(?: paris| creteil| sports|$)/, "jdsports"],
    [/^total(?: energies| \d|$)/, "totalenergies"],
    [/^navigo(?: |$)/, "idfm"],
    [/^5 ?a ?sec(?: |$)/, "5asec"],
    [/^pathe(?: |$)/, "pathe"],
    [/^kiabi(?: |$)/, "kiabi"],
    [/^chaussea(?: |$)/, "chaussea"],
  ];
  const alias = aliases.find(([pattern]) => pattern.test(normalized));
  if (alias) {
    const brand = catalog.find((b) => b.slug === alias[1]) ?? null;
    cache.set(normalized, brand);
    return brand;
  }
  // Exact brand words are deliberate: approximate names must not borrow an unrelated trademark.
  const result =
    catalog
      .filter(
        (b) =>
          (!["square", "sumup", "paypal"].includes(b.slug) ||
            compact === b.key) &&
          (!["paul", "normal", "action"].includes(b.slug) ||
            normalized === b.phrase ||
            new RegExp(
              `^${b.phrase} (paris|creteil|magasin|boutique|boulangerie)( |$)`,
            ).test(normalized)) &&
          (compact === b.key ||
            compact === b.slugKey ||
            (b.key.length >= 4 &&
              words.some((w) => w === b.key || w === b.slugKey)) ||
            (b.key.length >= 5 &&
              (" " + normalized + " ").includes(" " + b.phrase + " "))),
      )
      .sort((a, b) => b.key.length - a.key.length)[0] ?? null;
  cache.set(normalized, result);
  return result;
}
export function subcategoryOf(raw: Record<string, string>): string {
  return (
    Object.entries(raw).find(([key]) =>
      /^(subcategory|sub category|sous categorie)$/.test(normalize(key)),
    )?.[1] ?? ""
  );
}
