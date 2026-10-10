import { Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireRole } from "./components/RouteGuards";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminSignup from "./pages/AdminSignup";
import Admin from "./pages/Admin";
import Conteudos from "./pages/Conteudos";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/primeiro-acesso" element={<AdminSignup />} />
      </Route>
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route element={<RequireRole role="cliente" />}>
        <Route path="/conteudos" element={<Conteudos />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
