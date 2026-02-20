import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../routes/auth";
import * as db from "../db";
import type { ClientAuth } from "../db";

declare global {
  namespace Express {
    interface Request {
      account?: TokenPayload;
      /** Set when X-API-Key or Authorization: Bearer {api_key} from iOS client registration */
      clientAuth?: ClientAuth;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Admin auth (JWT). Support both:
  // - Authorization: Bearer <JWT>
  // - X-API-Key: <JWT>
  // Some reverse proxies strip the Authorization header.
  const token = getApiKeyFromRequest(req);
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing auth. Use Authorization: Bearer <JWT> or X-API-Key: <JWT>",
    });
  }
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

/** Извлекает api_key из X-API-Key или Authorization: Bearer (для iOS и консоли). */
export function getApiKeyFromRequest(req: Request): string | null {
  const xApiKey = req.headers["x-api-key"];
  if (typeof xApiKey === "string" && xApiKey.trim()) return xApiKey.trim();
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return null;
}

/** Optional: extracts JWT (admin) or api_key (iOS client) from X-API-Key or Bearer. Sets req.account or req.clientAuth. */
export function optionalBearerAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getApiKeyFromRequest(req);
  if (!token) return next();

  const payload = verifyToken(token);
  if (payload) {
    req.account = payload;
    return next();
  }

  const clientAuth = db.getClientAuthByApiKey(token);
  if (clientAuth) req.clientAuth = clientAuth;
  next();
}

/** Requires either JWT (admin) or api_key (iOS client). Accepts X-API-Key or Authorization: Bearer. */
export function requireBearerAuth(req: Request, res: Response, next: NextFunction) {
  const token = getApiKeyFromRequest(req);
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing or invalid auth. Use X-API-Key header or Authorization: Bearer api_key from POST /api/v1/clients/register",
    });
  }

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
