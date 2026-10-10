import { Navigate, Route, Routes } from "react-router-dom";
import { PublicOnly, RequireAuth, RequireRole } from "./components/RouteGuards";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminSignup from "./pages/AdminSignup";
import Admin from "./pages/Admin";
import AdminClient from "./pages/AdminClient";
import Conteudos from "./pages/Conteudos";
import ContentPage from "./pages/ContentPage";
import ChangePassword from "./pages/ChangePassword";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/esqueci-senha" element={<ForgotPassword />} />
        <Route path="/primeiro-acesso" element={<AdminSignup />} />
      </Route>
      <Route path="/redefinir-senha" element={<ResetPassword />} />
      <Route element={<RequireAuth allowPasswordChange />}>
        <Route path="/trocar-senha" element={<ChangePassword />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/conteudo/:id" element={<ContentPage />} />
      </Route>
      <Route element={<RequireRole role="admin" />}>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/clientes/:id" element={<AdminClient />} />
      </Route>
      <Route element={<RequireRole role="cliente" />}>
        <Route path="/conteudos" element={<Conteudos />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
