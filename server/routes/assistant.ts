import type { RequestHandler } from "express";
import * as db from "../db";

type OpenAiMsg = { role: "system" | "user" | "assistant"; content: string };

type AssistantOk =
  | { type: "message"; message: string }
  | { type: "create_service_result"; message: string; service: any }
  | { type: "create_post_result"; message: string; post: any };

type AssistantErr = { type: "error"; message: string };

// Timeweb Cloud AI по умолчанию
// Можно заменить на другой API через переменные окружения AI_API_ENDPOINT, AI_API_KEY, AI_MODEL
const DEFAULT_AI_ENDPOINT = "https://agent.timeweb.cloud/api/v1/cloud-ai/agents/4fad52a6-973f-4838-ab1e-11b0fbdf2b48/v1";
const DEFAULT_AI_TOKEN = "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCIsImtpZCI6IjFrYnhacFJNQGJSI0tSbE1xS1lqIn0.eyJ1c2VyIjoicHo1NzQ5OCIsInR5cGUiOiJhcGlfa2V5IiwiYXBpX2tleV9pZCI6ImEyYzBlN2Y0LTNmYmQtNDU3YS1iYmQ4LWZjMzJmZDViM2QxNSIsImlhdCI6MTc2OTkwNTkzM30.rUiOuV8mYFdOwCQ3I_t1kS7iBvqRoosOEViGKKYzjhrBT_hPGYIVjQyKMYv2DpmVSlSP4wVfrYrOqibUFj90DW9JypoGr63TliMD6n5sBfogrZmCv8Loz8dYXRv6VJmxdleE5wGrHvZ9BxvOIP5a1jA6aHynvAROaNKEkqRglRxAaegBYkDnwnkNNI7ZIvd6XhC0XzC5XQGodMoVa-DoATfuVMEg0_GtxRlsPLGyNTV_bThhf-VrqZcY6WGKmeWGGEYKC9y8XtBAn6FOvtsDi7zOdtKgnJblc8dBXbhyVZe_hRZ4c-UawogUngWCkXCVv9ZULe7Jzf7Zo-63nRH2mxVyaKUgEQ8iHtOKfdlAL-CRsI9eAKpiPi3fjezR4tw_3hgEZ1Cg7KVWZEdGDpkdBJFxO7FTv_p00HKQ_iyNJUE1yc6P_1zShvkRP7O1UAd0Lp4bRpGsOMCiz7Oo7cQBSzdK2IarfKmnGZs52HKfda-4ENx-GbFGLRBqr51XN9h5";
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

/** Ключ/endpoint/model: сначала из запроса, потом из настроек (Настройки → ИИ), потом из env */
function resolveAiConfig(config: { apiKey?: string; apiEndpoint?: string; model?: string } | undefined) {
  const fromSettings = db.getAiSettings();
  return {
    apiKey: config?.apiKey || fromSettings.openai_api_key || getEnvKey(),
    apiEndpoint: config?.apiEndpoint || fromSettings.openai_api_endpoint || getEnvEndpoint(),
    model: config?.model || fromSettings.openai_model || getEnvModel(),
  };
}

function buildSystemPrompt(projectStructureContext?: string): string {
  let base = `Ты — ассистент админ‑панели сервиса записи/автомойки. Ты помогаешь управлять структурой проекта изнутри: услуги, посты, а также можешь ориентироваться в структуре файлов проекта.

Правила:
1) Отвечай по-русски.
2) Если пользователь просит создать услугу — верни СТРОГО JSON (без markdown) вида:
   {"type":"create_service","data":{"name":"...","description":"...","price":1500,"duration":30,"category":"..."},"message":"..."}
3) Если пользователь просит создать пост (пост мойки, бокс, эстакаду и т.п.) — верни СТРОГО JSON вида:
   {"type":"create_post","data":{"name":"..."},"message":"..."}
   name — название поста, например "Пост 1", "Бокс А", "Эстакада", "Помывочная 2".
4) Во всех остальных случаях верни СТРОГО JSON вида:
   {"type":"message","message":"..."}
`;
  if (projectStructureContext) {
    base += `\n\nКонтекст структуры проекта (для ответов о файлах и навигации):\n${projectStructureContext}\n`;
  }
  return base;
}

/** Возвращает текстовое описание структуры проекта для контекста ИИ (только разрешённые каталоги) */
function getProjectStructureContext(): string | undefined {
  try {
    const fs = require("fs");
    const path = require("path");
    const root = path.resolve(process.cwd());
    const allowedDirs = ["client", "server", "shared"];
    const lines: string[] = [];
    for (const dir of allowedDirs) {
      const full = path.join(root, dir);
      if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;
      lines.push(`${dir}/`);
      const entries = fs.readdirSync(full, { withFileTypes: true });
      for (const e of entries.slice(0, 50)) {
        const name = e.name;
        if (name.startsWith(".") || name === "node_modules") continue;
        lines.push(`  ${e.isDirectory() ? name + "/" : name}`);
      }
    }
    return lines.length ? lines.join("\n") : undefined;
  } catch {
    return undefined;
  }
}

/** GET структуры проекта (для ИИ и отладки) */
export const getProjectStructure: RequestHandler = (_req, res) => {
  try {
    const structure = getProjectStructureContext();
    res.json({ structure: structure ?? "" });
  } catch (e) {
    console.error("getProjectStructure:", e);
    res.status(500).json({ structure: "" });
  }
};

export const chat: RequestHandler = async (req, res) => {
  try {
    const incoming = (req.body?.messages ?? []) as OpenAiMsg[];
    const config = req.body?.config ?? {};

    const resolved = resolveAiConfig(config);
    const apiKey = resolved.apiKey;
    const apiEndpoint = resolved.apiEndpoint;
    const model = resolved.model;

    if (!apiKey) {
      const out: AssistantErr = {
        type: "error",
        message: "AI API ключ не настроен. Укажите ключ в Настройках → ИИ (OpenAI) или в настройках ассистента.",
      };
      return res.status(500).json(out);
    }

    const projectContext = getProjectStructureContext();
    const systemPrompt = buildSystemPrompt(projectContext);
    const messages: OpenAiMsg[] = [{ role: "system", content: systemPrompt }, ...incoming];

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

    const json = await r.json().catch(() => ({}));
    const content = json?.choices?.[0]?.message?.content;

    if (!r.ok || !content || typeof content !== "string") {
      console.error("AI API error:", { status: r.status, statusText: r.statusText, json });
      const errMsg = json?.error?.message || json?.message || (typeof json?.error === "string" ? json.error : null);
      const out: AssistantErr = {
        type: "error",
        message: errMsg || `Ошибка AI API (${r.status}): ${r.statusText}`,
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

    if (parsed?.type === "create_post" && parsed?.data) {
      const d = parsed.data;
      if (!d.name || typeof d.name !== "string" || !String(d.name).trim()) {
        const out: AssistantErr = { type: "error", message: "GPT вернул некорректные данные поста" };
        return res.status(400).json(out);
      }

      const post = db.createPost({
        name: String(d.name).trim(),
        is_enabled: true,
        use_custom_hours: false,
        start_time: "09:00",
        end_time: "18:00",
        interval_minutes: 30,
      });

      const out: AssistantOk = {
        type: "create_post_result",
        message: parsed.message ?? "Пост создан",
        post,
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
