import { useEffect, useState } from "react";
import { Service, CreateServiceRequest } from "@shared/api";

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
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      const data = await res.json();
      setServices(data);
      setError(null);
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка загрузки услуг");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: CreateServiceRequest = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
      category: formData.category,
      is_active: true,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/v1/services/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
      setFormData({ name: "", description: "", price: "", duration: "", category: "" });
    } catch (err) {
      console.error("Error:", err);
      setError("Ошибка сохранения");
    }
  };

  const handleEdit = (service: Service) => {
    setEditingId(service._id);
    setFormData({
      name: service.name,
      description: service.description,
      price: service.price.toString(),
      duration: service.duration.toString(),
      category: service.category,
    });
    setShowForm(true);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Услуги</h1>
            <p className="text-xs text-muted-foreground">Управление и цены</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({ name: "", description: "", price: "", duration: "", category: "" });
            }}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            {showForm ? "✕" : "+ Добавить"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-slide-in">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 shadow-sm border border-border space-y-3 animate-slide-in">
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
                className="bg-white rounded-lg p-3 shadow-sm border border-border hover:shadow-lg hover:border-primary transition-all duration-300 animate-slide-in"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-lg flex-shrink-0">
                    💼
                  </div>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    Активна
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{service.name}</h3>
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{service.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 py-2 border-t border-b border-border">
                  <span>{service.category}</span>
                  <span>{service.duration} мин</span>
                </div>
                <div className="text-2xl font-bold text-primary mb-2">{service.price.toFixed(0)} ₽</div>
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
