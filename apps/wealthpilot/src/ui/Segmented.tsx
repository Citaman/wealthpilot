import { useRef, type KeyboardEvent, type ReactNode } from "react";
import "./Segmented.css";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Required when `label` is an icon. */
  ariaLabel?: string;
  disabledReason?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  size?: "m" | "compact";
  className?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "m",
  className,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options
    .map((option, index) => (option.disabledReason ? -1 : index))
    .filter((index) => index >= 0);

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const position = enabled.indexOf(index);
    const keys: Record<string, number> = {
      ArrowRight: position + 1,
      ArrowDown: position + 1,
      ArrowLeft: position - 1,
      ArrowUp: position - 1,
      Home: 0,
      End: enabled.length - 1,
    };
    if (!(event.key in keys) || !enabled.length) return;
    event.preventDefault();
    const next = enabled[(keys[event.key] + enabled.length) % enabled.length];
    refs.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={["ui-segmented", className].filter(Boolean).join(" ")}
      data-size={size}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.ariaLabel}
            aria-disabled={option.disabledReason ? true : undefined}
            title={option.disabledReason ?? option.ariaLabel}
            tabIndex={checked ? 0 : -1}
            className="ui-segment"
            onClick={() => !option.disabledReason && onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
