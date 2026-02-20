import "dotenv/config";
import express from "express";
import cors from "cors";
import * as servicesRoutes from "./routes/services";
import * as bookingsRoutes from "./routes/bookings";
import * as slotsRoutes from "./routes/slots";
import * as usersRoutes from "./routes/users";
import * as clientsRoutes from "./routes/clients";
import * as postsRoutes from "./routes/posts";
import * as telegramRoutes from "./routes/telegram";
import * as connectionsRoutes from "./routes/connections";
import * as authRoutes from "./routes/auth";
import * as notificationsRoutes from "./routes/notifications";
import * as newsRoutes from "./routes/news";
import * as settingsRoutes from "./routes/settings";
import * as statsRoutes from "./routes/stats";
import * as carsRoutes from "./routes/cars";
import * as companyRoutes from "./routes/company";
import * as employeesRoutes from "./routes/employees";
import * as shiftsRoutes from "./routes/shifts";
import { optionalBearerAuth, requireAuth } from "./middleware/auth";

export function createServer() {
  const app = express();

  // Middleware (увеличен лимит для загрузки автомобилей с base64-фото)
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Health check for load balancers / App Platform
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // API v1 routes (Services)
  app.get("/api/v1/services", servicesRoutes.getServices);
  app.get("/api/v1/services/:id", servicesRoutes.getService);
  app.post("/api/v1/services", servicesRoutes.createService);
  app.put("/api/v1/services/:id", servicesRoutes.updateService);
  app.delete("/api/v1/services/:id", servicesRoutes.deleteService);

  // API v1 routes (Stats for sidebar/dashboard)
  app.get("/api/v1/stats/dashboard", statsRoutes.getDashboardStats);

  // API v1 routes (Bookings)
  app.get("/api/v1/bookings", bookingsRoutes.getBookings);
  app.get("/api/v1/bookings/check", (_req, res) => res.json({ ok: true, message: "Booking API reachable from iOS" }));
  app.get("/api/v1/bookings/:id", bookingsRoutes.getBooking);
  app.get("/api/v1/bookings/:id/act", bookingsRoutes.getBookingAct);
  app.post("/api/v1/bookings", bookingsRoutes.createBooking);
  app.put("/api/v1/bookings/:id", requireAuth, bookingsRoutes.updateBookingStatus);
  app.patch("/api/v1/bookings/:id/employee", requireAuth, bookingsRoutes.assignBookingEmployee);
  app.patch("/api/v1/bookings/:id/control", requireAuth, bookingsRoutes.updateBookingControl);
  app.delete("/api/v1/bookings/:id", requireAuth, bookingsRoutes.deleteBooking);
  app.post("/api/v1/bookings/:id/rating", bookingsRoutes.submitBookingRating);

  // Алиасы для iOS (если приложение ходит на /api/client/...)
  app.post("/api/client/appointments/:id/rating", bookingsRoutes.submitBookingRating);
  app.post("/api/client/appointments", bookingsRoutes.createBooking);

  // API v1 routes (Time Slots)
  app.get("/api/v1/slots", slotsRoutes.getSlots);

  // API v1 routes (Users/Profile)
  app.get("/api/v1/users", usersRoutes.getUsers);
  app.get("/api/v1/users/:id", usersRoutes.getUser);
  app.put("/api/v1/users/:id", requireAuth, usersRoutes.updateUserById);
  app.get("/api/v1/profile", usersRoutes.getProfile);
  app.put("/api/v1/profile", usersRoutes.updateProfile);
  app.post("/api/v1/users", usersRoutes.createUser);
  app.post("/api/v1/users/import", usersRoutes.importUsers);

  // API v1 routes (Employees / Shifts)
  app.get("/api/v1/employees", requireAuth, employeesRoutes.getEmployees);
  app.get("/api/v1/employees/analytics", requireAuth, employeesRoutes.getEmployeesAnalytics);
  app.get("/api/v1/employees/timesheet", requireAuth, employeesRoutes.getTimesheet);
  app.post("/api/v1/employees/import", requireAuth, employeesRoutes.importEmployeesData);
  app.post("/api/v1/employees", requireAuth, employeesRoutes.createEmployee);
  app.put("/api/v1/employees/:id", requireAuth, employeesRoutes.updateEmployee);
  app.delete("/api/v1/employees/:id", requireAuth, employeesRoutes.deleteEmployee);

  app.get("/api/v1/shifts", requireAuth, shiftsRoutes.getShifts);
  app.post("/api/v1/shifts", requireAuth, shiftsRoutes.createShift);
  app.put("/api/v1/shifts/:id", requireAuth, shiftsRoutes.updateShift);
  app.delete("/api/v1/shifts/:id", requireAuth, shiftsRoutes.deleteShift);

  // API v1 routes (Settings / QR)
  app.get("/api/v1/settings/api-url", settingsRoutes.getApiUrl);
  app.get("/api/v1/settings/display-photo-rule", settingsRoutes.getDisplayPhotoRule);
  app.put("/api/v1/settings/display-photo-rule", requireAuth, settingsRoutes.updateDisplayPhotoRule);

  // API v1 routes (Cars / Avatars)
  app.get("/api/v1/cars/folders", carsRoutes.getCarFolders);
  app.get("/api/v1/cars/folders/name/:name", carsRoutes.getCarFolderByName);
  app.get("/api/v1/cars/folders/:id", carsRoutes.getCarFolder);
  app.post("/api/v1/cars/folders", requireAuth, carsRoutes.createCarFolder);
  app.put("/api/v1/cars/folders/:id", requireAuth, carsRoutes.updateCarFolder);
  app.delete("/api/v1/cars/folders/:id", requireAuth, carsRoutes.deleteCarFolder);

  // API v1 routes (Clients Registration)
  app.post("/api/v1/clients/register", clientsRoutes.registerClient);

  // API v1 routes (Public company/operator info for clients)
  app.get("/api/v1/company", companyRoutes.getPublicCompany);

  // API v1 routes (Notifications — iOS client + admin)
  app.get("/api/v1/notifications", notificationsRoutes.getNotifications);
  app.patch("/api/v1/notifications/:id/read", notificationsRoutes.markNotificationRead);
  app.post("/api/v1/notifications", requireAuth, notificationsRoutes.createNotification);

  // API v1 routes (News — admin creates, clients see as notifications/messages)
  app.get("/api/v1/news", optionalBearerAuth, newsRoutes.getNews);
  app.post("/api/v1/news", requireAuth, newsRoutes.createNews);
  app.put("/api/v1/news/:id", requireAuth, newsRoutes.updateNews);

  // API v1 routes (Car wash posts)
  app.get("/api/v1/posts", postsRoutes.getPosts);
  app.post("/api/v1/posts", postsRoutes.createPost);
  app.put("/api/v1/posts/:id", postsRoutes.updatePost);
  app.delete("/api/v1/posts/:id", postsRoutes.deletePost);
  app.get("/api/v1/posts/:id/slots", postsRoutes.getPostDaySlots);
  app.put("/api/v1/posts/:id/slots/closed", postsRoutes.setPostDaySlotClosed);
  app.get("/api/v1/working-hours", postsRoutes.getWorkingHours);
  app.put("/api/v1/working-hours", postsRoutes.setWorkingHours);

  // API v1 routes (Telegram Bot)
  app.get("/api/v1/telegram/bot-info", telegramRoutes.getBotInfo);
  app.put("/api/v1/telegram/bot-token", requireAuth, telegramRoutes.setBotToken);
  app.get("/api/v1/telegram/settings", requireAuth, telegramRoutes.getSettings);
  app.put("/api/v1/telegram/settings", requireAuth, telegramRoutes.updateSettings);
  app.post("/api/v1/telegram/send-test", requireAuth, telegramRoutes.sendTest);
  app.post("/api/v1/telegram/webhook", telegramRoutes.webhook);
  app.post("/api/v1/telegram/set-webhook", requireAuth, telegramRoutes.setWebhook);

  // API v1 routes (Device Connections)
  app.get("/api/v1/connections", connectionsRoutes.getConnections);
  app.get("/api/v1/connections/:id", connectionsRoutes.getConnection);
  app.post("/api/v1/connections", connectionsRoutes.createConnection);
  app.put("/api/v1/connections/:id", connectionsRoutes.updateConnection);
  app.delete("/api/v1/connections/:id", connectionsRoutes.deleteConnection);
  app.post("/api/v1/connections/link-client", connectionsRoutes.linkClientToDevice);
  app.get("/api/v1/connections/verify/token", connectionsRoutes.getConnectionByToken);

  // API v1 routes (Authentication) — только вход по телефону + пароль
  app.post("/api/v1/auth/login/phone", authRoutes.loginByPhone);
  // Telegram Login Widget (для web-клиента/консоли)
  app.get("/api/v1/auth/telegram/widget-config", authRoutes.getTelegramWidgetConfig);
  app.post("/api/v1/auth/login/telegram", authRoutes.loginByTelegram);
  app.get("/api/v1/auth/me", authRoutes.getMe);
  app.put("/api/v1/auth/organization", authRoutes.updateOrganization);
  app.post("/api/v1/auth/logout", authRoutes.logout);

  return app;
}
