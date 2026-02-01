import { RequestHandler } from "express";
import * as db from "../db";

export const getConnections: RequestHandler = (req, res) => {
  try {
    const connections = db.getDeviceConnections();
    res.json(connections);
  } catch (error) {
    console.error("Error fetching connections:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch connections" });
  }
};

export const getConnection: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const connection = db.getDeviceConnection(req.params.id);
    if (!connection) {
      return res.status(404).json({ error: "Not found", message: "Connection not found" });
    }
    res.json(connection);
  } catch (error) {
    console.error("Error fetching connection:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch connection" });
  }
};

export const createConnection: RequestHandler = (req, res) => {
  try {
    const { device_id, device_name, qr_code_data } = req.body;

    if (!device_id || !device_name) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: device_id, device_name",
      });
    }

    // Generate unique API token for device
    const api_token = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;

    const connection = db.createDeviceConnection({
      device_id,
      device_name,
      api_token,
      qr_code_data: qr_code_data || JSON.stringify({ base_url: db.getApiUrlFromRequest(req), token: api_token }),
      last_seen: new Date().toISOString(),
      status: "pending",
    });

    res.status(201).json(connection);
  } catch (error) {
    console.error("Error creating connection:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to create connection" });
  }
};

export const updateConnection: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const { client_id, status, device_name } = req.body;

    const connection = db.updateDeviceConnection(req.params.id, {
      ...(client_id && { client_id }),
      ...(status && { status }),
      ...(device_name && { device_name }),
      last_seen: new Date().toISOString(),
    });

    if (!connection) {
      return res.status(404).json({ error: "Not found", message: "Connection not found" });
    }

    res.json(connection);
  } catch (error) {
    console.error("Error updating connection:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update connection" });
  }
};

export const deleteConnection: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const deleted = db.deleteDeviceConnection(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Not found", message: "Connection not found" });
    }

    res.json({ success: true, message: "Connection deleted" });
  } catch (error) {
    console.error("Error deleting connection:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to delete connection" });
  }
};

// Link a client profile to a device via token
export const linkClientToDevice: RequestHandler = (req, res) => {
  try {
    const { api_token, client_id } = req.body;

    if (!api_token || !client_id) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: api_token, client_id",
      });
    }

    // Find connection by token
    const connection = db.getDeviceConnectionByToken(api_token);
    if (!connection) {
      return res.status(404).json({
        error: "Not found",
        message: "Device connection with this token not found",
      });
    }

    // Link client to device
    const updated = db.linkClientToDevice(connection._id, client_id);

    res.json(updated);
  } catch (error) {
    console.error("Error linking client:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to link client" });
  }
};

// Get connection info by token (for device to retrieve its config)
export const getConnectionByToken: RequestHandler = (req, res) => {
  try {
    const token = req.query.token as string;

    if (!token) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing query parameter: token",
      });
    }

    const connection = db.getDeviceConnectionByToken(token);
    if (!connection) {
      return res.status(404).json({
        error: "Not found",
        message: "Device connection not found",
      });
    }

    // Update last_seen timestamp
    db.updateDeviceConnection(connection._id, {
      last_seen: new Date().toISOString(),
    });

    res.json(connection);
  } catch (error) {
    console.error("Error fetching connection by token:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch connection" });
  }
};
