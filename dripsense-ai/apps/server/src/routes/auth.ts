import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db/pool.js";
import { asyncHandler } from "../middleware/errors.js";
import { validate } from "../middleware/validate.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/tokens.js";
import type { AuthStaff, StaffRole } from "../types/domain.js";

const router = Router();
const loginLimiter = rateLimit({ windowMs: 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8), remember: z.boolean().optional() });
const emailSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({ email: z.string().email(), otp: z.string().min(4), password: z.string().min(8) });

router.post("/login", loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const result = await query<{
    id: string;
    hospital_id: string;
    name: string;
    email: string;
    password_hash: string;
    role: StaffRole;
    is_active: boolean;
  }>(`select id, hospital_id, name, email, password_hash, role, is_active from staff where email = $1`, [email.toLowerCase()]);

  const staffRow = result.rows[0];
  if (!staffRow) return res.status(401).json({ error: "Invalid credentials" });
  if (!staffRow.is_active) return res.status(423).json({ error: "Account locked" });

  const ok = await bcrypt.compare(password, staffRow.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const staff: AuthStaff = {
    id: staffRow.id,
    hospitalId: staffRow.hospital_id,
    email: staffRow.email,
    name: staffRow.name,
    role: staffRow.role
  };
  await query(`update staff set last_login = now() where id = $1`, [staff.id]);
  res.cookie("refreshToken", signRefreshToken(staff), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return res.json({ accessToken: signAccessToken(staff), staff });
}));

router.post("/refresh", (req, res) => {
  const token = req.cookies.refreshToken as string | undefined;
  if (!token) return res.status(401).json({ error: "Missing refresh token" });
  try {
    const decoded = verifyRefreshToken(token);
    return res.json({ accessToken: signAccessToken(decoded.staff), staff: decoded.staff });
  } catch {
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("refreshToken");
  return res.status(204).send();
});

router.post("/forgot-password", validate(emailSchema), (_req, res) => res.json({ ok: true }));
router.post("/reset-password", validate(resetSchema), (_req, res) => res.json({ ok: true }));

export default router;
