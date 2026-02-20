import { RequestHandler } from "express";
import type { CreateShiftRequest, UpdateShiftRequest } from "@shared/api";
import * as db from "../db";

function isIsoDate(value: string): boolean {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms);
}

// GET /api/v1/shifts?from=ISO&to=ISO&employee_id=...
export const getShifts: RequestHandler = (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  const employee_id = typeof req.query.employee_id === "string" ? req.query.employee_id : undefined;
  res.json(db.getShifts({ from, to, employee_id }));
};

// POST /api/v1/shifts
export const createShift: RequestHandler = (req, res) => {
  const body = (req.body ?? {}) as Partial<CreateShiftRequest>;
  const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : "";
  const start_iso = typeof body.start_iso === "string" ? body.start_iso.trim() : "";
  const end_iso = typeof body.end_iso === "string" ? body.end_iso.trim() : "";
  const notes = body.notes === undefined ? null : body.notes === null ? null : String(body.notes);

  if (!employee_id || !start_iso || !end_iso) {
    return res.status(400).json({ error: "Validation error", message: "Missing required fields: employee_id, start_iso, end_iso" });
  }
  if (!db.getEmployee(employee_id)) {
    return res.status(404).json({ error: "Not found", message: "Employee not found" });
  }
  if (!isIsoDate(start_iso) || !isIsoDate(end_iso)) {
    return res.status(400).json({ error: "Validation error", message: "start_iso/end_iso must be ISO 8601" });
  }
  if (new Date(end_iso).getTime() <= new Date(start_iso).getTime()) {
    return res.status(400).json({ error: "Validation error", message: "end_iso must be after start_iso" });
  }

  const shift = db.createShift({ employee_id, start_iso, end_iso, notes });
  res.status(201).json(shift);
};

// PUT /api/v1/shifts/:id
export const updateShift: RequestHandler<{ id: string }> = (req, res) => {
  const id = req.params.id;
  const existing = db.getShift(id);
  if (!existing) return res.status(404).json({ error: "Not found", message: "Shift not found" });

  const body = (req.body ?? {}) as Partial<UpdateShiftRequest>;
  const employee_id = typeof body.employee_id === "string" ? body.employee_id.trim() : undefined;
  const start_iso = typeof body.start_iso === "string" ? body.start_iso.trim() : undefined;
  const end_iso = typeof body.end_iso === "string" ? body.end_iso.trim() : undefined;
  const notes = body.notes === undefined ? undefined : body.notes === null ? null : String(body.notes);

  if (employee_id && !db.getEmployee(employee_id)) {
    return res.status(404).json({ error: "Not found", message: "Employee not found" });
  }
  if (start_iso && !isIsoDate(start_iso)) {
    return res.status(400).json({ error: "Validation error", message: "start_iso must be ISO 8601" });
  }
  if (end_iso && !isIsoDate(end_iso)) {
    return res.status(400).json({ error: "Validation error", message: "end_iso must be ISO 8601" });
  }

  const start = new Date(start_iso ?? existing.start_iso).getTime();
  const end = new Date(end_iso ?? existing.end_iso).getTime();
  if (end <= start) {
    return res.status(400).json({ error: "Validation error", message: "end_iso must be after start_iso" });
  }

  const updated = db.updateShift(id, {
    employee_id,
    start_iso,
    end_iso,
    notes,
  });
  res.json(updated);
};

// DELETE /api/v1/shifts/:id
export const deleteShift: RequestHandler<{ id: string }> = (req, res) => {
  const ok = db.deleteShift(req.params.id);
  if (!ok) return res.status(404).json({ error: "Not found", message: "Shift not found" });
  res.json({ ok: true });
};

