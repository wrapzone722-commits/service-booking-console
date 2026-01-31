import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../routes/auth";

declare global {
  namespace Express {
    interface Request {
      account?: TokenPayload;
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
