import type { CSSProperties } from "react";

export const cardPaletteIds = [
  "paper",
  "ink",
  "yellow",
  "pink",
  "cyan",
  "coral",
  "lavender",
  "plum",
  "midnight",
  "sage",
  "forest",
  "sand",
] as const;
export type CardPaletteId = (typeof cardPaletteIds)[number];

export interface CardPalette {
  label: string;
  dark: boolean;
  surface: string;
  raised: string;
  foreground: string;
  muted: string;
  border: string;
  track: string;
  accent: string;
  onAccent: string;
  hover: string;
  focus: string;
  positive: string;
  negative: string;
  series: readonly [string, string, string, string];
}

const rgb = (hex: string) =>
  [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
const hex = (values: number[]) =>
  `#${values.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
const luminance = (color: string) =>
  rgb(color)
    .map((channel) => channel / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    .reduce(
      (total, channel, index) =>
        total + channel * [0.2126, 0.7152, 0.0722][index],
      0,
    );

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Adjust only the rendered mark, never the persisted category/merchant color.
// Text, control outlines and chart marks have different contrast requirements.
export function contrastColor(
  color: string,
  surface: string,
  minimum = 3,
): string {
  if (!/^#[0-9a-f]{6}$/i.test(color) || !/^#[0-9a-f]{6}$/i.test(surface))
    return color;
  const original = rgb(color);
  const endpoint =
    contrastRatio("#ffffff", surface) > contrastRatio("#000000", surface)
      ? 255
      : 0;
  for (let step = 0; step <= 100; step++) {
    const adjusted = hex(
      original.map((channel) => channel + ((endpoint - channel) * step) / 100),
    );
    if (contrastRatio(adjusted, surface) >= minimum) return adjusted;
  }
  return endpoint === 255 ? "#ffffff" : "#000000";
}

type PaletteInput = Pick<
  CardPalette,
  | "label"
  | "dark"
  | "surface"
  | "raised"
  | "foreground"
  | "muted"
  | "accent"
  | "series"
>;
function palette(input: PaletteInput): CardPalette {
  const { surface, raised, dark } = input;
  const accent = contrastColor(input.accent, surface, 3);
  const onAccent =
    contrastRatio("#ffffff", accent) > contrastRatio("#25221d", accent)
      ? "#ffffff"
      : "#25221d";
  // The same muted text is also used on secondary surfaces. Test both surfaces.
  const muted = contrastColor(
    contrastColor(input.muted, surface, 4.5),
    raised,
    4.5,
  );
  const track = hex(
    rgb(surface).map(
      (channel, index) => channel * 0.8 + rgb(input.foreground)[index] * 0.2,
    ),
  );
  return {
    ...input,
    muted,
    accent,
    onAccent,
    border: contrastColor(dark ? "#8f918a" : "#887f71", surface, 3),
    track,
    hover: raised,
    focus: contrastColor(input.accent, surface, 3),
    positive: contrastColor(dark ? "#a9d6b2" : "#35684c", surface, 4.5),
    negative: contrastColor(dark ? "#f0b4ad" : "#993a43", surface, 4.5),
    series: input.series.map((color) =>
      contrastColor(contrastColor(color, surface, 3), track, 3),
    ) as unknown as CardPalette["series"],
  };
}

export const cardPalettes: Record<CardPaletteId, CardPalette> = {
  paper: palette({
    label: "Papier",
    dark: false,
    surface: "#f3eddf",
    raised: "#e7dfcf",
    foreground: "#25221d",
    muted: "#655d51",
    accent: "#176c76",
    series: ["#187080", "#9b446f", "#7552a4", "#97601d"],
  }),
  ink: palette({
    label: "Encre",
    dark: true,
    surface: "#25221d",
    raised: "#373229",
    foreground: "#f3eddf",
    muted: "#c9bead",
    accent: "#79ced5",
    series: ["#79ced5", "#edbb6b", "#e1a7ce", "#b5c7a0"],
  }),
  yellow: palette({
    label: "Jaune",
    dark: false,
    surface: "#f2d16b",
    raised: "#e7c45b",
    foreground: "#302919",
    muted: "#61522d",
    accent: "#514099",
    series: ["#514099", "#195d6b", "#8e335b", "#355f46"],
  }),
  pink: palette({
    label: "Rose",
    dark: false,
    surface: "#e8c5db",
    raised: "#dcb4cd",
    foreground: "#342332",
    muted: "#685363",
    accent: "#43418b",
    series: ["#356653", "#43418b", "#885329", "#176e7b"],
  }),
  cyan: palette({
    label: "Cyan",
    dark: false,
    surface: "#bcdce0",
    raised: "#accdd2",
    foreground: "#19383e",
    muted: "#496167",
    accent: "#74418b",
    series: ["#74418b", "#9b3c54", "#3b6042", "#84501c"],
  }),
  coral: palette({
    label: "Corail",
    dark: false,
    surface: "#efbaaa",
    raised: "#e4aa98",
    foreground: "#422c28",
    muted: "#715149",
    accent: "#355e63",
    series: ["#355e63", "#713f7b", "#884220", "#435d37"],
  }),
  lavender: palette({
    label: "Lavande",
    dark: false,
    surface: "#d7cfea",
    raised: "#c8bedf",
    foreground: "#32293f",
    muted: "#61556e",
    accent: "#675097",
    series: ["#675097", "#296e6c", "#8a4856", "#795b22"],
  }),
  plum: palette({
    label: "Prune",
    dark: true,
    surface: "#49344a",
    raised: "#59425c",
    foreground: "#f7eaf1",
    muted: "#d6bfd0",
    accent: "#ebbb76",
    series: ["#ebbb76", "#9bd6cd", "#d4b8ee", "#f1aaa2"],
  }),
  midnight: palette({
    label: "Bleu nuit",
    dark: true,
    surface: "#23394c",
    raised: "#304a60",
    foreground: "#edf1ee",
    muted: "#bfced6",
    accent: "#aedbcf",
    series: ["#aedbcf", "#efc67d", "#d6b2dc", "#a9c9f1"],
  }),
  sage: palette({
    label: "Sauge",
    dark: false,
    surface: "#ced9bc",
    raised: "#bdcba9",
    foreground: "#29392b",
    muted: "#53614d",
    accent: "#475d77",
    series: ["#475d77", "#824965", "#356655", "#7d5522"],
  }),
  forest: palette({
    label: "Forêt",
    dark: true,
    surface: "#29483c",
    raised: "#385c4c",
    foreground: "#eef1df",
    muted: "#c7d3bd",
    accent: "#edc98c",
    series: ["#edc98c", "#b9d8d5", "#e8b1c9", "#bbc5eb"],
  }),
  sand: palette({
    label: "Sable",
    dark: false,
    surface: "#e5d4b4",
    raised: "#d6c19e",
    foreground: "#3b3022",
    muted: "#6a5840",
    accent: "#43655f",
    series: ["#43655f", "#784b7d", "#8a462f", "#405e88"],
  }),
};

export function isCardPaletteId(value: unknown): value is CardPaletteId {
  return typeof value === "string" && Object.hasOwn(cardPalettes, value);
}
export function getCardPalette(value: unknown): CardPalette {
  return cardPalettes[isCardPaletteId(value) ? value : "paper"];
}
export function cardPaletteClassName(value: unknown): string {
  return `card-palette palette-${isCardPaletteId(value) ? value : "paper"}`;
}
export function cardPaletteStyle(value: unknown): CSSProperties {
  const p = getCardPalette(value);
  return {
    colorScheme: p.dark ? "dark" : "light",
    "--card-surface": p.surface,
    "--card-raised": p.raised,
    "--card-foreground": p.foreground,
    "--card-muted": p.muted,
    "--card-border": p.border,
    "--card-track": p.track,
    "--card-accent": p.accent,
    "--card-on-accent": p.onAccent,
    "--card-hover": p.hover,
    "--card-focus": p.focus,
    "--card-positive": p.positive,
    "--card-negative": p.negative,
    "--card-series-1": p.series[0],
    "--card-series-2": p.series[1],
    "--card-series-3": p.series[2],
    "--card-series-4": p.series[3],
  } as CSSProperties;
}
