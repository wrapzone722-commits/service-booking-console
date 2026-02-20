import { useEffect, useMemo, useState } from "react";
import type { CreateEmployeeRequest, CreateShiftRequest, Employee, EmployeesAnalyticsResponse, Shift, UpdateEmployeeRequest, UpdateShiftRequest } from "@shared/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type SubTab = "employees" | "schedule" | "analytics";

function toDateInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function toDateTimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function dateRangeToIso(fromDate: string, toDate: string): { fromIso: string; toIso: string } {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T23:59:59`);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

async function apiJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("session_token");
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    localStorage.removeItem("session_token");
    localStorage.removeItem("account_id");
    localStorage.removeItem("account_name");
    window.location.replace("/login");
    throw new Error("Unauthorized");
  }
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const message = (data as { message?: string })?.message || "Ошибка запроса";
    throw new Error(message);
  }
  return data as T;
}

export default function Employees() {
  const [activeTab, setActiveTab] = useState<SubTab>("employees");
  const [error, setError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [scheduleFrom, setScheduleFrom] = useState(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return toDateInput(d);
  });
  const [scheduleTo, setScheduleTo] = useState(() => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 7);
    return toDateInput(d);
  });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  const [analyticsFrom, setAnalyticsFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInput(d);
  });
  const [analyticsTo, setAnalyticsTo] = useState(() => toDateInput(today));
  const [analytics, setAnalytics] = useState<EmployeesAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<CreateEmployeeRequest & { is_active: boolean }>({
    name: "",
    phone: "",
    role: "",
    is_active: true,
  });
  const [employeeSaving, setEmployeeSaving] = useState(false);

  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState<{ employee_id: string; start_local: string; end_local: string; notes: string }>({
    employee_id: "",
    start_local: "",
    end_local: "",
    notes: "",
  });
  const [shiftSaving, setShiftSaving] = useState(false);

  const tabs = useMemo(
    () =>
      [
        { id: "employees" as const, label: "Сотрудники" },
        { id: "schedule" as const, label: "Графики" },
        { id: "analytics" as const, label: "Анализ" },
      ] as const,
    []
  );

  useEffect(() => {
    setError(null);
  }, [activeTab]);

  const fetchEmployees = async () => {
    setEmployeesLoading(true);
    try {
      const data = await apiJson<Employee[]>("/api/v1/employees?all=true");
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Не удалось загрузить сотрудников");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const fetchShifts = async () => {
    setShiftsLoading(true);
    try {
      const { fromIso, toIso } = dateRangeToIso(scheduleFrom, scheduleTo);
      const data = await apiJson<Shift[]>(`/api/v1/shifts?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`);
      setShifts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Не удалось загрузить смены");
    } finally {
      setShiftsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const { fromIso, toIso } = dateRangeToIso(analyticsFrom, analyticsTo);
      const data = await apiJson<EmployeesAnalyticsResponse>(
        `/api/v1/employees/analytics?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`
      );
      setAnalytics(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Не удалось загрузить анализ");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, []);

  useEffect(() => {
    if (activeTab === "schedule") void fetchShifts();
    if (activeTab === "analytics") void fetchAnalytics();
  }, [activeTab]);

  const openNewEmployee = () => {
    setEditingEmployee(null);
    setEmployeeForm({ name: "", phone: "", role: "", is_active: true });
    setEmployeeModalOpen(true);
  };

  const openEditEmployee = (e: Employee) => {
    setEditingEmployee(e);
    setEmployeeForm({
      name: e.name ?? "",
      phone: e.phone ?? "",
      role: e.role ?? "",
      is_active: e.is_active ?? true,
    });
    setEmployeeModalOpen(true);
  };

  const saveEmployee = async () => {
    const name = String(employeeForm.name ?? "").trim();
    if (!name) {
      setError("Укажите имя сотрудника");
      return;
    }
    setEmployeeSaving(true);
    try {
      if (editingEmployee) {
        const payload: UpdateEmployeeRequest = {
          name,
          phone: employeeForm.phone ? String(employeeForm.phone).trim() : null,
          role: employeeForm.role ? String(employeeForm.role).trim() : null,
          is_active: !!employeeForm.is_active,
        };
        await apiJson<Employee>(`/api/v1/employees/${editingEmployee._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const payload: CreateEmployeeRequest = {
          name,
          phone: employeeForm.phone ? String(employeeForm.phone).trim() : null,
          role: employeeForm.role ? String(employeeForm.role).trim() : null,
          is_active: !!employeeForm.is_active,
        };
        await apiJson<Employee>("/api/v1/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setEmployeeModalOpen(false);
      await fetchEmployees();
      if (activeTab === "schedule") await fetchShifts();
      if (activeTab === "analytics") await fetchAnalytics();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setEmployeeSaving(false);
    }
  };

  const removeEmployee = async (id: string) => {
    if (!confirm("Удалить сотрудника? Также удалятся его смены.")) return;
    try {
      await apiJson<{ ok: true }>(`/api/v1/employees/${id}`, { method: "DELETE" });
      await fetchEmployees();
      if (activeTab === "schedule") await fetchShifts();
      if (activeTab === "analytics") await fetchAnalytics();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Ошибка удаления");
    }
  };

  const openNewShift = () => {
    const now = new Date();
    const plus3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    setEditingShift(null);
    setShiftForm({
      employee_id: employees.find((e) => e.is_active)?._id ?? "",
      start_local: toDateTimeLocalValue(now.toISOString()),
      end_local: toDateTimeLocalValue(plus3h.toISOString()),
      notes: "",
    });
    setShiftModalOpen(true);
  };

  const openEditShift = (s: Shift) => {
    setEditingShift(s);
    setShiftForm({
      employee_id: s.employee_id,
      start_local: toDateTimeLocalValue(s.start_iso),
      end_local: toDateTimeLocalValue(s.end_iso),
      notes: s.notes ?? "",
    });
    setShiftModalOpen(true);
  };

  const saveShift = async () => {
    if (!shiftForm.employee_id) {
      setError("Выберите сотрудника");
      return;
    }
    if (!shiftForm.start_local || !shiftForm.end_local) {
      setError("Укажите время начала и окончания смены");
      return;
    }
    const startIso = new Date(shiftForm.start_local).toISOString();
    const endIso = new Date(shiftForm.end_local).toISOString();
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError("Окончание смены должно быть позже начала");
      return;
    }

    setShiftSaving(true);
    try {
      if (editingShift) {
        const payload: UpdateShiftRequest = {
          employee_id: shiftForm.employee_id,
          start_iso: startIso,
          end_iso: endIso,
          notes: shiftForm.notes.trim() ? shiftForm.notes.trim() : null,
        };
        await apiJson<Shift>(`/api/v1/shifts/${editingShift._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const payload: CreateShiftRequest = {
          employee_id: shiftForm.employee_id,
          start_iso: startIso,
          end_iso: endIso,
          notes: shiftForm.notes.trim() ? shiftForm.notes.trim() : null,
        };
        await apiJson<Shift>("/api/v1/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShiftModalOpen(false);
      await fetchShifts();
      if (activeTab === "analytics") await fetchAnalytics();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Ошибка сохранения смены");
    } finally {
      setShiftSaving(false);
    }
  };

  const removeShift = async (id: string) => {
    if (!confirm("Удалить смену?")) return;
    try {
      await apiJson<{ ok: true }>(`/api/v1/shifts/${id}`, { method: "DELETE" });
      await fetchShifts();
      if (activeTab === "analytics") await fetchAnalytics();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Ошибка удаления смены");
    }
  };

  const employeeById = useMemo(() => new Map(employees.map((e) => [e._id, e])), [employees]);
  const shiftsCountByEmployee = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of shifts) m.set(s.employee_id, (m.get(s.employee_id) ?? 0) + 1);
    return m;
  }, [shifts]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 ios-surface border-b border-border/70">
        <div className="px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Сотрудники</h1>
            <p className="text-xs text-muted-foreground">Добавление, графики смен, подсчёт смен и работ</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "employees" ? (
              <Button onClick={openNewEmployee}>Добавить</Button>
            ) : activeTab === "schedule" ? (
              <Button onClick={openNewShift} disabled={!employees.length}>
                Создать смену
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-4 md:px-6 pb-3 flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition whitespace-nowrap ${
                activeTab === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-3">
        {error && (
          <div className="ios-card p-3 text-sm text-rose-700 border-rose-200 bg-rose-50/80">
            {error}
          </div>
        )}

        {activeTab === "employees" ? (
          <div className="ios-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Список сотрудников</p>
                <p className="text-xs text-muted-foreground">Смены и “кол-во работ” считаются по назначенным записям.</p>
              </div>
              <Button variant="secondary" onClick={() => void fetchEmployees()} disabled={employeesLoading}>
                Обновить
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {employeesLoading ? (
                <div className="p-6 text-sm text-muted-foreground animate-pulse-soft">Загрузка…</div>
              ) : employees.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Сотрудников пока нет. Нажмите «Добавить».</div>
              ) : (
                employees.map((e) => (
                  <div key={e._id} className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{e.name}</p>
                        {!e.is_active && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">
                            неактивен
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {e.role ? e.role : "—"} {e.phone ? `• ${e.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button variant="outline" onClick={() => openEditEmployee(e)}>
                        Редактировать
                      </Button>
                      <Button variant="destructive" onClick={() => void removeEmployee(e._id)}>
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : activeTab === "schedule" ? (
          <div className="ios-card p-4">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">С</p>
                  <Input type="date" value={scheduleFrom} onChange={(e) => setScheduleFrom(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">По</p>
                  <Input type="date" value={scheduleTo} onChange={(e) => setScheduleTo(e.target.value)} />
                </div>
                <Button variant="secondary" onClick={() => void fetchShifts()} disabled={shiftsLoading}>
                  Показать
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Смен в диапазоне: <span className="font-semibold text-foreground">{shifts.length}</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {!employees.length ? (
                <div className="p-6 text-sm text-muted-foreground">Сначала добавьте сотрудников.</div>
              ) : shiftsLoading ? (
                <div className="p-6 text-sm text-muted-foreground animate-pulse-soft">Загрузка…</div>
              ) : shifts.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">Смен в выбранном диапазоне нет.</div>
              ) : (
                shifts.map((s) => {
                  const e = employeeById.get(s.employee_id);
                  const title = e ? e.name : s.employee_id;
                  const start = new Date(s.start_iso);
                  const end = new Date(s.end_iso);
                  return (
                    <div key={s._id} className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{title}</p>
                        <p className="text-xs text-muted-foreground">
                          {start.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} –{" "}
                          {end.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {s.notes ? ` • ${s.notes}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Button variant="outline" onClick={() => openEditShift(s)}>
                          Изменить
                        </Button>
                        <Button variant="destructive" onClick={() => void removeShift(s._id)}>
                          Удалить
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {employees.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Подсчёт смен по сотрудникам (в этом диапазоне):{" "}
                  {employees
                    .filter((e) => e.is_active)
                    .map((e) => `${e.name}: ${shiftsCountByEmployee.get(e._id) ?? 0}`)
                    .join(" · ")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="ios-card p-4">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">С</p>
                  <Input type="date" value={analyticsFrom} onChange={(e) => setAnalyticsFrom(e.target.value)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">По</p>
                  <Input type="date" value={analyticsTo} onChange={(e) => setAnalyticsTo(e.target.value)} />
                </div>
                <Button variant="secondary" onClick={() => void fetchAnalytics()} disabled={analyticsLoading}>
                  Рассчитать
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Работы считаются по <span className="font-semibold text-foreground">завершённым</span> записям, где выбран сотрудник.
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4">Сотрудник</th>
                    <th className="py-2 pr-4">Смен</th>
                    <th className="py-2 pr-4">Работ</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsLoading ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-muted-foreground animate-pulse-soft">
                        Загрузка…
                      </td>
                    </tr>
                  ) : analytics?.rows?.length ? (
                    analytics.rows.map((r) => (
                      <tr key={r.employee_id} className="border-t border-border/70">
                        <td className="py-3 pr-4 font-medium">{r.employee_name}</td>
                        <td className="py-3 pr-4">{r.shifts}</td>
                        <td className="py-3 pr-4">{r.works}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-6 text-muted-foreground">
                        Нет данных для выбранного периода.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Редактировать сотрудника" : "Добавить сотрудника"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Имя</p>
              <Input value={employeeForm.name} onChange={(e) => setEmployeeForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Телефон (необязательно)</p>
                <Input value={employeeForm.phone ?? ""} onChange={(e) => setEmployeeForm((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Роль (необязательно)</p>
                <Input value={employeeForm.role ?? ""} onChange={(e) => setEmployeeForm((s) => ({ ...s, role: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!employeeForm.is_active}
                onChange={(e) => setEmployeeForm((s) => ({ ...s, is_active: e.target.checked }))}
              />
              Активен
            </label>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setEmployeeModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void saveEmployee()} disabled={employeeSaving}>
              {employeeSaving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftModalOpen} onOpenChange={setShiftModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? "Изменить смену" : "Создать смену"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Сотрудник</p>
              <select
                aria-label="Сотрудник"
                value={shiftForm.employee_id}
                onChange={(e) => setShiftForm((s) => ({ ...s, employee_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm"
              >
                <option value="">— выберите —</option>
                {employees
                  .filter((e) => e.is_active)
                  .map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Начало</p>
                <Input
                  type="datetime-local"
                  value={shiftForm.start_local}
                  onChange={(e) => setShiftForm((s) => ({ ...s, start_local: e.target.value }))}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Окончание</p>
                <Input
                  type="datetime-local"
                  value={shiftForm.end_local}
                  onChange={(e) => setShiftForm((s) => ({ ...s, end_local: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Заметка (необязательно)</p>
              <Textarea value={shiftForm.notes} onChange={(e) => setShiftForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShiftModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => void saveShift()} disabled={shiftSaving}>
              {shiftSaving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

