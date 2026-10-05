import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { IconButton } from "./IconButton";
import "./Dialog.css";
import "./Sheet.css";

export interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement;
  title: string;
  description?: ReactNode;
  /** Pinned under the title, e.g. a search field. */
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  toolbar,
  children,
  footer,
}: SheetProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="ui-overlay ui-sheet-overlay" />
        <RadixDialog.Content
          className="ui-sheet"
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="ui-sheet-header">
            <RadixDialog.Title className="ui-dialog-title">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label="Fermer" icon={<X />} />
            </RadixDialog.Close>
          </header>
          {description && (
            <RadixDialog.Description className="ui-sheet-description">
              {description}
            </RadixDialog.Description>
          )}
          {toolbar && <div className="ui-sheet-toolbar">{toolbar}</div>}
          <div className="ui-sheet-body">{children}</div>
          {footer && <footer className="ui-sheet-footer">{footer}</footer>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
