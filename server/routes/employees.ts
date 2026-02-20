import { RequestHandler } from "express";
import type { CreateEmployeeRequest, EmployeesAnalyticsResponse, UpdateEmployeeRequest } from "@shared/api";
import * as db from "../db";

// GET /api/v1/employees?all=true
export const getEmployees: RequestHandler = (req, res) => {
  const all = String(req.query.all ?? "").toLowerCase() === "true";
  res.json(db.getEmployees(all));
};

// POST /api/v1/employees
export const createEmployee: RequestHandler = (req, res) => {
  const body = (req.body ?? {}) as Partial<CreateEmployeeRequest>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return res.status(400).json({ error: "Validation error", message: "Missing required field: name" });
  }

  const employee = db.createEmployee({
    name,
    phone: typeof body.phone === "string" ? body.phone.trim() : body.phone === null ? null : null,
    role: typeof body.role === "string" ? body.role.trim() : body.role === null ? null : null,
    is_active: body.is_active === undefined ? true : !!body.is_active,
  });
  res.status(201).json(employee);
};

// PUT /api/v1/employees/:id
export const updateEmployee: RequestHandler<{ id: string }> = (req, res) => {
  const id = req.params.id;
  const existing = db.getEmployee(id);
  if (!existing) return res.status(404).json({ error: "Not found", message: "Employee not found" });

  const body = (req.body ?? {}) as Partial<UpdateEmployeeRequest>;
  const updated = db.updateEmployee(id, {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    phone: body.phone === undefined ? undefined : body.phone === null ? null : String(body.phone).trim(),
    role: body.role === undefined ? undefined : body.role === null ? null : String(body.role).trim(),
    is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
  });
  res.json(updated);
};

// DELETE /api/v1/employees/:id
export const deleteEmployee: RequestHandler<{ id: string }> = (req, res) => {
  const ok = db.deleteEmployee(req.params.id);
  if (!ok) return res.status(404).json({ error: "Not found", message: "Employee not found" });
  res.json({ ok: true });
};

function safeParseDateMs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// GET /api/v1/employees/analytics?from=ISO&to=ISO
export const getEmployeesAnalytics: RequestHandler = (req, res) => {
  const now = Date.now();
  const toMs = safeParseDateMs(typeof req.query.to === "string" ? req.query.to : undefined) ?? now;
  const fromMs =
    safeParseDateMs(typeof req.query.from === "string" ? req.query.from : undefined) ?? toMs - 30 * 24 * 60 * 60 * 1000;

  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();

  const employees = db.getEmployees(true);
  const shifts = db.getShifts({ from: fromIso, to: toIso });
  const completedBookings = db
    .getBookings()
    .filter((b) => b.status === "completed" && b.employee_id)
    .filter((b) => {
      const ms = new Date(b.date_time).getTime();
      return ms >= fromMs && ms <= toMs;
    });

  const shiftsByEmp = new Map<string, number>();
  for (const s of shifts) shiftsByEmp.set(s.employee_id, (shiftsByEmp.get(s.employee_id) ?? 0) + 1);

  const worksByEmp = new Map<string, number>();
  for (const b of completedBookings) {
    const id = String(b.employee_id);
    worksByEmp.set(id, (worksByEmp.get(id) ?? 0) + 1);
  }

  const out: EmployeesAnalyticsResponse = {
    from: fromIso,
    to: toIso,
    rows: employees.map((e) => ({
      employee_id: e._id,
      employee_name: e.name,
      shifts: shiftsByEmp.get(e._id) ?? 0,
      works: worksByEmp.get(e._id) ?? 0,
    })),
  };

  res.json(out);
};

