import { readCsv } from "./parse";

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const file = await readCsv(event.data, (progress) =>
      self.postMessage({ progress }),
    );
    self.postMessage({ file });
  } catch (e) {
    self.postMessage({ error: String(e) });
  }
};
