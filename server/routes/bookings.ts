import { RequestHandler } from "express";
import { AssignBookingEmployeeRequest, Booking, UpdateBookingStatusRequest, type BookingControlStatus } from "@shared/api";
import * as db from "../db";
import {
  notifyNewBooking,
  notifyBookingCancelled,
  notifyBookingConfirmed,
  notifyClientBookingCancelled,
  notifyClientBookingCompleted,
  notifyClientBookingConfirmed,
  notifyClientBookingInProgress,
} from "../lib/telegram";
import { verifyToken } from "./auth";
import { getApiKeyFromRequest } from "../middleware/auth";
import { buildActPdf } from "../lib/act-pdf";
import { buildActHtml } from "../lib/act-html";

/** POST body для оценки записи (iOS RatingView) */
interface RatingRequestBody {
  rating: number;
  comment?: string | null;
}

export const getBookings: RequestHandler = (req, res) => {
  try {
    const token = getApiKeyFromRequest(req);
    let clientId: string | null = null;
    if (token) {
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth) clientId = clientAuth.client_id;
    }

    let bookings = db.getBookings();
    if (clientId) {
      bookings = bookings
        .filter((b) => b.user_id === clientId)
        // не отдаём клиенту внутренние поля контроля записи
        .map((b) => ({
          ...b,
          control_status: undefined,
          control_comment: undefined,
          control_updated_at: undefined,
        }));
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

/** Собирает ISO дату-время из полей date + time (например "2026-02-17" и "19:30") */
function toISOFromDateAndTime(dateStr: string | undefined, timeStr: string | undefined): string | null {
  if (!dateStr || !timeStr) return null;
  const date = new Date(dateStr + "T" + timeStr.replace(/^(\d{1,2}):(\d{2})$/, "$1:$2:00"));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Нормализует тело запроса от iOS: поддерживаем snake_case и camelCase, date_time/start_iso/slot/time или date+time */
function normalizeCreateBookingBody(
  body: Record<string, unknown>
): { service_id: string; date_time: string; post_id?: string; notes?: string | null; user_id?: string } | null {
  const service_id =
    (body.service_id as string) ?? (body.serviceId as string) ?? null;
  let date_time: string | null =
    (body.date_time as string) ??
    (body.start_iso as string) ??
    (body.startIso as string) ??
    (body.slot as string) ??
    (body.time as string) ??
    (body.dateTime as string) ??
    null;
  if (!date_time) {
    const fromParts = toISOFromDateAndTime(
      (body.date as string) ?? (body.dateStr as string),
      (body.time as string) ?? (body.timeStr as string)
    );
    if (fromParts) date_time = fromParts;
  }
  const post_id = (body.post_id as string) ?? (body.postId as string) ?? undefined;
  const notes = (body.notes as string | null) ?? null;
  const user_id = (body.user_id as string) ?? (body.userId as string) ?? undefined;
  if (!service_id || !date_time) return null;
  return { service_id, date_time, post_id, notes, user_id };
}

export const createBooking: RequestHandler = (req, res) => {
  try {
    // Логируем каждый входящий запрос (чтобы убедиться, что iOS доходит до сервера)
    console.log("[bookings] POST create request", {
      url: req.url,
      path: req.path,
      contentType: req.headers["content-type"],
      bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body) : "no-body",
    });

    const rawBody = req.body;
    if (!rawBody || typeof rawBody !== "object") {
      console.warn("[bookings] Create failed: empty or invalid body");
      return res.status(400).json({
        error: "Validation error",
        message: "Request body must be JSON. Send Content-Type: application/json and body: { service_id, date_time } or { serviceId, dateTime } (or start_iso / slot / time).",
      });
    }

    const parsed = normalizeCreateBookingBody(rawBody as Record<string, unknown>);
    if (!parsed) {
      const keys = Object.keys(rawBody).join(", ");
      console.warn("[bookings] Create failed: missing service_id or date_time. Received keys:", keys);
      return res.status(400).json({
        error: "Validation error",
        message: `Missing required fields: service_id (or serviceId) and date_time (or start_iso, slot, time, dateTime). Received: ${keys || "none"}`,
      });
    }

    const { service_id, date_time, post_id, notes, user_id: bodyUserId } = parsed;

    console.log("[bookings] POST create parsed", {
      service_id,
      date_time: date_time?.slice(0, 25),
      hasAuth: !!getApiKeyFromRequest(req),
    });

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

    // Resolve user: from X-API-Key or Bearer (iOS client) or JWT (admin) or fallback to first user
    let user: { _id: string; first_name: string; last_name: string } | null = null;
    const token = getApiKeyFromRequest(req);
    if (token) {
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth) {
        user = db.getUser(clientAuth.client_id);
        if (!user) {
          console.warn("[bookings] Create failed: client not found for api_key");
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
          console.warn("[bookings] Create failed: invalid or expired token (iOS: проверьте api_key и заголовок X-API-Key или Authorization: Bearer)");
          return res.status(401).json({
            error: "Unauthorized",
            message: "Invalid or expired token. Use X-API-Key or Bearer api_key from POST /api/v1/clients/register",
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
      control_status: "pending",
      control_comment: null,
      control_updated_at: null,
      price: service.price,
      duration: service.duration,
      notes: notes || null,
    });

    notifyNewBooking(booking).catch((e) => console.error("Telegram notify error:", e));

    console.log("[bookings] Created", booking._id, booking.service_name, booking.user_name);
    res.status(201).json(booking);
  } catch (error) {
    console.error("[bookings] Error creating booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to create booking" });
  }
};

export const updateBookingControl: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const booking = db.getBooking(req.params.id);
    if (!booking) return res.status(404).json({ error: "Not found", message: "Booking not found" });

    const { status, comment } = (req.body ?? {}) as { status?: BookingControlStatus; comment?: string | null };
    const allowed: BookingControlStatus[] = ["pending", "confirmed", "callback", "no_answer", "cancelled"];

    if (status === undefined && comment === undefined) {
      return res.status(400).json({ error: "Validation error", message: "Provide status and/or comment" });
    }
    if (status !== undefined && !allowed.includes(status)) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid status. Valid: pending, confirmed, callback, no_answer, cancelled",
      });
    }

    const updated = db.updateBooking(req.params.id, {
      control_status: status ?? booking.control_status ?? "pending",
      control_comment: comment === undefined ? booking.control_comment ?? null : (comment ? String(comment) : null),
      control_updated_at: new Date().toISOString(),
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating booking control:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update booking control" });
  }
};

export const updateBookingStatus: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const body = req.body as UpdateBookingStatusRequest | null;
    const status = body?.status;

    console.log("[bookings] PUT status", { id: req.params.id, status: status ?? null, hasBody: !!body });

    if (!body || typeof body !== "object") {
      return res.status(400).json({
        error: "Validation error",
        message: "Request body must be JSON with status. Send Content-Type: application/json.",
      });
    }
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
      if (status === "cancelled") {
        notifyBookingCancelled(booking).catch((e) => console.error("Telegram notify:", e));
        notifyClientBookingCancelled(booking).catch((e) => console.error("Telegram client notify:", e));
      }
      if (status === "confirmed") {
        notifyBookingConfirmed(booking).catch((e) => console.error("Telegram notify:", e));
        notifyClientBookingConfirmed(booking).catch((e) => console.error("Telegram client notify:", e));
        db.createNotification({
          client_id: booking.user_id,
          body: `Запись на "${booking.service_name}" подтверждена на ${new Date(booking.date_time).toLocaleString("ru-RU")}.`,
          type: "service",
          title: "Запись подтверждена",
        });
      }
      if (status === "in_progress") {
        notifyClientBookingInProgress(booking).catch((e) => console.error("Telegram client notify:", e));
      }
      if (status === "completed") {
        notifyClientBookingCompleted(booking).catch((e) => console.error("Telegram client notify:", e));
        db.createNotification({
          client_id: booking.user_id,
          body: "Ваш авто готов. Администратор подтвердил завершение услуги.",
          type: "service",
          title: "Услуга завершена",
        });
        // Начисление баллов лояльности: 10% от суммы услуги (по правилам), минимум min_earn_points
        const rules = db.getLoyaltyRules();
        const percent = Number(rules.earn_percent ?? 10) || 0;
        const minPoints = Math.max(0, Number(rules.min_earn_points ?? 1) || 0);
        const sum = Number(booking.price ?? 0) || 0;
        const calc = Math.floor((sum * percent) / 100);
        const points = Math.max(minPoints, calc);
        if (points > 0) {
          db.adjustLoyaltyPoints(booking.user_id, points, `Начисление ${percent}% после услуги`);
        }
      }
    }

    res.json(booking);
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to update booking" });
  }
};

// PATCH /api/v1/bookings/:id/employee — назначить сотрудника на запись (для анализа “кол-ва работ”)
export const assignBookingEmployee: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const booking = db.getBooking(req.params.id);
    if (!booking) return res.status(404).json({ error: "Not found", message: "Booking not found" });

    const body = req.body as AssignBookingEmployeeRequest | null;
    if (!body || typeof body !== "object") {
      return res.status(400).json({
        error: "Validation error",
        message: "Request body must be JSON with employee_id (string or null).",
      });
    }
    const employee_id = body.employee_id === null ? null : typeof body.employee_id === "string" ? body.employee_id.trim() : undefined;
    if (employee_id === undefined) {
      return res.status(400).json({ error: "Validation error", message: "Missing required field: employee_id" });
    }

    if (employee_id) {
      const emp = db.getEmployee(employee_id);
      if (!emp) return res.status(404).json({ error: "Not found", message: "Employee not found" });
      const updated = db.updateBooking(req.params.id, { employee_id: emp._id, employee_name: emp.name });
      return res.json(updated);
    }

    const updated = db.updateBooking(req.params.id, { employee_id: null, employee_name: null });
    return res.json(updated);
  } catch (error) {
    console.error("Error assigning employee to booking:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to assign employee" });
  }
};

export const deleteBooking: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const booking = db.getBooking(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }

    // Требуется пароль владельца для удаления любой записи (без подсказок)
    const ownerPasswordExpected = process.env.OWNER_DELETE_PASSWORD || "230490";
    const ownerPasswordProvided = String(req.headers["x-owner-password"] ?? "").trim();
    if (!ownerPasswordProvided || ownerPasswordProvided !== ownerPasswordExpected) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Forbidden",
      });
    }

    const token = getApiKeyFromRequest(req);
    if (token) {
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

/** GET /api/v1/bookings/:id/act — PDF «Акт выполненных работ» для завершённой записи. Доступ: админ (JWT) или клиент (api_key) только для своей записи. */
export const getBookingAct: RequestHandler<{ id: string }> = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = db.getBooking(id);
    if (!booking) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({
        error: "Bad request",
        message: "Act is only available for completed bookings",
      });
    }

    const token = getApiKeyFromRequest(req);
    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authorization required (Bearer JWT or api_key)",
      });
    }
    const payload = verifyToken(token);
    if (payload) {
      // Admin — allow
    } else {
      const clientAuth = db.getClientAuthByApiKey(token);
      if (!clientAuth || clientAuth.client_id !== booking.user_id) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only view act for your own booking",
        });
      }
    }

    const format = String((req.query as Record<string, unknown>)?.format ?? "").toLowerCase();
    const accept = String(req.headers.accept ?? "").toLowerCase();
    const wantsHtml = format === "html" || (format !== "pdf" && accept.includes("text/html"));

    if (wantsHtml) {
      const html = buildActHtml(id);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      return;
    }

    const pdfBuffer = await buildActPdf(id);
    const filename = `akt-${id}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Error generating act PDF:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err instanceof Error ? err.message : "Failed to generate act",
    });
  }
};

/** POST /api/v1/bookings/:id/rating — оценка записи (и алиас /api/client/appointments/:id/rating для iOS). */
export const submitBookingRating: RequestHandler<{ id: string }> = (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as RatingRequestBody;

    const rating = typeof body.rating === "number" ? Math.min(5, Math.max(1, Math.round(body.rating))) : undefined;
    if (rating === undefined) {
      return res.status(400).json({
        error: "Validation error",
        message: "Missing or invalid field: rating (1–5)",
      });
    }

    const booking = db.getBooking(id);
    if (!booking) {
      return res.status(404).json({ error: "Not found", message: "Booking not found" });
    }

    const token = getApiKeyFromRequest(req);
    if (token) {
      const clientAuth = db.getClientAuthByApiKey(token);
      if (clientAuth && booking.user_id !== clientAuth.client_id) {
        return res.status(403).json({
          error: "Forbidden",
          message: "You can only rate your own bookings",
        });
      }
    }

    const comment = typeof body.comment === "string" ? body.comment.trim() || null : null;
    db.updateBooking(id, { rating, rating_comment: comment });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error submitting rating:", error);
    res.status(500).json({ error: "Internal server error", message: "Failed to submit rating" });
  }
};
