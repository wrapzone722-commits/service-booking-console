import type { RequestHandler } from "express";
import type { UpdateLoyaltyRulesRequest } from "@shared/api";
import * as db from "../db";

// GET /api/v1/loyalty/rules
// доступ: клиент (api_key) или админ (JWT) — middleware optionalBearerAuth/requireBearerAuth
export const getRules: RequestHandler = (_req, res) => {
  res.json(db.getLoyaltyRules());
};

// PUT /api/v1/loyalty/rules — только админ (JWT)
export const updateRules: RequestHandler = (req, res) => {
  const body = (req.body ?? {}) as UpdateLoyaltyRulesRequest;
  const next = db.setLoyaltyRules({
    earn_percent: body.earn_percent,
    min_earn_points: body.min_earn_points,
    bonuses: body.bonuses,
  });
  res.json(next);
};

