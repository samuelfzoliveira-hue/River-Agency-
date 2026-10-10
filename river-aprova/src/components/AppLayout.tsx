import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";

export default function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { session, signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-navy/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Logo />
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-navy/60 sm:inline">{session?.user.email}</span>
            <button onClick={signOut} className="font-medium text-navy hover:text-sky">Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  );
}
