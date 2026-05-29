import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const roots = ["apps/web/src", "apps/server/src"];
const allowed = new Set(["apps/server/src/config/logger.ts"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : path;
  }));
  return files.flat();
}

const offenders = [];
for (const root of roots) {
  for (const file of await walk(root)) {
    const normalized = file.replaceAll("\\", "/");
    if (!/\.(ts|tsx)$/.test(file) || allowed.has(normalized)) continue;
    const text = await readFile(file, "utf8");
    if (text.includes("console.")) offenders.push(normalized);
  }
}

if (offenders.length > 0) {
  process.stderr.write(`console.* found in production paths:\n${offenders.join("\n")}\n`);
  process.exit(1);
}
