import { Link, Outlet, useLocation } from "react-router-dom";
import { LegalBanner } from "@/components/LegalBanner";

const nav = [
  { to: "/", label: "Услуги", icon: "🏠" },
  { to: "/bookings", label: "Записи", icon: "📅" },
  { to: "/profile", label: "Профиль", icon: "👤" },
];

export function Layout() {
  const location = useLocation();

  const hideNav = location.pathname.startsWith("/connect");

  return (
    <div className="min-h-screen flex flex-col">
      <main className={hideNav ? "flex-1" : "flex-1 pb-24"}>
        <Outlet />
      </main>
      {!hideNav && <LegalBanner />}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-20">
          <div className="mx-auto max-w-md px-4 pb-3 safe-area-pb">
            <div className="flex justify-around gap-2 rounded-2xl border border-border bg-card/70 backdrop-blur-xl shadow-ios p-2">
              {nav.map(({ to, label, icon }) => {
                const active =
                  to === "/"
                    ? location.pathname === "/" || location.pathname.startsWith("/services")
                    : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={[
                      "flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-xs transition",
                      active ? "bg-muted text-fg" : "text-muted-fg hover:text-fg",
                    ].join(" ")}
                  >
                    <span className={active ? "text-base" : "text-base opacity-80"}>{icon}</span>
                    <span className={active ? "font-medium" : ""}>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}
