import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";

export const describeError = (err: unknown) => {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
};

export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  if (err instanceof ZodError) {
    return res.status(422).json({ error: "Validation failed", details: err.flatten() });
  }

  const message = describeError(err);
  logger.error("request.failed", {
    method: req.method,
    path: req.path,
    error: message
  });

  return res.status(500).json({ error: "Internal server error" });
};
