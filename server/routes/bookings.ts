import { RequestHandler } from "express";
import { CreateBookingRequest, UpdateBookingStatusRequest } from "@shared/api";
import * as db from "../db";

export const getBookings: RequestHandler = (req, res) => {
  try {
    const bookings = db.getBookings();
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

    // For demo: use first user or create one
    let user = db.getUsers()[0];
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

    const booking = db.updateBooking(req.params.id, { status });

    if (!booking) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update booking" });
  }
};

export const deleteBooking: RequestHandler<{ id: string }> = (req, res) => {
  try {
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
