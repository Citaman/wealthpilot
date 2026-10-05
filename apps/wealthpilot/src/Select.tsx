import * as Primitive from "@radix-ui/react-select";
import {
  Children,
  isValidElement,
  useId,
  type SelectHTMLAttributes,
  type ReactElement,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";

type SelectProps = Pick<
  SelectHTMLAttributes<HTMLSelectElement>,
  | "children"
  | "value"
  | "onChange"
  | "id"
  | "disabled"
  | "className"
  | "name"
  | "required"
  | "form"
  | "autoComplete"
  | "autoFocus"
  | "onBlur"
  | "onFocus"
  | "tabIndex"
  | "title"
  | "aria-label"
  | "aria-labelledby"
  | "aria-describedby"
  | "aria-invalid"
  | "aria-required"
> & { side?: "top" | "bottom" };
// A controlled value adapter; the trigger is a button, while Radix supplies the native form control.
export function Select({
  children,
  value,
  onChange,
  id,
  disabled,
  className,
  name,
  required,
  form,
  autoComplete,
  autoFocus,
  onBlur,
  onFocus,
  tabIndex,
  side = "bottom",
  ...props
}: SelectProps) {
  const descriptionId = useId();
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const option = child as ReactElement<{
      value?: string;
      children: string;
      disabled?: boolean;
      "data-description"?: string;
    }>;
    return [
      {
        value: String(option.props.value ?? option.props.children),
        label: option.props.children,
        disabled: option.props.disabled,
        description: option.props["data-description"],
      },
    ];
  });
  const empty = "__wealthpilot_empty__";
  return (
    <Primitive.Root
      value={String(value ?? "")}
      disabled={disabled}
      name={name}
      required={required}
      form={form}
      autoComplete={autoComplete}
      onValueChange={(next) => {
        const target = { value: next === empty ? "" : next };
        onChange?.({
          target,
          currentTarget: target,
        } as ChangeEvent<HTMLSelectElement>);
      }}
    >
      <Primitive.Trigger
        id={id}
        className={"select-trigger " + (className ?? "")}
        aria-label={props["aria-label"]}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        aria-required={required || props["aria-required"]}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        onBlur={(event) =>
          onBlur?.(event as unknown as FocusEvent<HTMLSelectElement>)
        }
        onFocus={(event) =>
          onFocus?.(event as unknown as FocusEvent<HTMLSelectElement>)
        }
        title={props.title}
      >
        <Primitive.Value
          placeholder={options.find((option) => !option.value)?.label}
        />
        <Primitive.Icon>
          <ChevronDown size={15} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          className="select-menu"
          position="popper"
          side={side}
          sideOffset={6}
          collisionPadding={12}
        >
          <Primitive.ScrollUpButton className="select-scroll">
            ↑
          </Primitive.ScrollUpButton>
          <Primitive.Viewport>
            {options.map((option) => (
              <Primitive.Item
                key={option.value}
                value={option.value || empty}
                disabled={option.disabled}
                className="select-option"
                aria-label={option.description ? option.label : undefined}
                aria-describedby={
                  option.description
                    ? `${descriptionId}-${option.value}`
                    : undefined
                }
              >
                <span className="select-option-copy">
                  <Primitive.ItemText>{option.label}</Primitive.ItemText>
                  {option.description && (
                    <small
                      id={`${descriptionId}-${option.value}`}
                      className="select-option-description"
                    >
                      {option.description}
                    </small>
                  )}
                </span>
                <Primitive.ItemIndicator>
                  <Check size={15} />
                </Primitive.ItemIndicator>
              </Primitive.Item>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="select-scroll">
            ↓
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
