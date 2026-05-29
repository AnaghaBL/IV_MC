import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthStaff } from "../types/domain.js";

export const signAccessToken = (staff: AuthStaff) =>
  jwt.sign({ staff }, env.JWT_ACCESS_SECRET, { expiresIn: "15m" });

export const signRefreshToken = (staff: AuthStaff) =>
  jwt.sign({ staff }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as { staff: AuthStaff };
