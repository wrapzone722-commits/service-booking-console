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

/** Настройки ИИ (OpenAI): без ключа, только признак configured и endpoint/model */
export const getAiSettings: RequestHandler = (_req, res) => {
  try {
    const settings = db.getAiSettingsPublic();
    res.json(settings);
  } catch (error) {
    console.error("Error getting AI settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** Сохранить настройки ИИ (API ключ OpenAI, endpoint, модель) */
export const updateAiSettings: RequestHandler = (req, res) => {
  try {
    const body = req.body ?? {};
    const { api_key, api_endpoint, model } = body;
    db.updateAiSettings({
      openai_api_key: api_key !== undefined ? String(api_key) : undefined,
      openai_api_endpoint: api_endpoint !== undefined ? String(api_endpoint) : undefined,
      openai_model: model !== undefined ? String(model) : undefined,
    });
    const settings = db.getAiSettingsPublic();
    res.json(settings);
  } catch (error) {
    console.error("Error updating AI settings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
