import { RequestHandler } from "express";
import * as db from "../db";
import { getApiKeyFromRequest } from "../middleware/auth";

export const getNotifications: RequestHandler = (req, res) => {
  try {
    const token = getApiKeyFromRequest(req);
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "X-API-Key or Authorization Bearer api_key required",
      });
    }
    const clientAuth = db.getClientAuthByApiKey(token);

    if (!clientAuth) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
    }

    const notifications = db.getNotificationsByClientId(clientAuth.client_id);
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch notifications",
    });
  }
};

export const markNotificationRead: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const token = getApiKeyFromRequest(req);
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "X-API-Key or Authorization Bearer api_key required",
      });
    }
    const clientAuth = db.getClientAuthByApiKey(token);

    if (!clientAuth) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
    }

    const notification = db.getNotification(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: "Not found", message: "Notification not found" });
    }

    if (notification.client_id !== clientAuth.client_id) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You can only mark your own notifications as read",
      });
    }

    const updated = db.markNotificationRead(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error("Error marking notification read:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to update notification",
    });
  }
};

/** Admin: create notification for a client (type: admin). Use requireAuth middleware. */
export const createNotification: RequestHandler = (req, res) => {
  try {
    const { client_id, body, title } = req.body ?? {};

    if (!client_id || !body || typeof body !== "string") {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: client_id, body",
      });
    }

    const user = db.getUser(client_id);
    if (!user) {
      return res.status(404).json({ error: "Not found", message: "Client not found" });
    }

    const notification = db.createNotification({
      client_id,
      body: body.trim(),
      type: "admin",
      title: typeof title === "string" ? title.trim() || null : null,
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create notification",
    });
  }
};
