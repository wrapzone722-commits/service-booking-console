import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [accountName, setAccountName] = useState("Admin");

  useEffect(() => {
    const name = localStorage.getItem("account_name");
    if (name) {
      setAccountName(name);
    }
  }, []);

  const navItems = [
    { path: "/", label: "Главная", icon: "📊" },
    { path: "/organization", label: "Организация", icon: "🏢" },
    { path: "/services", label: "Услуги", icon: "💼" },
    { path: "/bookings", label: "Записи", icon: "📅" },
    { path: "/posts", label: "Посты", icon: "🚿" },
    { path: "/assistant", label: "Ассистент", icon: "🤖" },
    { path: "/clients", label: "Клиенты", icon: "👥" },
    { path: "/connections", label: "Подключения", icon: "📱" },
    { path: "/settings", label: "Настройки", icon: "⚙️" },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    if (confirm("Вы уверены, что хотите выйти?")) {
      localStorage.removeItem("session_token");
      localStorage.removeItem("account_id");
      localStorage.removeItem("account_name");
      navigate("/login");
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-56 bg-gradient-to-b from-[hsl(var(--sidebar-background))] to-[hsl(230_50%_25%)] text-sidebar-foreground shadow-lg flex flex-col">
        {/* Logo */}
        <div className="p-3 border-b border-sidebar-border/50">
          <Link to="/organization" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center text-sidebar-accent-foreground font-bold text-sm flex-shrink-0">
              SB
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm truncate">ServiceBooking</h1>
              <p className="text-xs text-white/60 truncate">{accountName}</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                isActive(item.path)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                  : "text-sidebar-foreground hover:bg-white/10"
              }`}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <span className="font-medium truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-white/10 transition-all text-xs font-medium"
          >
            <span>🚪</span>
            <span className="truncate">Выход</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  );
}
