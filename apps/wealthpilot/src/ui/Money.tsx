import type { HTMLAttributes } from "react";
import { formatEuro, type FormatOptions } from "../domain/money";
import type { Cents } from "../domain/types";
import "./Money.css";

export type MoneySize = "hero" | "xl" | "l" | "m" | "s" | "text" | "inherit";

export interface MoneyProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  value: Cents | null | undefined;
  /** "auto": negative in red, signed positive in green. The sign is always shown. */
  tone?: "auto" | "none";
  size?: MoneySize;
  signed?: boolean;
  cents?: FormatOptions["cents"];
  /** Hover text when the amount is unknown. */
  unknownReason?: string;
}

const displaySizes = new Set<MoneySize>(["hero", "xl", "l", "m", "s"]);

export function moneyText(
  value: Cents,
  size: MoneySize,
  options: FormatOptions,
) {
  const heroLike = size === "hero" || size === "xl" || size === "l";
  const cents =
    options.cents ??
    (heroLike && Math.abs(value) >= 100_000 ? "never" : "auto");
  return formatEuro(value, { ...options, cents });
}

export function Money({
  value,
  tone = "auto",
  size = "inherit",
  signed = false,
  cents,
  unknownReason = "Montant inconnu",
  className,
  ...rest
}: MoneyProps) {
  const classes = ["ui-money", className].filter(Boolean).join(" ");
  const font = displaySizes.has(size) ? "display" : undefined;
  if (value === null || value === undefined || !Number.isFinite(value))
    return (
      <span
        className={classes}
        data-size={size}
        data-font={font}
        data-unknown
        title={unknownReason}
        aria-label={unknownReason}
        {...rest}
      >
        —
      </span>
    );
  const sign =
    value < 0 ? "negative" : value > 0 && signed ? "positive" : undefined;
  return (
    <span
      className={classes}
      data-size={size}
      data-font={font}
      data-tone={tone === "auto" ? sign : undefined}
      {...rest}
    >
      {moneyText(value, size, { signed, cents })}
    </span>
  );
}
