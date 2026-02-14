import type { RequestHandler } from "express";
import * as db from "../db";

export const getDashboardStats: RequestHandler = (_req, res) => {
  try {
    const bookings = db.getBookings();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayBookings = bookings.filter((b) => {
      const d = new Date(b.date_time);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    });
    const pendingBookings = bookings.filter((b) => b.status === "pending");
    res.json({
      bookingsToday: todayBookings.length,
      bookingsPending: pendingBookings.length,
    });
  } catch (e) {
    console.error("getDashboardStats:", e);
    res.status(500).json({ bookingsToday: 0, bookingsPending: 0 });
  }
};
