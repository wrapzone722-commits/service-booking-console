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
  
  // AI Assistant state
  const [showAiForm, setShowAiForm] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/services?all=true");
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

  const handleAiCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    try {
      setAiLoading(true);
      setAiMessage(null);
      setError(null);

      const res = await fetch("/api/v1/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Создай услугу: ${aiPrompt}` }],
        }),
      });

      const data = await res.json();

      if (data.type === "error") {
        setError(data.message);
        return;
      }

      if (data.type === "create_service_result") {
        setAiMessage(`✓ ${data.message}: "${data.service.name}" (${data.service.price} ₽)`);
        await fetchServices();
        setAiPrompt("");
      } else {
        setAiMessage(data.message || "Не удалось создать услугу");
      }
    } catch (err) {
      console.error("AI Error:", err);
      setError("Ошибка подключения к ассистенту");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                setShowAiForm(!showAiForm);
                setShowForm(false);
                setAiMessage(null);
              }}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
            >
              {showAiForm ? "✕" : "🤖 Создать с ИИ"}
            </button>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setShowAiForm(false);
                setEditingId(null);
                setFormData({ name: "", description: "", price: "", duration: "", category: "" });
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
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm animate-slide-in">
            {error}
          </div>
        )}

        {/* AI Form */}
        {showAiForm && (
          <div className="bg-purple-50 rounded-lg p-4 shadow-sm border border-purple-200 space-y-3 animate-slide-in">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="font-semibold text-purple-900">Создать с ИИ</h3>
                <p className="text-xs text-purple-600">Опишите услугу — ассистент создаст её автоматически</p>
              </div>
            </div>
            <form onSubmit={handleAiCreate} className="flex gap-2">
              <input
                type="text"
                placeholder='Например: "полировка кузова" или "экспресс мойка"'
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-purple-300 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={aiLoading}
              />
              <button
                type="submit"
                disabled={aiLoading || !aiPrompt.trim()}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50"
              >
                {aiLoading ? "Создание..." : "Создать"}
              </button>
            </form>
            {aiMessage && (
              <div className="p-2 bg-white rounded-lg border border-purple-200 text-sm text-purple-800">
                {aiMessage}
              </div>
            )}
            <p className="text-xs text-purple-500">
              💡 Услуга создаётся <strong>неактивной</strong> — включите её после проверки
            </p>
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
                className={`rounded-lg p-3 shadow-sm border transition-all duration-300 animate-slide-in ${
                  service.is_active 
                    ? "bg-white border-border hover:shadow-lg hover:border-primary" 
                    : "bg-gray-100 border-gray-300 opacity-75"
                }`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                    service.is_active ? "bg-blue-100" : "bg-gray-200"
                  }`}>
                    💼
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
