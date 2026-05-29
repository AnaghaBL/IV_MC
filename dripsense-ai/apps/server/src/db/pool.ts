import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { describeError } from "../middleware/errors.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 12,
  idleTimeoutMillis: 30_000
});

pool.on("error", (err) => {
  logger.error("db.pool.error", { error: describeError(err) });
});

export const query = <T extends pg.QueryResultRow>(text: string, params: readonly unknown[] = []) =>
  pool.query<T>(text, [...params]);
