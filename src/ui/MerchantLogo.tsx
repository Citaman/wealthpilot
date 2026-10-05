import { useState, type CSSProperties } from "react";
import { Store, type LucideIcon } from "lucide-react";
import { readableOn } from "./color";
import "./MerchantLogo.css";

export interface MerchantLogoProps {
  /** Category colour (hex) behind the fallback. */
  color: string;
  src?: string;
  /** Fallback icon, typically the category icon; otherwise a shop. */
  icon?: LucideIcon;
  size?: 28 | 32 | 44;
}

export function MerchantLogo({
  color,
  src,
  icon: Icon = Store,
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
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
}
