import { RequestHandler } from "express";
import * as db from "../db";
import type { ClientNewsItem } from "@shared/api";

// GET /api/v1/news
// - client (api_key): published news with read flag
// - admin (JWT): all news
export const getNews: RequestHandler = (req, res) => {
  // optionalBearerAuth is expected to have run, but keep safe behaviour
  const account = (req as typeof req & { account?: unknown }).account;
  const clientAuth = (req as typeof req & { clientAuth?: { client_id: string } }).clientAuth;

  if (account) {
    return res.json(db.getNewsAll());
  }

  if (!clientAuth) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "X-API-Key or Authorization: Bearer api_key required",
    });
  }

  // ensure notifications exist for all published news
  db.ensureNewsNotificationsForClient(clientAuth.client_id);

  const notifications = db.getNotificationsByClientId(clientAuth.client_id).filter((n) => n.type === "news" && n.entity_id);
  const notifByNewsId = new Map<string, { id: string; read: boolean }>();
  for (const n of notifications) {
    if (n.entity_id) notifByNewsId.set(n.entity_id, { id: n._id, read: n.read });
  }

  const published = db.getNewsPublished();
  const out: ClientNewsItem[] = published.map((item) => {
    const meta = notifByNewsId.get(item._id);
    return {
      ...item,
      read: meta?.read ?? false,
      notification_id: meta?.id ?? null,
    };
  });

  res.json(out);
};

export const createNews: RequestHandler = (req, res) => {
  const { title, body, published } = req.body ?? {};
  if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ error: "Validation error", message: "Missing required fields: title, body" });
  }

  const item = db.createNews({ title, body, published: published === undefined ? true : !!published });

  // push to existing clients immediately (also works lazily via ensureNewsNotificationsForClient)
  for (const u of db.getUsers()) {
    db.createNotification({
      client_id: u._id,
      type: "news",
      title: item.title,
      body: item.body,
      entity_type: "news",
      entity_id: item._id,
      read: false,
    });
  }

  res.status(201).json(item);
};

export const updateNews: RequestHandler<{ id: string }> = (req, res) => {
  const id = req.params.id;
  const existing = db.getNewsItem(id);
  if (!existing) return res.status(404).json({ error: "Not found", message: "News not found" });

  const { title, body, published } = req.body ?? {};
  const updated = db.updateNews(id, {
    title: typeof title === "string" ? title : undefined,
    body: typeof body === "string" ? body : undefined,
    published: typeof published === "boolean" ? published : undefined,
  });

  res.json(updated);
};
