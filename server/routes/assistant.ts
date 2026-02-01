import type { RequestHandler } from "express";
import * as db from "../db";

type OpenAiMsg = { role: "system" | "user" | "assistant"; content: string };

type AssistantOk =
  | { type: "message"; message: string }
  | { type: "create_service_result"; message: string; service: any };

type AssistantErr = { type: "error"; message: string };

// Timeweb Cloud AI по умолчанию (можно заменить на OpenAI через переменные окружения)
const DEFAULT_AI_ENDPOINT = "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/bb83069e-f7de-48ac-adf5-5d804ce47381/v1";
const DEFAULT_AI_TOKEN = "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6IjFrYnhacFJNQGJSI0tSbE1xS1lqIn0.eyJ1c2VyIjoicHo1NzQ5OCIsInR5cGUiOiJhcGlfa2V5IiwiYXBpX2tleV9pZCI6IjM0NWU4OTFkLTcyMjYtNDM0Yi04Y2I4LWZkMTNmYTI4ZjE1OSIsImlhdCI6MTc2OTkwNTA0NX0.zDb65ntu2TPxIO0vPthT_M4MeH-qYSHYZ6dnu8k6Zj4tC5O54hXEWlPSNymirVmKGj0qyVk8vIy2b_aeS3GdudN671btxQ5PodnYGrHv1BOYNpm8TT7CU5BFIwgdTekXzbyzqIs6tV5m05QXru9BuuI0bxmCAJIVoK_qmY3OOI4fEWdesIMZ30uQz3jUkK9_-9xrnK8LnUstliZFHYEiHxXjhRA7eay7LfV4BLW2sLvTmCAK61cN85eDmpuvBBEh8flgsd6XyfhkQwCnS8A3z5uJNJAqjKgOp7Zd3R6qITNlSuYERI0mvdU-4w2kTmYWYujZbowELvNyKTMvlUKJKLLGWXM8j2IrnKNHYMa4xuxjPC3H-x5R_XIYxnbWRIHGoADJqfDHfemiaxQFIjNTjuOz_-hdfq4OwN9L-5GNxwadOMfLm8Gt8zSeYS6mpC5w2KNn8k6N9tjaQWV7nHyzxEy3mwdQaXEZB4PMto-qNqPqK94xS1HObOx5utBEUJar";
const DEFAULT_MODEL = ""; // Timeweb Cloud AI не требует model

function getEnvKey() {
  return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || DEFAULT_AI_TOKEN;
}

function getEnvEndpoint() {
  return process.env.AI_API_ENDPOINT || process.env.OPENAI_API_ENDPOINT || DEFAULT_AI_ENDPOINT;
}

function getEnvModel() {
  return process.env.AI_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;
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

    // Use provided config or fallback to env (Timeweb Cloud AI по умолчанию)
    const apiKey = config.apiKey || getEnvKey();
    const apiEndpoint = config.apiEndpoint || getEnvEndpoint();
    const model = config.model || getEnvModel();

    if (!apiKey) {
      const out: AssistantErr = {
        type: "error",
        message: "AI API ключ не настроен.",
      };
      return res.status(500).json(out);
    }

    const messages: OpenAiMsg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...incoming];

    const chatEndpoint = `${apiEndpoint.replace(/\/$/, "")}/chat/completions`;

    // Формируем тело запроса (model опционален для Timeweb Cloud AI)
    const requestBody: Record<string, unknown> = {
      temperature: 0.2,
      messages,
    };
    if (model) {
      requestBody.model = model;
    }

    const r = await fetch(chatEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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
        is_active: false, // По умолчанию неактивна — нужно включить вручную
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
