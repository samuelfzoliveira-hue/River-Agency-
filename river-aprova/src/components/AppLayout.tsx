import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { homeFor, useAuth } from "../auth/AuthContext";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";

export default function AppLayout({ title, children, wide = false }: { title?: string; children: ReactNode; wide?: boolean }) {
  const { session, role, signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to={homeFor(role)}><Logo /></Link>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            {role === "admin" && <NotificationBell />}
            <span className="hidden text-navy/60 md:inline">{session?.user.email}</span>
            <button onClick={signOut} className="font-medium text-navy hover:text-sky">Sair</button>
          </div>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 sm:py-10 ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        {title && <h1 className="mb-5 text-2xl font-semibold sm:text-3xl">{title}</h1>}
        {children}
      </main>
    </div>
  );
}
