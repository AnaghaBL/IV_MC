import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://dripsense:dripsense@localhost:5432/dripsense"),
  SERVER_PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change"),
  DEVICE_API_KEY: z.string().min(8).default("city-general-device-key"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export const env = envSchema.parse(process.env);
