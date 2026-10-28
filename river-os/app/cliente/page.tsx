import { redirect } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { getCtx } from "@/lib/session";

export const metadata = { title: "Área do cliente" };

export default async function ClientArea() {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/onboarding");
  if (ctx.profile.role !== "cliente") redirect("/");
  const { data } = await ctx.supabase.from("contents").select("id,title,approved_at,publish_date,pipeline_statuses(name)").order("publish_date");
  const items = (data ?? []) as unknown as { id: string; title: string; publish_date: string | null; pipeline_statuses: { name: string } | { name: string }[] | null }[];
  const stName = (x: typeof items[number]) => (Array.isArray(x.pipeline_statuses) ? x.pipeline_statuses[0]?.name : x.pipeline_statuses?.name) ?? "";
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="eyebrow">River Agency</p>
      <h1 className="mb-2 mt-1 text-2xl font-semibold">Seus conteúdos</h1>
      <p className="mb-6 text-sm text-muted">Conteúdos enviados para a sua aprovação. A aprovação com prévia, comentários e histórico de versões chega na próxima fase; por enquanto você pode acompanhar o andamento.</p>
      {items.length === 0 ? <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">Nenhum conteúdo aguardando você.</p> : (
        <ul className="card divide-y divide-line">{items.map((c) => <li key={c.id} className="flex justify-between gap-3 px-4 py-3 text-sm"><span>{c.title}</span><span className="badge">{stName(c)}</span></li>)}</ul>
      )}
      <form action={logout} className="mt-8"><button className="btn btn-sm">Sair</button></form>
    </main>
  );
}
