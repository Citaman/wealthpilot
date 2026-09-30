const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  time: (label: string) => {
    if (isDev) console.time(label);
  },
  timeEnd: (label: string) => {
    if (isDev) console.timeEnd(label);
  },
};
