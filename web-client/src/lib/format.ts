export function formatPrice(price: number): string {
  return `${Math.round(price)} ₽`;
}

export function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }
  return `${minutes} мин`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function toISODateTime(dateStr: string, timeStr: string): string {
  return `${dateStr}T${timeStr.padStart(5, "0").replace(/^(\d{1,2}):(\d{2})$/, "$1:$2:00")}`;
}
