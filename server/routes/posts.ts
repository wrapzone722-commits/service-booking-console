import type { RequestHandler } from "express";
import * as db from "../db";
import type { PostIntervalMinutes } from "@shared/api";

export const getPosts: RequestHandler = (_req, res) => {
  try {
    res.json(db.getPosts());
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch posts" });
  }
};

export const updatePost: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const { is_enabled, use_custom_hours, start_time, end_time, interval_minutes } = req.body ?? {};

    const patch: any = {};
    if (typeof is_enabled === "boolean") patch.is_enabled = is_enabled;
    if (typeof use_custom_hours === "boolean") patch.use_custom_hours = use_custom_hours;
    if (typeof start_time === "string") patch.start_time = start_time;
    if (typeof end_time === "string") patch.end_time = end_time;
    if (typeof interval_minutes === "number") patch.interval_minutes = interval_minutes as PostIntervalMinutes;

    const updated = db.updatePost(req.params.id, patch);
    if (!updated) {
      return res.status(404).json({ error: "Not found", message: "Post not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update post" });
  }
};

export const getPostDaySlots: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const date = req.query.date;
    if (!date || typeof date !== "string") {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing or invalid query parameter: date (format: YYYY-MM-DD)",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid date format. Expected: YYYY-MM-DD",
      });
    }

    const slots = db.generatePostDaySlots(req.params.id, date);
    res.json(slots);
  } catch (error) {
    console.error("Error fetching post slots:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch post slots" });
  }
};

export const setPostDaySlotClosed: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const { time, closed } = req.body ?? {};

    if (!time || typeof time !== "string" || typeof closed !== "boolean") {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: time, closed",
      });
    }

    const ok = db.setPostSlotClosed(req.params.id, time, closed);
    if (!ok) {
      return res.status(404).json({ error: "Not found", message: "Post not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error closing slot:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update slot" });
  }
};
