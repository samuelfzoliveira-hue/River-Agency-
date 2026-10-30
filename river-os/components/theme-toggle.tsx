"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      type="button"
      className="btn btn-sm w-full justify-start"
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        try { localStorage.setItem("river-theme", next ? "dark" : "light"); } catch { /* modo privado */ }
        setDark(next);
      }}
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? "Modo claro" : "Modo escuro"}
    </button>
  );
}
