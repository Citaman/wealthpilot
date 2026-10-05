import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { IconButton } from "./IconButton";
import "./Dialog.css";

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "s" | "m";
}

export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = "s",
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-overlay" />
        <RadixDialog.Content
          className="ui-dialog"
          data-size={size}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="ui-dialog-header">
            <RadixDialog.Title className="ui-dialog-title">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label="Fermer" icon={<X />} />
            </RadixDialog.Close>
          </header>
          {description && (
            <RadixDialog.Description className="ui-dialog-description">
              {description}
            </RadixDialog.Description>
          )}
          {children && <div className="ui-dialog-body">{children}</div>}
          {footer && <footer className="ui-dialog-footer">{footer}</footer>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;
