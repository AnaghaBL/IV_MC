type LogMeta = Record<string, string | number | boolean | null | undefined>;

const write = (level: "info" | "warn" | "error", message: string, meta?: LogMeta) => {
  const line = JSON.stringify({ level, message, ...meta, time: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
};

export const logger = {
  info: (message: string, meta?: LogMeta) => write("info", message, meta),
  warn: (message: string, meta?: LogMeta) => write("warn", message, meta),
  error: (message: string, meta?: LogMeta) => write("error", message, meta)
};
