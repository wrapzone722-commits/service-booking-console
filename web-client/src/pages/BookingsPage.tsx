import { useEffect, useState } from "react";
import { fetchBookings, cancelBooking, fetchBookingAct, submitRating } from "@/api/client";
import type { Booking } from "@/api/types";
import { formatDate, formatTime, formatPrice } from "@/lib/format";

type Tab = "upcoming" | "past" | "cancelled";

const statusLabel: Record<string, string> = {
  pending: "Ожидает",
  confirmed: "Подтверждена",
  in_progress: "В процессе",
  completed: "Завершена",
  cancelled: "Отменена",
};

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [actLoadingId, setActLoadingId] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [ratingBooking, setRatingBooking] = useState<Booking | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchBookings()
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date().toISOString();
  const filtered: Booking[] =
    tab === "upcoming"
      ? bookings.filter((b) => b.status !== "cancelled" && b.date_time >= now)
      : tab === "past"
        ? bookings.filter((b) => b.status !== "cancelled" && b.date_time < now)
        : bookings.filter((b) => b.status === "cancelled");

  const handleCancel = async (id: string) => {
    try {
      await cancelBooking(id);
      setCancelConfirmId(null);
      load();
    } catch {
      //
    }
  };

  const handleAct = async (booking: Booking) => {
    if (booking.status !== "completed") return;
    setActLoadingId(booking._id);
    setActError(null);
    try {
      const blob = await fetchBookingAct(booking._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `akt-${booking._id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setActError(e instanceof Error ? e.message : "Ошибка загрузки акта");
    } finally {
      setActLoadingId(null);
    }
  };

  const handleRatingSubmit = async () => {
    if (!ratingBooking) return;
    setRatingSubmitting(true);
    try {
      await submitRating(ratingBooking._id, ratingStars, ratingComment.trim() || null);
      setRatingBooking(null);
      setRatingStars(5);
      setRatingComment("");
      load();
    } finally {
      setRatingSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-3xl font-semibold text-fg tracking-tight mb-4">Мои записи</h1>
      <div className="flex rounded-2xl bg-muted p-1 mb-4 shadow-ios">
        {(["upcoming", "past", "cancelled"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-xs font-medium rounded-xl transition ${
              tab === t ? "bg-card text-fg shadow-ios2" : "text-muted-fg hover:text-fg"
            }`}
          >
            {t === "upcoming" ? "Предстоящие" : t === "past" ? "Прошедшие" : "Отменённые"}
          </button>
        ))}
      </div>
      {loading && bookings.length === 0 ? (
        <div className="text-muted-fg py-10 text-center">Загрузка записей...</div>
      ) : error && bookings.length === 0 ? (
        <div className="text-red-600 py-4">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-fg py-10 text-center">
          {tab === "upcoming" && "Нет предстоящих записей"}
          {tab === "past" && "Нет прошедших записей"}
          {tab === "cancelled" && "Нет отменённых записей"}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((b) => (
            <li key={b._id} className="bg-card/70 backdrop-blur-xl rounded-2xl border border-border shadow-ios p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-medium text-fg">{b.service_name}</h2>
                  <p className="text-sm text-muted-fg mt-0.5">
                    {formatDate(b.date_time)} · {formatTime(b.date_time)}
                  </p>
                  <span
                    className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded ${
                      b.status === "pending"
                        ? "bg-orange-100 text-orange-700"
                        : b.status === "confirmed"
                          ? "bg-blue-100 text-blue-700"
                          : b.status === "in_progress"
                            ? "bg-purple-100 text-purple-700"
                            : b.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                    }`}
                  >
                    {statusLabel[b.status] ?? b.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-accent font-semibold">{formatPrice(b.price)}</span>
                </div>
              </div>
              {b.notes && b.notes.trim() && (
                <p className="text-sm text-muted-fg mt-2">{b.notes}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {(b.status === "pending" || b.status === "confirmed") && (
                  <button
                    type="button"
                    onClick={() => setCancelConfirmId(b._id)}
                    className="text-sm text-red-600"
                  >
                    Отменить
                  </button>
                )}
                {b.status === "completed" && (
                  <>
                    {b.rating != null ? (
                      <span className="text-sm text-gray-500">Оценка: {b.rating} ★</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRatingBooking(b)}
                        className="text-sm text-amber-500 font-medium"
                      >
                        Оценить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleAct(b)}
                      disabled={actLoadingId === b._id}
                      className="text-sm text-accent font-medium disabled:opacity-50"
                    >
                      {actLoadingId === b._id ? "Загрузка..." : "Акт"}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {actError && (
        <div className="mt-4 p-3 bg-card/70 backdrop-blur-xl border border-border text-red-700 rounded-2xl text-sm shadow-ios">
          {actError}
          <button type="button" onClick={() => setActError(null)} className="ml-2 underline">
            Закрыть
          </button>
        </div>
      )}
      {cancelConfirmId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border shadow-ios p-4 max-w-sm w-full">
            <p className="text-fg font-medium">Отменить запись?</p>
            <p className="text-sm text-muted-fg mt-1">Запись будет отменена.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => handleCancel(cancelConfirmId)}
                className="flex-1 py-2 bg-destructive text-white rounded-2xl text-sm shadow-ios2"
              >
                Отменить запись
              </button>
              <button
                type="button"
                onClick={() => setCancelConfirmId(null)}
                className="flex-1 py-2 bg-muted text-fg rounded-2xl text-sm"
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      )}
      {ratingBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-10">
          <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border shadow-ios p-4 max-w-sm w-full">
            <p className="text-fg font-medium">Оценить запись</p>
            <p className="text-sm text-muted-fg mt-1">{ratingBooking.service_name}</p>
            <div className="mt-3 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRatingStars(n)}
                  className="text-2xl text-amber-400 hover:text-amber-500"
                >
                  {n <= ratingStars ? "★" : "☆"}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Комментарий (необязательно)"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              className="mt-3 w-full border border-border bg-card rounded-2xl p-3 text-sm text-fg placeholder:text-muted-fg"
              rows={2}
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleRatingSubmit}
                disabled={ratingSubmitting}
                className="flex-1 py-2 bg-accent text-accent-fg rounded-2xl text-sm shadow-ios2 disabled:opacity-50"
              >
                {ratingSubmitting ? "Отправка..." : "Отправить"}
              </button>
              <button
                type="button"
                onClick={() => setRatingBooking(null)}
                className="flex-1 py-2 bg-muted text-fg rounded-2xl text-sm"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
