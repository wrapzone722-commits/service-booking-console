import type { RequestHandler } from "express";
import * as db from "../db";

export const registerClient: RequestHandler = (req, res) => {
  try {
    const { device_id, platform, app_version } = req.body ?? {};

    if (!device_id || !platform || !app_version) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: device_id, platform, app_version",
      });
    }

    const result = db.registerClientDevice({ device_id, platform, app_version });
    res.json(result);
  } catch (error) {
    console.error("Error registering client:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to register client",
    });
  }
};
