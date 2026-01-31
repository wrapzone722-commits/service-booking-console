import type { RequestHandler } from "express";
import * as db from "../db";

type OpenAiMsg = { role: "system" | "user" | "assistant"; content: string };

type AssistantOk =
  | { type: "message"; message: string }
  | { type: "create_service_result"; message: string; service: any };

type AssistantErr = { type: "error"; message: string };

function getEnvKey() {
  return process.env.OPENAI_API_KEY || "";
}

const SYSTEM_PROMPT = `Ты — ассистент админ‑панели сервиса записи/автомойки.

Правила:
1) Отвечай по-русски.
2) Если пользователь просит создать услугу — верни СТРОГО JSON (без markdown) вида:
   {"type":"create_service","data":{"name":"...","description":"...","price":1500,"duration":30,"category":"..."},"message":"..."}
3) Во всех остальных случаях верни СТРОГО JSON вида:
   {"type":"message","message":"..."}
`;

export const chat: RequestHandler = async (req, res) => {
  try {
    const incoming = (req.body?.messages ?? []) as OpenAiMsg[];
    const config = req.body?.config ?? {};

    // Use provided config or fallback to env
    const apiKey = config.apiKey || getEnvKey();
    const apiEndpoint = config.apiEndpoint || "https://api.openai.com/v1";
    const model = config.model || "gpt-4o-mini";

    if (!apiKey) {
      const out: AssistantErr = {
        type: "error",
        message: "OPENAI_API_KEY не настроен. Пожалуйста, добавьте API ключ в настройки ассистента.",
      };
      return res.status(500).json(out);
    }

    const messages: OpenAiMsg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...incoming];

    const chatEndpoint = `${apiEndpoint.replace(/\/$/, "")}/chat/completions`;

    const r = await fetch(chatEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages,
      }),
    });

    const json = await r.json();
    const content = json?.choices?.[0]?.message?.content;

    if (!r.ok || !content || typeof content !== "string") {
      console.error("OpenAI error:", json);
      const out: AssistantErr = {
        type: "error",
        message: "Ошибка ответа GPT API",
      };
      return res.status(502).json(out);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      // If model returned non-JSON, just forward text
      const out: AssistantOk = { type: "message", message: content };
      return res.json(out);
    }

    if (parsed?.type === "create_service" && parsed?.data) {
      const d = parsed.data;
      if (!d.name || !d.description || typeof d.price !== "number" || typeof d.duration !== "number") {
        const out: AssistantErr = { type: "error", message: "GPT вернул некорректные данные услуги" };
        return res.status(400).json(out);
      }

      const service = db.createService({
        name: String(d.name),
        description: String(d.description),
        price: Number(d.price),
        duration: Number(d.duration),
        category: String(d.category ?? "Прочее"),
        image_url: null,
        is_active: true,
      });

      const out: AssistantOk = {
        type: "create_service_result",
        message: parsed.message ?? "Услуга создана",
        service,
      };
      return res.json(out);
    }

    const out: AssistantOk = {
      type: "message",
      message: String(parsed?.message ?? content),
    };

    res.json(out);
  } catch (error) {
    console.error("Assistant chat error:", error);
    const out: AssistantErr = { type: "error", message: "Внутренняя ошибка ассистента" };
    res.status(500).json(out);
  }
};
