"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { useAdminSession } from "@/lib/aprovacao/useAdminSession";
import type { ContentItem } from "@/lib/aprovacao/types";
import { StoryTray } from "@/components/aprovacao/StoryTray";
import { ReelsRow } from "@/components/aprovacao/ReelsRow";
import { PostCard } from "@/components/aprovacao/PostCard";
import { PostModal } from "@/components/aprovacao/PostModal";
import { AddContentModal } from "@/components/aprovacao/AddContentModal";
import { AdminLoginModal } from "@/components/aprovacao/AdminLoginModal";
import { EmptyState } from "@/components/aprovacao/EmptyState";
import { FeedSkeleton } from "@/components/aprovacao/FeedSkeleton";
import { Toast } from "@/components/aprovacao/Toast";

function AprovacaoApp() {
  const searchParams = useSearchParams();
  const clienteParam = searchParams.get("cliente");
  const admin = useAdminSession();

  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedCliente, setSelectedCliente] = useState("todos");
  const [showLogin, setShowLogin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [openPostId, setOpenPostId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadError("");
    try {
      const qs = clienteParam ? `?cliente=${encodeURIComponent(clienteParam)}` : "";
      const res = await fetch(`/api/aprovacao${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setItems(data.items as ContentItem[]);
    } catch {
      setLoadError("Não foi possível carregar o conteúdo agora.");
    }
  }, [clienteParam]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const knownClientes = useMemo(
    () => Array.from(new Set((items ?? []).map((i) => i.cliente))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const visibleItems = useMemo(() => {
    if (!items) return [];
    if (clienteParam) return items;
    if (selectedCliente === "todos") return items;
    return items.filter((i) => i.cliente === selectedCliente);
  }, [items, clienteParam, selectedCliente]);

  const stories = useMemo(() => visibleItems.filter((i) => i.type === "story"), [visibleItems]);
  const reels = useMemo(() => visibleItems.filter((i) => i.type === "reels"), [visibleItems]);
  const feedPosts = useMemo(
    () => visibleItems.filter((i) => i.type === "feed" || i.type === "carousel"),
    [visibleItems]
  );

  const openPost = useMemo(() => items?.find((i) => i.id === openPostId) ?? null, [items, openPostId]);

  async function updateItem(id: string, patch: Partial<Pick<ContentItem, "status" | "clientNote">>) {
    const prevItems = items;
    setItems((cur) => (cur ? cur.map((it) => (it.id === id ? { ...it, ...patch } : it)) : cur));
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (admin.isAdmin && admin.password) headers["x-admin-password"] = admin.password;
      const res = await fetch(`/api/aprovacao/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setItems((cur) => (cur ? cur.map((it) => (it.id === id ? (data.item as ContentItem) : it)) : cur));
    } catch {
      setItems(prevItems ?? null);
      setToast("Não foi possível salvar. Tente novamente.");
    }
  }

  function handleApprove(id: string) {
    updateItem(id, { status: "aprovado" });
  }

  function handleRequestChanges(id: string, note: string) {
    updateItem(id, { status: "ajustes", clientNote: note });
  }

  async function handleDelete(id: string) {
    if (!admin.isAdmin || !admin.password) return;
    if (typeof window !== "undefined" && !window.confirm("Remover este conteúdo definitivamente?")) return;
    const prevItems = items;
    setItems((cur) => (cur ? cur.filter((it) => it.id !== id) : cur));
    setOpenPostId((cur) => (cur === id ? null : cur));
    try {
      const res = await fetch(`/api/aprovacao/${id}`, {
        method: "DELETE",
        headers: { "x-admin-password": admin.password },
      });
      if (!res.ok) throw new Error("request failed");
    } catch {
      setItems(prevItems ?? null);
      setToast("Não foi possível remover. Tente novamente.");
    }
  }

  const hasContent = visibleItems.length > 0;

  return (
    <main className="min-h-screen px-4 sm:px-6 pb-24">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 py-6">
        <Logo subtitle="Central de Aprovação" />
        <div className="flex flex-wrap items-center gap-2.5">
          {!clienteParam && knownClientes.length > 0 && (
            <select
              value={selectedCliente}
              onChange={(e) => setSelectedCliente(e.target.value)}
              className="rounded-lg border border-river-line bg-white px-3 py-2 text-[12.5px] font-medium text-river-ink outline-none transition hover:border-river-ink3 focus:border-river-accent"
            >
              <option value="todos">Todos os clientes</option>
              {knownClientes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {admin.isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="rounded-lg bg-river-accent px-3.5 py-2 text-[12.5px] font-semibold text-white transition-all duration-200 hover:bg-river-accentDeep hover:-translate-y-0.5"
              >
                + Adicionar conteúdo
              </button>
              <button
                type="button"
                onClick={admin.logout}
                className="text-[12px] font-medium text-river-ink3 transition hover:text-river-ink"
              >
                Sair do modo agência
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="rounded-lg border border-river-line px-3.5 py-2 text-[12.5px] font-semibold text-river-ink2 transition-all duration-200 hover:border-river-accent hover:text-river-accent"
            >
              Modo Agência
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl mb-10">
        <h1 className="text-[26px] sm:text-[32px] font-bold tracking-tight text-river-ink leading-tight">
          Central de Aprovação de <span className="text-river-accent">Conteúdo</span>
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-river-ink2">
          {clienteParam
            ? `Prévia dos conteúdos preparados para ${clienteParam}. Toque em cada peça para abrir, aprovar ou pedir ajustes.`
            : "Feed, carrosséis, stories e reels prontos para aprovação — exatamente como aparecerão no Instagram."}
        </p>
      </div>

      <div className="mx-auto max-w-5xl">
        {loadError && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-river-badLine bg-river-badSoft px-4 py-3 text-[13px] text-river-bad">
            {loadError}
            <button
              type="button"
              onClick={refresh}
              className="rounded-md bg-white px-3 py-1.5 text-[12px] font-semibold text-river-bad transition hover:bg-river-bad hover:text-white"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {items === null && !loadError && <FeedSkeleton />}

        {items !== null && !hasContent && (
          <EmptyState isAdmin={admin.isAdmin} onAdd={() => setShowAddModal(true)} />
        )}

        {items !== null && hasContent && (
          <div className="space-y-12">
            <StoryTray
              stories={stories}
              isAdmin={admin.isAdmin}
              onApprove={handleApprove}
              onRequestChanges={handleRequestChanges}
              onDelete={handleDelete}
            />
            <ReelsRow
              reels={reels}
              isAdmin={admin.isAdmin}
              onApprove={handleApprove}
              onRequestChanges={handleRequestChanges}
              onDelete={handleDelete}
            />

            {feedPosts.length > 0 && (
              <section>
                <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-river-ink2">
                  Feed &amp; Carrossel
                </h2>
                <div className="mx-auto max-w-[470px] space-y-6">
                  {feedPosts.map((item, i) => (
                    <PostCard
                      key={item.id}
                      item={item}
                      isAdmin={admin.isAdmin}
                      onOpen={() => setOpenPostId(item.id)}
                      onApprove={() => handleApprove(item.id)}
                      onRequestChanges={(note) => handleRequestChanges(item.id, note)}
                      onDelete={() => handleDelete(item.id)}
                      style={{ animationDelay: `${Math.min(i, 6) * 70}ms` }}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <footer className="mx-auto max-w-5xl text-center text-[11px] text-river-ink3 py-14">
        River Agency · Central de Aprovação de Conteúdo
      </footer>

      {showLogin && (
        <AdminLoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={(pw) => {
            admin.login(pw);
            setShowLogin(false);
          }}
        />
      )}

      {showAddModal && admin.password && (
        <AddContentModal
          password={admin.password}
          defaultCliente={clienteParam ?? undefined}
          knownClientes={knownClientes}
          onClose={() => setShowAddModal(false)}
          onCreated={(item) => {
            setItems((cur) => (cur ? [item, ...cur] : [item]));
            setShowAddModal(false);
          }}
        />
      )}

      {openPost && (
        <PostModal
          item={openPost}
          isAdmin={admin.isAdmin}
          onClose={() => setOpenPostId(null)}
          onApprove={() => handleApprove(openPost.id)}
          onRequestChanges={(note) => handleRequestChanges(openPost.id, note)}
          onDelete={() => handleDelete(openPost.id)}
        />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </main>
  );
}

export default function AprovacaoPage() {
  return (
    <Suspense fallback={<main className="min-h-screen px-4 sm:px-6 py-10" />}>
      <AprovacaoApp />
    </Suspense>
  );
}
