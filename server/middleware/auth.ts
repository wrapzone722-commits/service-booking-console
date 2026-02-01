import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../routes/auth";
import * as db from "../db";
import type { ClientAuth } from "../db";

declare global {
  namespace Express {
    interface Request {
      account?: TokenPayload;
      /** Set when Authorization: Bearer {api_key} from iOS client registration */
      clientAuth?: ClientAuth;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header",
    });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
  }

  req.account = payload;
  next();
}

/** Optional: extracts JWT (admin) or api_key (iOS client) from Bearer header. Sets req.account or req.clientAuth. */
export function optionalBearerAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);

  // Try JWT first (admin/web)
  const payload = verifyToken(token);
  if (payload) {
    req.account = payload;
    return next();
  }

  // Try api_key (iOS client from /clients/register)
  const clientAuth = db.getClientAuthByApiKey(token);
  if (clientAuth) {
    req.clientAuth = clientAuth;
  }

  next();
}

/** Requires either JWT (admin) or api_key (iOS client). Returns 401 if neither valid. */
export function requireBearerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid Authorization header. Use Bearer api_key from /clients/register",
    });
  }

  const token = authHeader.slice(7);

  const payload = verifyToken(token);
  if (payload) {
    req.account = payload;
    return next();
  }

  const clientAuth = db.getClientAuthByApiKey(token);
  if (clientAuth) {
    req.clientAuth = clientAuth;
    return next();
  }

  return res.status(401).json({
    error: "Unauthorized",
    message: "Invalid or expired token",
  });
}
