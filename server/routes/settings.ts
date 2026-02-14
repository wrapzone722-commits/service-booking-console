import type { RequestHandler } from "express";
import * as db from "../db";

/** Возвращает URL API для QR-кода. Строится из Host запроса или из API_BASE_URL. */
export const getApiUrl: RequestHandler = (req, res) => {
  try {
    const url = db.getApiUrlFromRequest(req);
    res.json({ api_url: url });
  } catch (error) {
    console.error("Error getting API URL:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to get API URL" });
  }
};

