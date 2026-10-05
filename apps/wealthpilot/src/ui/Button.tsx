import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { LoaderCircle } from "lucide-react";
import "./Button.css";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "outline"
  | "ghost"
  | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "s" | "m";
  icon?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
  /** Keeps the button focusable but inert, and says why on hover. */
  disabledReason?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = "outline",
  size = "s",
  icon,
  iconEnd,
  loading = false,
  disabledReason,
  className,
  children,
  onClick,
  type = "button",
  title,
  ...rest
}: ButtonProps) {
  const inert = loading || Boolean(disabledReason);
  return (
    <button
      type={type}
      className={["ui-button", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      aria-disabled={inert || undefined}
      title={disabledReason ?? title}
      onClick={(event) => {
        if (inert) event.preventDefault();
        else onClick?.(event);
      }}
      {...rest}
    >
      {loading ? (
        <LoaderCircle className="ui-button-spin" size={16} aria-hidden />
      ) : (
        icon
      )}
      {children}
      {iconEnd}
    </button>
  );
}
