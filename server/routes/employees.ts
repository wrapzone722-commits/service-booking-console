import { RequestHandler } from "express";
import type {
  CreateEmployeeRequest,
  EmployeeAnalyticsRow,
  EmployeesAnalyticsResponse,
  EmployeesImportPayload,
  EmployeesTimesheetExport,
  Shift,
  UpdateEmployeeRequest,
} from "@shared/api";
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

  const pay_rate_hour =
    body.pay_rate_hour === undefined ? null : body.pay_rate_hour === null ? null : Number(body.pay_rate_hour);
  const pay_rate_work =
    body.pay_rate_work === undefined ? null : body.pay_rate_work === null ? null : Number(body.pay_rate_work);

  const employee = db.createEmployee({
    name,
    phone: typeof body.phone === "string" ? body.phone.trim() : body.phone === null ? null : null,
    role: typeof body.role === "string" ? body.role.trim() : body.role === null ? null : null,
    pay_rate_hour: Number.isFinite(pay_rate_hour as number) ? Math.max(0, pay_rate_hour as number) : null,
    pay_rate_work: Number.isFinite(pay_rate_work as number) ? Math.max(0, pay_rate_work as number) : null,
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
    pay_rate_hour: body.pay_rate_hour === undefined ? undefined : body.pay_rate_hour === null ? null : Number(body.pay_rate_hour),
    pay_rate_work: body.pay_rate_work === undefined ? undefined : body.pay_rate_work === null ? null : Number(body.pay_rate_work),
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

function overlapHours(shift: Shift, fromMs: number, toMs: number): number {
  const start = new Date(shift.start_iso).getTime();
  const end = new Date(shift.end_iso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const a = Math.max(start, fromMs);
  const b = Math.min(end, toMs);
  if (b <= a) return 0;
  return (b - a) / (1000 * 60 * 60);
}

function money(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAnalytics(fromMs: number, toMs: number): EmployeesAnalyticsResponse {
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

  const shiftsCountByEmp = new Map<string, number>();
  const hoursByEmp = new Map<string, number>();
  for (const s of shifts) {
    shiftsCountByEmp.set(s.employee_id, (shiftsCountByEmp.get(s.employee_id) ?? 0) + 1);
    hoursByEmp.set(s.employee_id, (hoursByEmp.get(s.employee_id) ?? 0) + overlapHours(s, fromMs, toMs));
  }

  const worksByEmp = new Map<string, number>();
  for (const b of completedBookings) {
    const id = String(b.employee_id);
    worksByEmp.set(id, (worksByEmp.get(id) ?? 0) + 1);
  }

  const rows: EmployeeAnalyticsRow[] = employees.map((e) => {
    const hours = hoursByEmp.get(e._id) ?? 0;
    const works = worksByEmp.get(e._id) ?? 0;
    const rateHour = Number(e.pay_rate_hour ?? 0) || 0;
    const rateWork = Number(e.pay_rate_work ?? 0) || 0;
    const salary = money(hours * rateHour + works * rateWork);
    return {
      employee_id: e._id,
      employee_name: e.name,
      shifts: shiftsCountByEmp.get(e._id) ?? 0,
      works,
      hours: money(hours),
      salary,
    };
  });

  return { from: fromIso, to: toIso, rows };
}

// GET /api/v1/employees/analytics?from=ISO&to=ISO
export const getEmployeesAnalytics: RequestHandler = (req, res) => {
  const now = Date.now();
  const toMs = safeParseDateMs(typeof req.query.to === "string" ? req.query.to : undefined) ?? now;
  const fromMs =
    safeParseDateMs(typeof req.query.from === "string" ? req.query.from : undefined) ?? toMs - 30 * 24 * 60 * 60 * 1000;
  res.json(buildAnalytics(fromMs, toMs));
};

// GET /api/v1/employees/timesheet?from=ISO&to=ISO&format=html|json
export const getTimesheet: RequestHandler = (req, res) => {
  const now = Date.now();
  const toMs = safeParseDateMs(typeof req.query.to === "string" ? req.query.to : undefined) ?? now;
  const fromMs =
    safeParseDateMs(typeof req.query.from === "string" ? req.query.from : undefined) ?? toMs - 30 * 24 * 60 * 60 * 1000;
  const format = String(req.query.format ?? "").toLowerCase();

  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();
  const employees = db.getEmployees(true);
  const shifts = db.getShifts({ from: fromIso, to: toIso });
  const analytics = buildAnalytics(fromMs, toMs);
  const payload: EmployeesTimesheetExport = {
    from: fromIso,
    to: toIso,
    generated_at: new Date().toISOString(),
    employees,
    shifts,
    analytics,
  };

  if (format === "json") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(payload);
    return;
  }

  // HTML export (print-friendly A4)
  const dateFrom = new Date(fromMs).toLocaleDateString("ru-RU");
  const dateTo = new Date(toMs).toLocaleDateString("ru-RU");
  const totalSalary = money(analytics.rows.reduce((sum, r) => sum + (r.salary ?? 0), 0));

  const rowsHtml = analytics.rows
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name, "ru"))
    .map((r, idx) => {
      const emp = employees.find((e) => e._id === r.employee_id);
      const rateHour = Number(emp?.pay_rate_hour ?? 0) || 0;
      const rateWork = Number(emp?.pay_rate_work ?? 0) || 0;
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.employee_name)}</td>
        <td class="num">${escapeHtml(String(r.shifts))}</td>
        <td class="num">${escapeHtml(String(r.hours.toFixed(2)))}</td>
        <td class="num">${escapeHtml(String(r.works))}</td>
        <td class="num">${escapeHtml(rateHour ? rateHour.toFixed(2) : "0.00")}</td>
        <td class="num">${escapeHtml(rateWork ? rateWork.toFixed(2) : "0.00")}</td>
        <td class="num strong">${escapeHtml(String((r.salary ?? 0).toFixed(2)))}</td>
      </tr>`;
    })
    .join("");

  const shiftsByEmp = new Map<string, Shift[]>();
  for (const s of shifts) {
    const arr = shiftsByEmp.get(s.employee_id) ?? [];
    arr.push(s);
    shiftsByEmp.set(s.employee_id, arr);
  }

  const shiftsHtml = analytics.rows
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name, "ru"))
    .map((r) => {
      const list = (shiftsByEmp.get(r.employee_id) ?? [])
        .sort((a, b) => new Date(a.start_iso).getTime() - new Date(b.start_iso).getTime())
        .map((s) => {
          const start = new Date(s.start_iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          const end = new Date(s.end_iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
          const note = s.notes ? ` — ${escapeHtml(String(s.notes))}` : "";
          return `<div class="shift">${escapeHtml(start)} – ${escapeHtml(end)}${note}</div>`;
        })
        .join("") || `<div class="muted">Смен нет</div>`;
      return `<div class="block">
        <div class="h2">${escapeHtml(r.employee_name)}</div>
        ${list}
      </div>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Табель сотрудников ${escapeHtml(dateFrom)}–${escapeHtml(dateTo)}</title>
  <style>
    :root { --fg:#0b1220; --muted:#6b7280; --border:#e5e7eb; --bg:#ffffff; --card:#f8fafc; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:var(--fg); background:#f3f4f6; }
    .page { max-width: 980px; margin: 24px auto; padding: 0 16px; }
    .toolbar { display:flex; gap:12px; justify-content:flex-end; margin-bottom: 12px; }
    .btn { border:1px solid var(--border); background:var(--bg); padding:10px 12px; border-radius:12px; font-weight:600; cursor:pointer; }
    .btn:hover { background:#f9fafb; }
    .doc { background:var(--bg); border:1px solid var(--border); border-radius:18px; padding:18px; box-shadow: 0 10px 30px rgba(0,0,0,.06); }
    h1 { margin:0; font-size: 20px; }
    .sub { margin-top:6px; color:var(--muted); font-size: 12px; }
    .kpi { margin-top: 10px; display:flex; gap:10px; flex-wrap:wrap; }
    .chip { border:1px solid var(--border); background:var(--card); padding:8px 10px; border-radius:999px; font-size: 12px; }
    table { width:100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border-bottom:1px solid var(--border); padding:10px 8px; font-size: 13px; vertical-align: top; }
    th { text-align:left; color: var(--muted); font-size: 12px; font-weight:700; }
    td.num, th.num { text-align: right; }
    .strong { font-weight:800; }
    .muted { color: var(--muted); }
    .hr { height:1px; background: var(--border); margin: 14px 0; }
    .blocks { display:grid; grid-template-columns: 1fr; gap: 12px; margin-top: 14px; }
    .block { border:1px solid var(--border); background:var(--card); border-radius: 16px; padding: 12px; }
    .h2 { font-weight:800; margin-bottom: 8px; }
    .shift { font-size: 12px; padding: 6px 8px; border:1px dashed rgba(107,114,128,.35); border-radius: 12px; background: rgba(255,255,255,.7); margin-bottom: 6px; }
    @media print {
      body { background: #fff; }
      .page { max-width: none; margin: 0; padding: 0; }
      .toolbar { display:none; }
      .doc { border: none; box-shadow: none; border-radius: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="toolbar">
      <button class="btn" onclick="window.print()">Печать</button>
      <button class="btn" onclick="download()">Скачать HTML</button>
    </div>
    <div class="doc">
      <h1>Табель сотрудников</h1>
      <div class="sub">Период: ${escapeHtml(dateFrom)} – ${escapeHtml(dateTo)} · сформировано: ${escapeHtml(new Date(payload.generated_at).toLocaleString("ru-RU"))}</div>
      <div class="kpi">
        <div class="chip">Сотрудников: <b>${escapeHtml(String(employees.length))}</b></div>
        <div class="chip">Итого начислено: <b>${escapeHtml(totalSalary.toFixed(2))} ₽</b></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:42px">№</th>
            <th>Сотрудник</th>
            <th class="num">Смен</th>
            <th class="num">Часы</th>
            <th class="num">Работ</th>
            <th class="num">₽/час</th>
            <th class="num">₽/работа</th>
            <th class="num">Начислено, ₽</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="8" class="muted">Нет данных</td></tr>`}
        </tbody>
      </table>

      <div class="hr"></div>
      <div class="muted" style="font-size:12px">Список смен по сотрудникам (для контроля):</div>
      <div class="blocks">${shiftsHtml}</div>
    </div>
  </div>

  <script>
    function download() {
      const html = document.documentElement.outerHTML;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "timesheet-${escapeHtml(dateFrom)}-${escapeHtml(dateTo)}.html";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};

// POST /api/v1/employees/import — импорт сотрудников и смен из JSON
export const importEmployeesData: RequestHandler = (req, res) => {
  const body = (req.body ?? {}) as EmployeesImportPayload;
  const employees = Array.isArray(body.employees) ? body.employees : [];
  const shifts = Array.isArray(body.shifts) ? body.shifts : [];

  // Минимальная валидация (не падаем на лишних полях)
  const cleanEmployees = employees
    .filter((e) => e && typeof e._id === "string" && typeof e.name === "string" && e.name.trim())
    .map((e) => ({
      ...e,
      name: String(e.name).trim(),
      phone: e.phone === undefined ? null : e.phone === null ? null : String(e.phone),
      role: e.role === undefined ? null : e.role === null ? null : String(e.role),
      pay_rate_hour: e.pay_rate_hour === undefined ? null : e.pay_rate_hour === null ? null : Number(e.pay_rate_hour),
      pay_rate_work: e.pay_rate_work === undefined ? null : e.pay_rate_work === null ? null : Number(e.pay_rate_work),
      is_active: e.is_active ?? true,
      created_at: typeof e.created_at === "string" ? e.created_at : new Date().toISOString(),
    }));

  const cleanShifts = shifts
    .filter((s) => s && typeof s._id === "string" && typeof s.employee_id === "string" && typeof s.start_iso === "string" && typeof s.end_iso === "string")
    .map((s) => ({
      ...s,
      notes: s.notes === undefined ? null : s.notes === null ? null : String(s.notes),
      created_at: typeof s.created_at === "string" ? s.created_at : new Date().toISOString(),
    }));

  db.replaceEmployees(cleanEmployees);
  db.replaceShifts(cleanShifts);

  res.json({ ok: true, employees: cleanEmployees.length, shifts: cleanShifts.length });
};

