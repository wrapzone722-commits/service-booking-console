import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Booking } from "@shared/api";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Форматирует длительность в минутах и секундах как MM:SS */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Секунды с момента in_progress_started_at до now */
function getElapsedSeconds(booking: Booking, now: Date): number {
  const started = booking.in_progress_started_at
    ? new Date(booking.in_progress_started_at).getTime()
    : new Date(booking.date_time).getTime();
  return Math.max(0, Math.floor((now.getTime() - started) / 1000));
}

/** Доля выполнения (0–1) по длительности услуги; > 1 считаем 1 */
function getProgress(booking: Booking, now: Date): number {
  const elapsedSec = getElapsedSeconds(booking, now);
  const durationSec = (booking.duration ?? 60) * 60;
  if (durationSec <= 0) return 0;
  return Math.min(1, elapsedSec / durationSec);
}

interface WorkExecutionWidgetProps {
  /** Записи со статусом in_progress */
  inProgressBookings: Booking[];
  className?: string;
}

/**
 * Виджет «Выполнение работы»: список записей «В процессе» с живым таймером
 * и прогресс-баром по длительности услуги.
 */
export function WorkExecutionWidget({ inProgressBookings, className }: WorkExecutionWidgetProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (inProgressBookings.length === 0) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [inProgressBookings.length]);

  if (inProgressBookings.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border bg-card p-4",
          className
        )}
      >
        <h3 className="text-sm font-semibold text-foreground mb-2">Выполнение работы</h3>
        <p className="text-sm text-muted-foreground">Сейчас нет работ в процессе</p>
        <Link
          to="/bookings"
          className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
        >
          Перейти к записям →
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/30 dark:to-background dark:border-violet-800",
        className
      )}
    >
      <div className="px-4 py-3 border-b border-violet-200/60 dark:border-violet-800/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-100">
          В работе сейчас ({inProgressBookings.length})
        </h3>
        <Link
          to="/bookings"
          className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline"
        >
          Все записи →
        </Link>
      </div>
      <div className="p-4 space-y-4">
        {inProgressBookings.map((booking) => {
          const elapsedSec = getElapsedSeconds(booking, now);
          const progress = getProgress(booking, now);
          const isOverdue = progress >= 1;

          return (
            <div
              key={booking._id}
              className="rounded-lg border border-violet-200/80 dark:border-violet-800/80 bg-white/80 dark:bg-background/80 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{booking.service_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{booking.user_name}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 tabular-nums">
                  <span
                    className={cn(
                      "text-lg font-bold",
                      isOverdue ? "text-amber-600 dark:text-amber-400" : "text-violet-600 dark:text-violet-400"
                    )}
                  >
                    {formatElapsed(elapsedSec)}
                  </span>
                  <span className="text-xs text-muted-foreground">/ {booking.duration} мин</span>
                </div>
              </div>
              <Progress value={progress * 100} className="h-2 mb-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                    {isOverdue
                      ? "Время истекло"
                      : "Осталось ~" +
                        (() => {
                          const rem = Math.max(0, (booking.duration ?? 0) * 60 - elapsedSec);
                          return rem >= 60 ? Math.ceil(rem / 60) + " мин" : rem + " с";
                        })()}
                  </span>
                <Link
                  to="/bookings"
                  className="font-medium text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Открыть запись →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
