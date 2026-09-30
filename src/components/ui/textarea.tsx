import * as React from "react"
import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string };

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const errorId = `${textareaId}-error`;
    return (
      <div>
        <textarea id={textareaId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={[ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(" ") || undefined} className={cn("flex min-h-24 w-full rounded-[var(--radius-control)] border border-input bg-card px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-65 sm:text-sm", error && "border-destructive focus-visible:ring-destructive", className)} ref={ref} {...props} />
        {error ? <p id={errorId} className="mt-1.5 text-sm font-medium text-destructive" role="alert">{error}</p> : null}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
