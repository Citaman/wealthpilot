import { DatabaseBackup, Download } from "lucide-react";
import { useRef, useState } from "react";
import demoCsv from "../../../fixtures/demo.csv?raw";
import { DockActions } from "../../app/DockSlot";
import { useToast } from "../../app/toast";
import {
  BackupError,
  downloadFile,
  exportBackup,
  parseBackup,
} from "../../data/backup";
import { usePreferences } from "../../data/hooks";
import type { Ledger } from "../../domain/ledger";
import { Button } from "../../ui/Button";
import { Menu } from "../../ui/Menu";
import { backupFileName, localDay } from "./labels";
import { RestoreDialog, type RestoreRequest } from "./RestoreDialog";

export const downloadDemoCsv = () =>
  downloadFile("demo.csv", demoCsv, "text/csv;charset=utf-8");

/** Dock commands of the Import page: backup export / restore and the sample CSV. */
export function BackupMenu({
  ledger,
  onRestored,
}: {
  ledger: Ledger;
  onRestored(): void;
}) {
  const toast = useToast();
  const preferences = usePreferences();
  const input = useRef<HTMLInputElement>(null);
  const [request, setRequest] = useState<RestoreRequest | null>(null);

  async function exportNow() {
    try {
      downloadFile(
        backupFileName(ledger.asOf),
        await exportBackup(),
        "application/json",
      );
      toast.show({ message: "Sauvegarde téléchargée" });
    } catch (error) {
      toast.error(error);
    }
  }

  async function read(file: File) {
    const base = { file: file.name };
    try {
      const snapshot = parseBackup(await file.text());
      setRequest({
        ...base,
        savedOn: localDay(new Date(file.lastModified).toISOString()),
        snapshot,
      });
    } catch (error) {
      if (!(error instanceof BackupError)) return toast.error(error);
      setRequest({ ...base, error: error.message });
    }
  }

  const { transactions, accounts, batches, budgets, dues } = ledger;
  return (
    <>
      <DockActions>
        <Menu
          side="top"
          align="start"
          label="Sauvegarde"
          trigger={
            <Button
              variant="ghost"
              className="import-dock-button"
              icon={<DatabaseBackup aria-hidden />}
            >
              Sauvegarde
            </Button>
          }
          items={[
            { label: "Exporter une sauvegarde", onSelect: exportNow },
            {
              label: "Restaurer…",
              onSelect: () => input.current?.click(),
            },
          ]}
        />
        <Button
          variant="ghost"
          className="import-dock-button"
          icon={<Download aria-hidden />}
          onClick={downloadDemoCsv}
        >
          CSV exemple
        </Button>
      </DockActions>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Fichier de sauvegarde"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void read(file);
        }}
      />
      <RestoreDialog
        key={request?.file ?? ""}
        request={request}
        current={{
          transactions,
          accounts,
          batches,
          budgets,
          dues,
          preferences,
        }}
        asOf={ledger.asOf}
        onClose={() => setRequest(null)}
        onPickAnother={() => {
          setRequest(null);
          input.current?.click();
        }}
        onRestored={() => {
          setRequest(null);
          onRestored();
        }}
      />
    </>
  );
}
