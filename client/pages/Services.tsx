import { useEffect, useState, useRef } from "react";
import { Service, CreateServiceRequest } from "@shared/api";

const PREVIEW_SIZE = 200;
const THUMB_SIZE = 80;

function resizeImage(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    duration: "",
    category: "",
    image_url: "" as string,
    image_thumbnail_url: "" as string,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchServices(false);
    };
    const onOnline = () => fetchServices(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const fetchServices = async (showLoading = true) => {
    const maxRetries = 3;
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (showLoading) setLoading(true);
        const res = await fetch("/api/v1/services?all=true");
        if (!res.ok) throw new Error("Failed to fetch services");
        const data = await res.json();
        setServices(data);
        setError(null);
        return;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error("Ошибка загрузки");
        console.error("Fetch services attempt", attempt + 1, lastErr);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    }
    setError(lastErr?.message ?? "Ошибка загрузки услуг");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateServiceRequest = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
      category: formData.category,
      image_url: formData.image_url || null,
      image_thumbnail_url: formData.image_thumbnail_url || null,
      is_active: true,
    };

    try {
      if (editingId) {
        const updatePayload = {
          ...payload,
          image_url: payload.image_url ?? undefined,
          image_thumbnail_url: payload.image_thumbnail_url ?? undefined,
        };
        const res = await fetch(`/api/v1/services/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });
        if (!res.ok) throw new Error("Failed to update service");
      } else {
        const res = await fetch("/api/v1/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create service");
      }
      await fetchServices();
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", description: "", price: "", duration: "", category: "", image_url: "", image_thumbnail_url: "" });
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка сохранения");
    }
  };

  const handleEdit = async (service: Service) => {
    setEditingId(service._id);
    let imageUrl = service.image_url || "";
    if (!imageUrl && service._id) {
      try {
        const res = await fetch(`/api/v1/services/${service._id}`);
        if (res.ok) {
          const full = await res.json();
          imageUrl = full.image_url || "";
        }
      } catch {}
    }
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      duration: service.duration.toString(),
      category: service.category,
      image_url: imageUrl,
      image_thumbnail_url: service.image_thumbnail_url || "",
    });
    setShowForm(true);
  };

  const handleDuplicate = (service: Service) => {
    setFormData({
      name: `${service.name} (копия)`,
      description: service.description,
      price: String(service.price),
      duration: String(service.duration),
      category: service.category,
      image_url: service.image_url ?? "",
      image_thumbnail_url: service.image_thumbnail_url ?? "",
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const [preview, thumb] = await Promise.all([
        resizeImage(file, PREVIEW_SIZE, 0.7),
        resizeImage(file, THUMB_SIZE, 0.5),
      ]);
      setFormData((f) => ({ ...f, image_url: preview, image_thumbnail_url: thumb }));
    } catch (err) {
      console.error("Image error:", err);
      setError("Ошибка загрузки изображения");
    }
    e.target.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить?")) return;
    try {
      const res = await fetch(`/api/v1/services/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      await fetchServices();
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка удаления");
    }
  };

  const handleToggleActive = async (service: Service) => {
    try {
      const res = await fetch(`/api/v1/services/${service._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...service, is_active: !service.is_active }),
      });
      if (!res.ok) throw new Error("Failed to toggle");
      await fetchServices();
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка переключения");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Услуги</h1>
            <p className="text-xs text-muted-foreground">Управление и цены</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
                setFormData({ name: "", description: "", price: "", duration: "", category: "", image_url: "", image_thumbnail_url: "" });
              }}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              {showForm ? "✕" : "+ Добавить"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-6 space-y-4">
        {error && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => fetchServices()}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg font-semibold shrink-0"
            >
              Повторить
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 shadow-sm border border-border space-y-3 animate-slide-in">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-shrink-0">
                <label className="block text-xs font-semibold text-foreground mb-1">Фото услуги</label>
                <div className="flex gap-3 items-start">
                  <div className="w-24 h-24 rounded-lg border border-border bg-muted overflow-hidden flex items-center justify-center">
                    {(formData.image_url || formData.image_thumbnail_url) ? (
                      <img src={formData.image_url || formData.image_thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl text-muted-foreground">📷</span>
                    )}
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      id="service-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      aria-label="Загрузить фото услуги"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      {(formData.image_url || formData.image_thumbnail_url) ? "Заменить" : "Загрузить"}
                    </button>
                    {(formData.image_url || formData.image_thumbnail_url) && (
                      <button
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, image_url: "", image_thumbnail_url: "" }))}
                        className="block mt-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Название"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                placeholder="Категория"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                placeholder="Цена"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="number"
                placeholder="Длительность (мин)"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                required
                className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <textarea
              placeholder="Описание"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
            />
            <button
              type="submit"
              className="w-full px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              {editingId ? "Сохранить" : "Добавить"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm animate-pulse">
            Загрузка...
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Услуг не найдено
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {services.map((service, idx) => (
              <div
                key={service._id}
                className={`rounded-lg p-3 shadow-sm border transition-all duration-300 animate-slide-in ${
                  service.is_active 
                    ? "bg-white border-border hover:shadow-lg hover:border-primary" 
                    : "bg-gray-100 border-gray-300 opacity-75"
                }`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 ${
                    service.is_active ? "bg-blue-100" : "bg-gray-200"
                  }`}>
                    {(service.image_thumbnail_url || service.image_url) ? (
                      <img src={service.image_thumbnail_url || service.image_url!} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-xl">💼</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleActive(service)}
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full transition-colors ${
                      service.is_active 
                        ? "bg-green-100 text-green-700 hover:bg-green-200" 
                        : "bg-gray-300 text-gray-600 hover:bg-gray-400"
                    }`}
                  >
                    {service.is_active ? "✓ Активна" : "○ Неактивна"}
                  </button>
                </div>
                <h3 className={`font-semibold text-sm mb-1 ${service.is_active ? "text-foreground" : "text-gray-500"}`}>
                  {service.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{service.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 py-2 border-t border-b border-border">
                  <span>{service.category}</span>
                  <span>{service.duration} мин</span>
                </div>
                <div className={`text-2xl font-bold mb-2 ${service.is_active ? "text-primary" : "text-gray-400"}`}>
                  {service.price.toFixed(0)} ₽
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(service)}
                    className="flex-1 px-2 py-1 text-xs rounded-lg border border-border text-foreground hover:bg-gray-50 transition-colors font-medium"
                  >
                    ✎ Редакт
                  </button>
                  <button
                    onClick={() => handleDelete(service._id)}
                    className="flex-1 px-2 py-1 text-xs rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-medium"
                  >
                    ✕ Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
