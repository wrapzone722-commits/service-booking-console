import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Services from "./pages/Services";
import Bookings from "./pages/Bookings";
import Clients from "./pages/Clients";
import Posts from "./pages/Posts";
import Assistant from "./pages/Assistant";
import Settings from "./pages/Settings";
import Cars from "./pages/Cars";
import Login from "./pages/Login";
import YandexCallback from "./pages/YandexCallback";
import Organization from "./pages/Organization";
import TelegramBot from "./pages/TelegramBot";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("session_token");
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

const AppContent = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/yandex/callback" element={<YandexCallback />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/organization" element={<Organization />} />
                    <Route path="/services" element={<Services />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/posts" element={<Posts />} />
                    <Route path="/assistant" element={<Assistant />} />
                    <Route path="/telegram-bot" element={<TelegramBot />} />
                    <Route path="/cars" element={<Cars />} />
                    <Route path="/settings" element={<Settings />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<AppContent />);
