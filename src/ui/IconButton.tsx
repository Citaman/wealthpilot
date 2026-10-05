import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import "./Button.css";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  label: string;
  icon: ReactNode;
  variant?: "ghost" | "outline" | "primary";
  disabledReason?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  icon,
  variant = "ghost",
  disabledReason,
  className,
  onClick,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={disabledReason ?? label}
      aria-disabled={disabledReason ? true : undefined}
      className={["ui-button ui-icon-button", className]
        .filter(Boolean)
        .join(" ")}
      data-variant={variant}
      onClick={(event) => {
        if (disabledReason) event.preventDefault();
        else onClick?.(event);
      }}
      {...rest}
    >
      {icon}
    </button>
  );
}
