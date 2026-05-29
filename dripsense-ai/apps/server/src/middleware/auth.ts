import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthStaff, StaffRole } from "../types/domain.js";

interface TokenPayload extends jwt.JwtPayload {
  staff: AuthStaff;
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "Missing access token" });

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
    req.staff = decoded.staff;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
};

export const requireRole = (...roles: StaffRole[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.staff) return res.status(401).json({ error: "Unauthenticated" });
  if (!roles.includes(req.staff.role)) return res.status(403).json({ error: "Insufficient role" });
  return next();
};

export const requireDeviceKey = (req: Request, res: Response, next: NextFunction) => {
  if (req.header("X-Device-Key") !== env.DEVICE_API_KEY) {
    return res.status(401).json({ error: "Invalid device key" });
  }
  return next();
};
