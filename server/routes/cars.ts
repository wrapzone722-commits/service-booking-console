import { RequestHandler } from "express";
import type { CarFolder, CarImage } from "@shared/api";
import * as db from "../db";

/** Имя файла без расширения (01.jpg, 01.png, 01.JPG → "01"). */
const getBaseName = (filename: string) => filename.replace(/\.[^/.]+$/, "").trim();

/** Для превью всегда фото с именем default_photo_name (обычно "01"); подходят любые расширения (.jpg, .png и т.д.). */
function withProfilePreview(folder: CarFolder): CarFolder {
  const key = (folder.default_photo_name || "01").trim();
  const img: CarImage | undefined = folder.images.find((i) => getBaseName(i.name) === key) ?? folder.images[0];
  return {
    ...folder,
    profile_preview_url: img?.url,
    profile_preview_thumbnail_url: img?.thumbnail_url,
  };
}

export const getCarFolders: RequestHandler = (_req, res) => {
  try {
    const folders = db.getCarFolders().map(withProfilePreview);
    res.json(folders);
  } catch (error) {
    console.error("Error fetching car folders:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch car folders" });
  }
};

export const getCarFolder: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const folder = db.getCarFolder(req.params.id);
    if (!folder) {
      return res.status(404).json({ error: "Not found", message: "Car folder not found" });
    }
    res.json(withProfilePreview(folder));
  } catch (error) {
    console.error("Error fetching car folder:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch car folder" });
  }
};

export const getCarFolderByName: RequestHandler<{ name: string }> = (req, res) => {
  try {
    const folder = db.getCarFolderByName(decodeURIComponent(req.params.name));
    if (!folder) {
      return res.status(404).json({ error: "Not found", message: "Car folder not found" });
    }
    res.json(withProfilePreview(folder));
  } catch (error) {
    console.error("Error fetching car folder by name:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch car folder" });
  }
};

export const createCarFolder: RequestHandler = (req, res) => {
  try {
    const { name, images } = req.body ?? {};
    if (!name || typeof name !== "string" || !Array.isArray(images)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: name (string), images (array)",
      });
    }
    const folder = db.createCarFolder({
      name: name.trim(),
      images: images,
      default_photo_name: "01",
    });
    res.status(201).json(withProfilePreview(folder));
  } catch (error) {
    console.error("Error creating car folder:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to create car folder" });
  }
};

export const updateCarFolder: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const { name, images } = req.body ?? {};
    const updates: { name?: string; images?: { name: string; url: string; thumbnail_url: string }[] } = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (Array.isArray(images)) updates.images = images;
    const folder = db.updateCarFolder(req.params.id, updates);
    if (!folder) {
      return res.status(404).json({ error: "Not found", message: "Car folder not found" });
    }
    res.json(withProfilePreview(folder));
  } catch (error) {
    console.error("Error updating car folder:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update car folder" });
  }
};

export const deleteCarFolder: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const deleted = db.deleteCarFolder(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Not found", message: "Car folder not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting car folder:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to delete car folder" });
  }
};
