import { useEffect, useState } from "react";

interface AccountInfo {
  account_id: string;
  email: string;
  name: string;
  verified: boolean;
  qr_code_data?: string;
  phone?: string;
  phone_extra?: string;
  website?: string;
  address?: string;
  legal_address?: string;
  inn?: string;
  ogrn?: string;
  kpp?: string;
  bank_name?: string;
  bank_bik?: string;
  bank_account?: string;
  director_name?: string;
}

export default function Organization() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<AccountInfo>>({});

  useEffect(() => {
    document.title = "ServiceBooking — Организация";
  }, []);

  useEffect(() => {
    fetchAccountInfo();
  }, []);

  const fetchAccountInfo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("session_token");
      const res = await fetch("/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setAccountInfo(data);
      setForm({
        name: data.name,
        email: data.email,
        phone: data.phone ?? "",
        phone_extra: data.phone_extra ?? "",
        website: data.website ?? "",
        address: data.address ?? "",
        legal_address: data.legal_address ?? "",
        inn: data.inn ?? "",
        ogrn: data.ogrn ?? "",
        kpp: data.kpp ?? "",
        bank_name: data.bank_name ?? "",
        bank_bik: data.bank_bik ?? "",
        bank_account: data.bank_account ?? "",
        director_name: data.director_name ?? "",
      });
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const token = localStorage.getItem("session_token");
      const res = await fetch("/api/v1/auth/organization", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || "Ошибка сохранения");
      }
      const data = await res.json();
      setAccountInfo(data);
      setSuccess("Данные сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const getQRUrl = () => {
    if (!accountInfo?.qr_code_data) return "";
    try {
      const data = JSON.parse(accountInfo.qr_code_data);
      return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(data))}`;
    } catch {
      return "";
    }
  };

  const Input = ({ label, name, value = "", placeholder = "", type = "text" }: { label: string; name: keyof AccountInfo; value?: string; placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </div>
  );

  if (loading || !accountInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="px-6 py-3">
          <h1 className="text-2xl font-bold text-foreground">Организация</h1>
          <p className="text-xs text-muted-foreground">Адрес, телефоны, юридические данные — для документов</p>
        </div>
      </div>

      <div className="p-6 max-w-4xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Основная информация */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Основная информация</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Название организации" name="name" value={form.name} placeholder="ООО «Компания»" />
              <Input label="Email администратора" name="email" value={form.email} type="email" placeholder="admin@example.com" />
              <Input label="Телефон основной" name="phone" value={form.phone} placeholder="+7 900 123-45-67" />
              <Input label="Телефон дополнительный" name="phone_extra" value={form.phone_extra} placeholder="+7 800 123-45-67" />
              <Input label="Сайт" name="website" value={form.website} placeholder="https://example.com" />
            </div>
          </div>

          {/* Адреса */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Адреса</h2>
            <div className="grid grid-cols-1 gap-4">
              <Input label="Адрес фактический" name="address" value={form.address} placeholder="г. Москва, ул. Примерная, д. 1" />
              <Input label="Юридический адрес" name="legal_address" value={form.legal_address} placeholder="г. Москва, ул. Юридическая, д. 1" />
            </div>
          </div>

          {/* Юридические данные */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Юридические данные</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="ИНН" name="inn" value={form.inn} placeholder="7707083893" />
              <Input label="ОГРН/ОГРНИП" name="ogrn" value={form.ogrn} placeholder="1027700132195" />
              <Input label="КПП" name="kpp" value={form.kpp} placeholder="770701001" />
              <div className="md:col-span-3">
                <Input label="Директор / Руководитель" name="director_name" value={form.director_name} placeholder="Иванов Иван Иванович" />
              </div>
            </div>
          </div>

          {/* Банковские реквизиты */}
          <div className="bg-white rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Банковские реквизиты</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Название банка" name="bank_name" value={form.bank_name} placeholder="ПАО «Сбербанк»" />
              <Input label="БИК" name="bank_bik" value={form.bank_bik} placeholder="044525225" />
              <div className="md:col-span-2">
                <Input label="Расчётный счёт" name="bank_account" value={form.bank_account} placeholder="40702810000000000000" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </form>

        {/* QR-код и API */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">QR-код для подключения</h2>
            {getQRUrl() ? (
              <div className="flex flex-col items-center">
                <img src={getQRUrl()} alt="QR Code" className="w-40 h-40" />
                <button
                  type="button"
                  onClick={() => window.open(getQRUrl(), "_blank")}
                  className="mt-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg"
                >
                  Увеличить
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">QR-код генерируется после входа</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">API URL</h2>
            {accountInfo.qr_code_data ? (
              <div className="flex gap-2">
                <code className="flex-1 text-sm bg-gray-100 px-3 py-2 rounded font-mono break-all">
                  {(() => {
                    try {
                      const d = JSON.parse(accountInfo.qr_code_data);
                      return d.api_url || "—";
                    } catch {
                      return "—";
                    }
                  })()}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const d = JSON.parse(accountInfo.qr_code_data!);
                      navigator.clipboard.writeText(d.api_url || "");
                      setSuccess("Скопировано");
                      setTimeout(() => setSuccess(null), 2000);
                    } catch {}
                  }}
                  className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded whitespace-nowrap"
                >
                  Копировать
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
