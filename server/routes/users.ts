import { RequestHandler } from "express";
import { UpdateUserRequest } from "@shared/api";
import type { ClientTier } from "@shared/api";
import * as db from "../db";
import { verifyToken } from "./auth";
import { getApiKeyFromRequest } from "../middleware/auth";

type UserImportInput = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string | null;
  avatar_url?: string | null;
  social_links?: Record<string, string | null | undefined>;
  status?: "active" | "inactive" | "vip";
  client_tier?: ClientTier;
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
    db.getUsers(); // ensure at least one user exists (avoids 404 on fresh/restarted server)
    let user = null;
    const token = getApiKeyFromRequest(req);

    if (token) {
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

    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Клиент";
    const telegram = user.social_links?.telegram ?? null;
    const clientTier = user.client_tier ?? (user.status === "vip" ? "pride" : "client");

    const lastCompleted = db.getLastCompletedBookingDateForClient(user._id);
    let daysSince = 0;
    if (lastCompleted) {
      daysSince = Math.floor((Date.now() - new Date(lastCompleted).getTime()) / 86400000);
    }
    const display_photo_name = db.getDisplayPhotoNameByRule(daysSince);

    const profile = {
      ...user,
      name,
      profile_photo_url: user.avatar_url,
      car_make: user.car_make ?? null,
      car_plate: user.car_plate ?? null,
      promo_code: user.promo_code ?? null,
      telegram,
      client_tier: clientTier,
      is_vip: clientTier === "pride" || user.status === "vip",
      display_photo_name,
    };
    res.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch profile" });
  }
};

export const updateProfile: RequestHandler = (req, res) => {
  try {
    const body = req.body as UpdateUserRequest & { name?: string; profile_photo_url?: string; telegram?: string };
    let userId: string | null = null;
    const token = getApiKeyFromRequest(req);

    if (token) {
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

    const updates: Parameters<typeof db.updateUser>[1] = {};
    if (body.first_name !== undefined) updates.first_name = body.first_name;
    if (body.last_name !== undefined) updates.last_name = body.last_name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.email !== undefined) updates.email = body.email;
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;
    if (body.profile_photo_url !== undefined) updates.avatar_url = body.profile_photo_url ?? null;
    if (body.name !== undefined) {
      const parts = String(body.name).trim().split(/\s+/);
      updates.first_name = parts[0] ?? "";
      updates.last_name = parts.slice(1).join(" ") ?? "";
    }
    if (body.car_make !== undefined) updates.car_make = body.car_make ?? undefined;
    if (body.car_plate !== undefined) updates.car_plate = body.car_plate ?? undefined;
    if (body.promo_code !== undefined) updates.promo_code = body.promo_code ?? undefined;
    if (body.social_links !== undefined) updates.social_links = body.social_links;
    if (body.telegram !== undefined) {
      const existing = db.getUser(userId);
      updates.social_links = { ...existing?.social_links, telegram: body.telegram ?? undefined };
    }
    if (body.status !== undefined) updates.status = body.status;
    if (body.client_tier !== undefined) updates.client_tier = body.client_tier;
    if (body.loyalty_points !== undefined) updates.loyalty_points = body.loyalty_points;

    const user = db.updateUser(userId, updates);
    if (!user) {
      return res.status(404).json({ error: "Not found", message: "User not found" });
    }

    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Клиент";
    const clientTier = user.client_tier ?? (user.status === "vip" ? "pride" : "client");
    const lastCompletedUpd = db.getLastCompletedBookingDateForClient(userId);
    let daysSinceUpd = 0;
    if (lastCompletedUpd) {
      daysSinceUpd = Math.floor((Date.now() - new Date(lastCompletedUpd).getTime()) / 86400000);
    }
    const display_photo_name_upd = db.getDisplayPhotoNameByRule(daysSinceUpd);
    const profile = {
      ...user,
      name,
      profile_photo_url: user.avatar_url,
      car_make: user.car_make ?? null,
      car_plate: user.car_plate ?? null,
      promo_code: user.promo_code ?? null,
      telegram: user.social_links?.telegram ?? null,
      client_tier: clientTier,
      is_vip: clientTier === "pride" || user.status === "vip",
      display_photo_name: display_photo_name_upd,
    };
    res.json(profile);
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update profile" });
  }
};

/** Обновить клиента (админ). Доступны: client_tier, loyalty_points, status, имя, контакты. */
export const updateUserById: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "Not found", message: "User not found" });
    }
    const body = req.body as Partial<UpdateUserRequest>;
    const updates: Parameters<typeof db.updateUser>[1] = {};
    if (body.first_name !== undefined) updates.first_name = body.first_name;
    if (body.last_name !== undefined) updates.last_name = body.last_name;
    if (body.phone !== undefined) updates.phone = body.phone;
    if (body.email !== undefined) updates.email = body.email;
    if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;
    if (body.status !== undefined) updates.status = body.status;
    if (body.client_tier !== undefined) updates.client_tier = body.client_tier;
    if (body.loyalty_points !== undefined) updates.loyalty_points = body.loyalty_points;
    if (body.car_make !== undefined) updates.car_make = body.car_make;
    if (body.car_plate !== undefined) updates.car_plate = body.car_plate;
    if (body.promo_code !== undefined) updates.promo_code = body.promo_code;
    if (body.social_links !== undefined) updates.social_links = body.social_links;
    const updated = db.updateUser(userId, updates);
    if (!updated) {
      return res.status(404).json({ error: "Not found", message: "User not found" });
    }
    res.json(updated);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update user" });
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
      client_tier: req.body?.client_tier ?? "client",
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
      const tierRaw = (row.client_tier ?? "").toString().toLowerCase();
      const client_tier: ClientTier =
        tierRaw === "regular" || tierRaw === "постоянный" ? "regular" :
        tierRaw === "pride" || tierRaw === "прайд" ? "pride" : "client";
      const payload: {
        first_name: string;
        last_name: string;
        phone: string;
        email: string | null;
        avatar_url: string | null;
        social_links: Record<string, string | null | undefined>;
        status: "active" | "inactive" | "vip";
        client_tier: ClientTier;
        loyalty_points: number;
      } = {
        first_name: firstName,
        last_name: lastName || "-",
        phone,
        email,
        avatar_url: row.avatar_url ?? null,
        social_links: row.social_links ?? {},
        status,
        client_tier,
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
