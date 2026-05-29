import { readFile } from "node:fs/promises";
import { pool } from "./pool.js";

const file = process.argv[2];
if (!file) throw new Error("Usage: tsx src/db/run-sql.ts <file.sql>");

const sql = await readFile(file, "utf8");
await pool.query(sql);
await pool.end();
