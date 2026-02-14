import { RequestHandler } from "express";
import * as db from "../db";

export const getSlots: RequestHandler = (req, res) => {
  try {
    const { service_id, date, post_id } = req.query;

    if (!service_id || typeof service_id !== "string") {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing or invalid query parameter: service_id",
      });
    }

    if (!date || typeof date !== "string") {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing or invalid query parameter: date (format: YYYY-MM-DD)",
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid date format. Expected: YYYY-MM-DD",
      });
    }

    const postId = typeof post_id === "string" ? post_id : "post_1";
    const slots = db.generateTimeSlots(service_id, date, postId);

    if (slots.length === 0 && !db.getService(service_id)) {
      return res.status(404).json({ error: "Not found", message: "Service not found" });
    }

    const withCapacity = slots.map((s) => ({
      ...s,
      remaining_capacity: s.is_available ? 1 : 0,
    }));
    res.json(withCapacity);
  } catch (error) {
    console.error("Error fetching slots:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch slots" });
  }
};
