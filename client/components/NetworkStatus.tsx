import { useEffect, useState } from "react";

interface NetworkStatusProps {
  className?: string;
}

export function NetworkStatus({ className = "" }: NetworkStatusProps) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
        online
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      } ${className}`}
      title={online ? "Подключено к сети" : "Нет подключения"}
      role="status"
      aria-live="polite"
    >
      <span
        className={`w-2 h-2 rounded-full ${online ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
        aria-hidden
      />
      <span className="hidden sm:inline">{online ? "Онлайн" : "Офлайн"}</span>
    </div>
  );
}
