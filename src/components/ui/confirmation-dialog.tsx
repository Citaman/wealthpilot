"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export function ConfirmationDialog({ open, onOpenChange, title, description, confirmLabel = "Confirmer", cancelLabel = "Annuler", destructive = false, pending = false, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: React.ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; pending?: boolean; onConfirm: () => void | Promise<void> }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader className="px-6 pt-6 pr-16"><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-warning/10 text-warning"><AlertTriangle className="h-5 w-5" /></div><DialogTitle>{title}</DialogTitle><DialogDescription asChild><div>{description}</div></DialogDescription></DialogHeader><DialogFooter className="border-t px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{cancelLabel}</Button><Button variant={destructive ? "destructive" : "default"} loading={pending} onClick={onConfirm}>{confirmLabel}</Button></DialogFooter></DialogContent></Dialog>;
}
