import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import type { FieldControlProps } from "./Field";
import "./Picker.css";

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** Right-aligned mono detail, e.g. an account balance. */
  meta?: string;
  disabled?: boolean;
}

export interface PickerSection<T extends string> {
  label?: string;
  options: readonly PickerOption<T>[];
}

export interface PickerProps<T extends string>
  extends Partial<FieldControlProps> {
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  options?: readonly PickerOption<T>[];
  sections?: readonly PickerSection<T>[];
  /** Overrides the trigger text (defaults to the selected option label). */
  valueLabel?: ReactNode;
  footer?: ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
  size?: "m" | "compact";
  variant?: "outline" | "ghost" | "dock";
  disabled?: boolean;
  className?: string;
}

export function Picker<T extends string>({
  value,
  onValueChange,
  label,
  options,
  sections,
  valueLabel,
  footer,
  side = "bottom",
  align = "start",
  size = "m",
  variant = "outline",
  disabled,
  className,
  ...control
}: PickerProps<T>) {
  const groups = sections ?? [{ options: options ?? [] }];
  const selected = groups
    .flatMap((group) => group.options)
    .find((option) => option.value === value);
  return (
    <Select.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label={label}
        {...control}
        className={["ui-picker", className].filter(Boolean).join(" ")}
        data-size={size}
        data-variant={variant}
      >
        <span className="ui-picker-value">
          {valueLabel ?? selected?.label ?? label}
        </span>
        <Select.Icon asChild>
          <ChevronDown className="ui-picker-chevron" size={16} aria-hidden />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={8}
          className="ui-float ui-picker-content"
        >
          <Select.Viewport>
            {groups.map((group, index) => (
              <Select.Group key={group.label ?? index}>
                {index > 0 && (
                  <Select.Separator className="ui-float-separator" />
                )}
                {group.label && (
                  <Select.Label className="ui-float-label">
                    {group.label}
                  </Select.Label>
                )}
                {group.options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    className="ui-float-item ui-picker-item"
                  >
                    <span className="ui-picker-text">
                      <Select.ItemText>{option.label}</Select.ItemText>
                      {option.description && (
                        <span className="ui-picker-description">
                          {option.description}
                        </span>
                      )}
                    </span>
                    {option.meta && (
                      <span className="ui-picker-meta">{option.meta}</span>
                    )}
                    <Select.ItemIndicator className="ui-picker-check">
                      <Check size={16} aria-hidden />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Group>
            ))}
          </Select.Viewport>
          {footer && <div className="ui-picker-footer">{footer}</div>}
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
