import { RequestHandler } from "express";
import { UpdateUserRequest } from "@shared/api";
import * as db from "../db";

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
    // In a real app, this would use the authenticated user from the session/JWT
    // For demo, we'll return the first user
    const users = db.getUsers();
    if (users.length === 0) {
      return res.status(404).json({ error: "Not found", message: "No users found" });
    }
    res.json(users[0]);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch profile" });
  }
};

export const updateProfile: RequestHandler = (req, res) => {
  try {
    const updates = req.body as UpdateUserRequest;

    // In a real app, this would use the authenticated user from the session/JWT
    const users = db.getUsers();
    if (users.length === 0) {
      return res.status(404).json({ error: "Not found", message: "No users found" });
    }

    const user = db.updateUser(users[0]._id, updates);
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
