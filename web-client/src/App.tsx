import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { BackendProvider, useBackend } from "@/context/BackendContext";
import { LegalProvider } from "@/context/LegalContext";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/HomePage";
import { ServiceDetailPage } from "@/pages/ServiceDetailPage";
import { BookingCreatePage } from "@/pages/BookingCreatePage";
import { BookingsPage } from "@/pages/BookingsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ConnectPage } from "@/pages/ConnectPage";
import { LegalPage } from "@/pages/LegalPage";
import { AgreementPage } from "@/pages/AgreementPage";

function GuardedRoutes() {
  const { apiBaseUrl } = useBackend();
  if (!apiBaseUrl) {
    return (
      <Routes>
        <Route path="/connect" element={<ConnectPage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/agreement" element={<AgreementPage />} />
        <Route path="*" element={<Navigate to="/connect" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="connect" element={<ConnectPage />} />
        <Route path="legal" element={<LegalPage />} />
        <Route path="agreement" element={<AgreementPage />} />
        <Route path="services/:id" element={<ServiceDetailPage />} />
        <Route path="services/:id/book" element={<BookingCreatePage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <LegalProvider>
      <BackendProvider>
        <AuthProvider>
          <BrowserRouter>
            <GuardedRoutes />
          </BrowserRouter>
        </AuthProvider>
      </BackendProvider>
    </LegalProvider>
  );
}
