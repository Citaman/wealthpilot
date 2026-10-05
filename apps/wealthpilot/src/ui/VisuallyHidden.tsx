import type { HTMLAttributes } from "react";

export function VisuallyHidden({
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={["sr-only", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
