export type Rgb = [number, number, number];

export function hexToRgbTuple(hex: string): Rgb | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

export function rgbString(rgb: Rgb): string {
  return rgb.join(" ");
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
}

export function foregroundFor(background: Rgb): Rgb {
  const ink: Rgb = [17, 24, 39];
  const white: Rgb = [255, 255, 255];
  return contrastRatio(background, ink) >= contrastRatio(background, white) ? ink : white;
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((value, index) =>
    Math.round(value + (to[index] - value) * amount)
  ) as Rgb;
}

/**
 * Produce an accent that works both as text/icon on the theme surface and as a
 * filled control with an automatically selected foreground.
 */
export function normalizeAccent(rgb: Rgb, theme: "light" | "dark"): Rgb {
  const surface: Rgb = theme === "light" ? [255, 255, 255] : [12, 18, 28];
  const target: Rgb = theme === "light" ? [0, 0, 0] : [255, 255, 255];
  let candidate = rgb;
  for (let step = 0; step <= 20; step += 1) {
    if (
      contrastRatio(candidate, surface) >= 4.5 &&
      contrastRatio(candidate, foregroundFor(candidate)) >= 4.5
    ) {
      return candidate;
    }
    candidate = mix(candidate, target, 0.08);
  }
  return theme === "light" ? [117, 40, 20] : [255, 174, 148];
}
