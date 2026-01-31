import { RequestHandler } from "express";
import { Service, CreateServiceRequest, UpdateServiceRequest } from "@shared/api";
import * as db from "../db";

export const getServices: RequestHandler = (req, res) => {
  try {
    const services = db.getServices();
    res.json(services);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch services" });
  }
};

export const getService: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const service = db.getService(req.params.id);
    if (!service) {
      return res.status(404).json({ error: "Not found", message: "Service not found" });
    }
    res.json(service);
  } catch (error) {
    console.error("Error fetching service:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch service" });
  }
};

export const createService: RequestHandler = (req, res) => {
  try {
    const { name, description, price, duration, category, image_url, is_active } = req.body as CreateServiceRequest;

    if (!name || !description || typeof price !== "number" || !duration || !category) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: name, description, price, duration, category",
      });
    }

    const service = db.createService({
      name,
      description,
      price,
      duration,
      category,
      image_url: image_url || null,
      is_active: is_active !== false,
    });

    res.status(201).json(service);
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to create service" });
  }
};

export const updateService: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const updates = req.body as UpdateServiceRequest;
    const service = db.updateService(req.params.id, updates);

    if (!service) {
      return res.status(404).json({ error: "Not found", message: "Service not found" });
    }

    res.json(service);
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update service" });
  }
};

export const deleteService: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const deleted = db.deleteService(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Not found", message: "Service not found" });
    }

    res.json({ success: true, message: "Service deleted" });
  } catch (error) {
    console.error("Error deleting service:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to delete service" });
  }
};
