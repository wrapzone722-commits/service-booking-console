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

/** Правило отображения фото авто (01→02→03→04 по дням после услуги) */
export const getDisplayPhotoRule: RequestHandler = (_req, res) => {
  try {
    res.json(db.getDisplayPhotoRule());
  } catch (error) {
    console.error("Error getting display photo rule:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to get display rule" });
  }
};

export const updateDisplayPhotoRule: RequestHandler = (req, res) => {
  try {
    const body = req.body as { days_01?: number; days_02?: number; days_03?: number };
    const updated = db.setDisplayPhotoRule(body);
    res.json(updated);
  } catch (error) {
    console.error("Error updating display photo rule:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update display rule" });
  }
};

