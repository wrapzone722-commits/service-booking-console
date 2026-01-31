import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import * as servicesRoutes from "./routes/services";
import * as bookingsRoutes from "./routes/bookings";
import * as slotsRoutes from "./routes/slots";
import * as usersRoutes from "./routes/users";
import * as clientsRoutes from "./routes/clients";
import * as postsRoutes from "./routes/posts";
import * as assistantRoutes from "./routes/assistant";
import * as connectionsRoutes from "./routes/connections";
import * as authRoutes from "./routes/auth";
import { requireAuth } from "./middleware/auth";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check for load balancers / App Platform
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // API v1 routes (Services)
  app.get("/api/v1/services", servicesRoutes.getServices);
  app.get("/api/v1/services/:id", servicesRoutes.getService);
  app.post("/api/v1/services", servicesRoutes.createService);
  app.put("/api/v1/services/:id", servicesRoutes.updateService);
  app.delete("/api/v1/services/:id", servicesRoutes.deleteService);

  // API v1 routes (Bookings)
  app.get("/api/v1/bookings", bookingsRoutes.getBookings);
  app.get("/api/v1/bookings/:id", bookingsRoutes.getBooking);
  app.post("/api/v1/bookings", bookingsRoutes.createBooking);
  app.put("/api/v1/bookings/:id", bookingsRoutes.updateBookingStatus);
  app.delete("/api/v1/bookings/:id", bookingsRoutes.deleteBooking);

  // API v1 routes (Time Slots)
  app.get("/api/v1/slots", slotsRoutes.getSlots);

  // API v1 routes (Users/Profile)
  app.get("/api/v1/users", usersRoutes.getUsers);
  app.get("/api/v1/users/:id", usersRoutes.getUser);
  app.get("/api/v1/profile", usersRoutes.getProfile);
  app.put("/api/v1/profile", usersRoutes.updateProfile);
  app.post("/api/v1/users", usersRoutes.createUser);

  // API v1 routes (Clients Registration)
  app.post("/api/v1/clients/register", clientsRoutes.registerClient);

  // API v1 routes (Car wash posts)
  app.get("/api/v1/posts", postsRoutes.getPosts);
  app.put("/api/v1/posts/:id", postsRoutes.updatePost);
  app.get("/api/v1/posts/:id/slots", postsRoutes.getPostDaySlots);
  app.put("/api/v1/posts/:id/slots/closed", postsRoutes.setPostDaySlotClosed);

  // API v1 routes (Assistant)
  app.post("/api/v1/assistant/chat", assistantRoutes.chat);

  // API v1 routes (Device Connections)
  app.get("/api/v1/connections", connectionsRoutes.getConnections);
  app.get("/api/v1/connections/:id", connectionsRoutes.getConnection);
  app.post("/api/v1/connections", connectionsRoutes.createConnection);
  app.put("/api/v1/connections/:id", connectionsRoutes.updateConnection);
  app.delete("/api/v1/connections/:id", connectionsRoutes.deleteConnection);
  app.post("/api/v1/connections/link-client", connectionsRoutes.linkClientToDevice);
  app.get("/api/v1/connections/verify/token", connectionsRoutes.getConnectionByToken);

  // API v1 routes (Authentication)
  app.post("/api/v1/auth/register", authRoutes.register);
  app.post("/api/v1/auth/register/yandex", authRoutes.registerWithYandex);
  app.post("/api/v1/auth/login", authRoutes.login);
  app.post("/api/v1/auth/login/phone", authRoutes.loginByPhone);
  app.post("/api/v1/auth/login/telegram", authRoutes.loginByTelegram);
  app.post("/api/v1/auth/send-sms-code", authRoutes.sendSmsCode);
  app.post("/api/v1/auth/verify-phone", authRoutes.verifyPhoneSms);
  app.post("/api/v1/auth/verify-email", authRoutes.verifyEmail);
  app.get("/api/v1/auth/me", authRoutes.getMe);
  app.post("/api/v1/auth/logout", authRoutes.logout);
  app.get("/api/v1/auth/yandex/url", authRoutes.getYandexAuthUrl);
  app.post("/api/v1/auth/yandex/callback", authRoutes.yandexCallback);
  app.get("/api/v1/auth/telegram/widget-config", authRoutes.getTelegramWidgetConfig);

  return app;
}
