import { Navigate, Outlet } from "react-router-dom";
import { homeFor, useAuth, type Role } from "../auth/AuthContext";

export function Splash() {
  return <div className="flex min-h-screen items-center justify-center text-sm text-navy/50">Carregando…</div>;
}

// Qualquer usuário logado. Cliente com senha provisória é levado à troca obrigatória.
export function RequireAuth({ allowPasswordChange = false }: { allowPasswordChange?: boolean }) {
  const auth = useAuth();
  if (auth.loading) return <Splash />;
  if (!auth.session || !auth.role) return <Navigate to="/login" replace />;
  if (auth.mustChangePassword && !allowPasswordChange) return <Navigate to="/trocar-senha" replace />;
  return <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const auth = useAuth();
  if (auth.loading) return <Splash />;
  if (!auth.session || !auth.role) return <Navigate to="/login" replace />;
  if (auth.role !== role) return <Navigate to={homeFor(auth.role)} replace />;
  if (auth.mustChangePassword) return <Navigate to="/trocar-senha" replace />;
  return <Outlet />;
}

// Telas públicas: quem já está logado vai direto para a própria área.
export function PublicOnly() {
  const auth = useAuth();
  if (auth.loading) return <Splash />;
  if (auth.session && auth.role) return <Navigate to={auth.mustChangePassword ? "/trocar-senha" : homeFor(auth.role)} replace />;
  return <Outlet />;
}
