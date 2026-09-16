"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "river_aprovacao_pw";

export function useAdminSession() {
  const [password, setPasswordState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setPasswordState(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      setPasswordState(null);
    } finally {
      setReady(true);
    }
  }, []);

  const login = useCallback((pw: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, pw);
    } catch {
      // localStorage indisponível (modo privado, etc.) — segue apenas em memória.
    }
    setPasswordState(pw);
  }, []);

  const logout = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignora
    }
    setPasswordState(null);
  }, []);

  return { isAdmin: !!password, password, ready, login, logout };
}
