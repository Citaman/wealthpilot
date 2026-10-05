import { decodeCSV, parseCSV } from "./importer";
self.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
  try {
    self.postMessage({
      ok: true,
      file: parseCSV(
        typeof event.data === "string" ? event.data : decodeCSV(event.data),
        (progress) => self.postMessage({ progress }),
      ),
    });
  } catch (e) {
    self.postMessage({ ok: false, error: String(e) });
  }
};
