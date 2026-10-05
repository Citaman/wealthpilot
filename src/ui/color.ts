const hex = /^#([0-9a-f]{6})$/i;

function luminance(color: string): number | null {
  const match = hex.exec(color);
  if (!match) return null;
  return [0, 2, 4]
    .map((offset) => parseInt(match[1].slice(offset, offset + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce(
      (total, c, index) => total + c * [0.2126, 0.7152, 0.0722][index],
      0,
    );
}

/** Ink or cream text, whichever reads better on `background` (hex). */
export function readableOn(background: string): "var(--ink)" | "var(--cream)" {
  const l = luminance(background);
  if (l === null) return "var(--ink)";
  const onInk = (l + 0.05) / (0.0164 + 0.05);
  const onCream = (0.849 + 0.05) / (l + 0.05);
  return onInk >= onCream ? "var(--ink)" : "var(--cream)";
}
