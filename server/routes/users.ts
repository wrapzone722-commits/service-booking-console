import { RequestHandler } from "express";
import { UpdateUserRequest } from "@shared/api";
import * as db from "../db";
import { verifyToken } from "./auth";

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
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to create user" });
  }
};
