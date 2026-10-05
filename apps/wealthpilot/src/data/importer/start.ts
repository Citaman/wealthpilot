import { ImportError } from "./commit";
import { MAX_BYTES, type ParsedFile } from "./parse";

export function fileProblem(file: File): string | null {
  if (!/\.csv$/i.test(file.name)) return "Choisissez un fichier .csv.";
  if (file.size > MAX_BYTES)
    return "Fichier trop volumineux : limite de 20 Mo.";
  return null;
}

type WorkerMessage =
  | { progress: number }
  | { file: Omit<ParsedFile, "name"> }
  | { error: string };

/** Decodes, hashes and parses off the main thread. `cancel()` rejects with an AbortError. */
export function startImport(file: File, onProgress: (percent: number) => void) {
  const problem = fileProblem(file);
  if (problem)
    return {
      promise: Promise.reject<ParsedFile>(new ImportError(problem)),
      cancel() {},
    };
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  let cancel = () => {};
  const promise = new Promise<ParsedFile>((resolve, reject) => {
    const fail = (error: Error) => {
      worker.terminate();
      reject(error);
    };
    cancel = () => fail(new DOMException("Lecture annulée.", "AbortError"));
    worker.onmessage = ({ data }: MessageEvent<WorkerMessage>) => {
      if ("progress" in data) return onProgress(data.progress);
      worker.terminate();
      if ("error" in data) reject(new ImportError(data.error));
      else resolve({ ...data.file, name: file.name });
    };
    worker.onerror = () =>
      fail(new ImportError("Lecture impossible. Réessayez avec un CSV UTF-8."));
    file
      .arrayBuffer()
      .then((buffer) => worker.postMessage(buffer, [buffer]), fail);
  });
  return { promise, cancel };
}
