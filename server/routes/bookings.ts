import { RequestHandler } from "express";
import { Booking, CreateBookingRequest, UpdateBookingStatusRequest } from "@shared/api";
import * as db from "../db";
import { notifyNewBooking, notifyBookingCancelled, notifyBookingConfirmed } from "../lib/telegram";
import { verifyToken } from "./auth";

export const getBookings: RequestHandler = (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let clientId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth) {
        clientId = clientAuth.client_id;
      }
    }

    let bookings = db.getBookings();
    if (clientId) {
      bookings = bookings.filter((b) => b.user_id === clientId);
    }
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch bookings" });
  }
};

export const getBooking: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const booking = db.getBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }
    res.json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to fetch booking" });
  }
};

export const createBooking: RequestHandler = (req, res) => {
  try {
    const { service_id, date_time, notes, post_id } = req.body as CreateBookingRequest;

    if (!service_id || !date_time) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required fields: service_id, date_time",
      });
    }

    const service = db.getService(service_id);
    if (!service) {
      return res.status(404).json({ error: "Not found", message: "Service not found" });
    }

    const postId = post_id || "post_1";
    const post = db.getPost(postId);
    if (!post) {
      return res.status(404).json({ error: "Not found", message: "Post not found" });
    }
    if (!post.is_enabled) {
      return res.status(409).json({ error: "Conflict", message: "Post is disabled" });
    }

    // Resolve user: from api_key (iOS client) or JWT (admin) or fallback to first user (no auth)
    let user: { _id: string; first_name: string; last_name: string } | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth) {
        user = db.getUser(clientAuth.client_id);
        if (!user) {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Client not found. Re-register the device.",
          });
        }
      } else {
        const jwtPayload = verifyToken(token);
        if (jwtPayload) {
          user = bodyUserId ? db.getUser(bodyUserId) : db.getUsers()[0];
        } else {
          return res.status(401).json({
            error: "Unauthorized",
            message: "Invalid or expired token. Use api_key from POST /clients/register",
          });
        }
      }
    }
    if (!user) {
      user = db.getUsers()[0];
    }
    if (!user) {
      user = db.createUser({
        first_name: "Guest",
        last_name: "User",
        phone: "+7 000 000 0000",
        email: null,
        avatar_url: null,
        social_links: {},
      });
    }

    const booking = db.createBooking({
      service_id,
      service_name: service.name,
      user_id: user._id,
      user_name: `${user.first_name} ${user.last_name}`,
      post_id: postId,
      date_time,
      status: "pending",
      price: service.price,
      duration: service.duration,
      notes: notes || null,
    });

    notifyNewBooking(booking).catch((e) => console.error("Telegram notify error:", e));

    res.status(201).json(booking);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to create booking" });
  }
};

export const updateBookingStatus: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const { status } = req.body as UpdateBookingStatusRequest;

    if (!status) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing required field: status",
      });
    }

    const validStatuses = ["pending", "confirmed", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid status. Valid statuses: pending, confirmed, in_progress, completed, cancelled",
      });
    }

    const prev = db.getBooking(req.params.id);
    const updates: Partial<Booking> = { status };

    if (status === "in_progress") {
      updates.in_progress_started_at = new Date().toISOString();
    }

    const booking = db.updateBooking(req.params.id, updates);

    if (!booking) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }

    if (prev && prev.status !== status) {
      if (status === "cancelled") notifyBookingCancelled(booking).catch((e) => console.error("Telegram notify:", e));
      if (status === "confirmed") {
        notifyBookingConfirmed(booking).catch((e) => console.error("Telegram notify:", e));
        db.createNotification({
          client_id: booking.user_id,
          body: `Запись на "${booking.service_name}" подтверждена на ${new Date(booking.date_time).toLocaleString("ru-RU")}.`,
          type: "service",
          title: "Запись подтверждена",
        });
      }
      if (status === "completed") {
        db.createNotification({
          client_id: booking.user_id,
          body: "Ваш авто готов. Администратор подтвердил завершение услуги.",
          type: "service",
          title: "Услуга завершена",
        });
      }
    }

    res.json(booking);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update booking" });
  }
};

export const deleteBooking: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const booking = db.getBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth && booking.user_id !== clientAuth.client_id) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only cancel your own bookings",
        });
      }
    }

    const deleted = db.deleteBooking(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }

    res.json({ success: true, message: "Booking deleted" });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to delete booking" });
  }
};
