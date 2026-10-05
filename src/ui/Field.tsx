import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import "./Field.css";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "children"> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  /** Renders a custom control (e.g. a Picker) instead of the default input. */
  children?: (control: FieldControlProps) => ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  ...input
}: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control: FieldControlProps = {
    id,
    "aria-describedby":
      [errorId, hintId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": error ? true : undefined,
  };
  return (
    <div className={["ui-field", className].filter(Boolean).join(" ")}>
      <label className="ui-field-label" htmlFor={id}>
        {label}
      </label>
      {children ? (
        children(control)
      ) : (
        <input className="ui-input" {...input} {...control} />
      )}
      {error ? (
        <span id={errorId} className="ui-field-error">
          {error}
        </span>
      ) : (
        hint && (
          <span id={hintId} className="ui-field-hint">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
