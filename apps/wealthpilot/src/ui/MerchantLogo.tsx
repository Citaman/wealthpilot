import { useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { readableOn } from "./color";
import "./MerchantLogo.css";

export interface MerchantLogoProps {
  name: string;
  /** Category colour (hex) behind the fallback. */
  color: string;
  src?: string;
  /** Fallback icon, typically the category icon; otherwise the initial. */
  icon?: LucideIcon;
  size?: 28 | 32 | 44;
}

export function MerchantLogo({
  name,
  color,
  src,
  icon: Icon,
  size = 32,
}: MerchantLogoProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const style = { "--logo-size": `${size}px` } as CSSProperties;
  if (src && broken !== src)
    return (
      <span className="ui-logo" data-kind="image" style={style}>
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(src)}
        />
      </span>
    );
  const initial = name.trim().charAt(0).toLocaleUpperCase("fr-FR") || "?";
  return (
    <span
      className="ui-logo"
      data-kind="fallback"
      style={
        {
          ...style,
          "--logo-bg": color,
          "--logo-fg": readableOn(color),
        } as CSSProperties
      }
      aria-hidden
    >
      {Icon ? <Icon size={Math.round(size * 0.5)} strokeWidth={2} /> : initial}
    </span>
  );
}
