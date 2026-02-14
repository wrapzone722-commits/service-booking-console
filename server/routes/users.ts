import { RequestHandler } from "express";
import { UpdateUserRequest } from "@shared/api";
import * as db from "../db";
import { verifyToken } from "./auth";

type UserImportInput = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string | null;
  avatar_url?: string | null;
  social_links?: Record<string, string | null | undefined>;
  status?: "active" | "inactive" | "vip";
  loyalty_points?: number;
  created_at?: string;
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

export const getUsers: RequestHandler = (req, res) => {
  try {
    const users = db.getUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch users" });
  }
};

export const getUser: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const user = db.getUser(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Not found", message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch user" });
  }
};

export const getProfile: RequestHandler = (req, res) => {
  try {
    let user = null;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth) {
        user = db.getUser(clientAuth.client_id);
      } else if (verifyToken(token)) {
        const users = db.getUsers();
        user = users[0] ?? null;
      }
    }

    if (!user) {
      const users = db.getUsers();
      user = users[0] ?? null;
    }

    if (!user) {
      return res.status(404).json({ error: "Not found", message: "Profile not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch profile" });
  }
};

export const updateProfile: RequestHandler = (req, res) => {
  try {
    const updates = req.body as UpdateUserRequest;
    let userId: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth) {
        userId = clientAuth.client_id;
      } else if (verifyToken(token)) {
        const users = db.getUsers();
        userId = users[0]?._id ?? null;
      }
    }

    if (!userId) {
      const users = db.getUsers();
      userId = users[0]?._id ?? null;
    }

    if (!userId) {
      return res.status(404).json({ error: "Not found", message: "Profile not found" });
    }

    const user = db.updateUser(userId, updates);
    if (!user) {
      return res.status(404).json({ error: "Not found", message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update profile" });
  }
};

export const createUser: RequestHandler = (req, res) => {
  try {
    const { first_name, last_name, phone, email, avatar_url, social_links } = req.body;

    if (!first_name || !last_name || !phone) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: first_name, last_name, phone",
      });
    }

    // Check if user with this email already exists
    if (email && db.getUserByEmail(email)) {
      return res.status(409).json({
        error: "Conflict",
        message: "User with this email already exists",
      });
    }

    const user = db.createUser({
      first_name,
      last_name,
      phone,
      email: email || null,
      avatar_url: avatar_url || null,
      social_links: social_links || {},
      status: req.body?.status === "inactive" || req.body?.status === "vip" ? req.body.status : "active",
      loyalty_points: Number.isFinite(Number(req.body?.loyalty_points)) ? Number(req.body.loyalty_points) : 0,
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to create user" });
  }
};

export const importUsers: RequestHandler = (req, res) => {
  try {
    const items = Array.isArray(req.body?.clients) ? (req.body.clients as UserImportInput[]) : [];
    if (!items.length) {
      return res.status(400).json({
        error: "Validation error",
        message: "Передайте массив clients для импорта",
      });
    }

    const existing = db.getUsers();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of items) {
      const firstName = String(row.first_name ?? "").trim();
      const lastName = String(row.last_name ?? "").trim();
      const phone = String(row.phone ?? "").trim();
      const email = row.email ? String(row.email).trim().toLowerCase() : null;

      if (!firstName || !phone) {
        skipped += 1;
        continue;
      }

      const normalized = normalizePhone(phone);
      const match = existing.find((u) => normalizePhone(u.phone) === normalized) ??
        (email ? existing.find((u) => (u.email || "").toLowerCase() === email) : undefined);

      const status: "active" | "inactive" | "vip" =
        row.status === "inactive" || row.status === "vip" ? row.status : "active";
      const payload: {
        first_name: string;
        last_name: string;
        phone: string;
        email: string | null;
        avatar_url: string | null;
        social_links: Record<string, string | null | undefined>;
        status: "active" | "inactive" | "vip";
        loyalty_points: number;
      } = {
        first_name: firstName,
        last_name: lastName || "-",
        phone,
        email,
        avatar_url: row.avatar_url ?? null,
        social_links: row.social_links ?? {},
        status,
        loyalty_points: Number.isFinite(Number(row.loyalty_points)) ? Number(row.loyalty_points) : 0,
      };

      if (match) {
        db.updateUser(match._id, payload);
        updated += 1;
      } else {
        const createdUser = db.createUser(payload);
        if (row.created_at && !Number.isNaN(new Date(row.created_at).getTime())) {
          db.updateUser(createdUser._id, { created_at: row.created_at });
        }
        created += 1;
      }
    }

    res.json({
      success: true,
      total: items.length,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    console.error("Error importing users:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to import users" });
  }
};
