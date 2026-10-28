import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/lib/actions/auth";
import { getCtx } from "@/lib/session";

export const metadata = { title: "Área do cliente" };

export default async function ClientArea() {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect("/onboarding");
  if (ctx.profile.role !== "cliente") redirect("/");
  const { data } = await ctx.supabase.rpc("portal_contents");
  const items = (data ?? []) as { id: string; title: string; publish_date: string | null; status: string; approval_state: string | null }[];
  const waiting = items.filter((i) => i.approval_state === "aguardando");
  const rest = items.filter((i) => i.approval_state !== "aguardando");
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="eyebrow">River Agency</p>
      <h1 className="mb-6 mt-1 text-2xl font-semibold">Seus conteúdos</h1>
      <h2 className="eyebrow mb-2">Aguardando sua aprovação · {waiting.length}</h2>
      {waiting.length === 0 ? <p className="mb-8 rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">Nada aguardando você.</p> : (
        <ul className="card mb-8 divide-y divide-line">{waiting.map((c) => <li key={c.id}><Link href={`/cliente/${c.id}`} className="flex justify-between gap-3 px-4 py-3 text-sm hover:bg-sunken"><span className="font-medium">{c.title}</span><span className="badge badge-warn">revisar</span></Link></li>)}</ul>
      )}
      {rest.length > 0 && <>
        <h2 className="eyebrow mb-2">Outros</h2>
        <ul className="card divide-y divide-line">{rest.map((c) => <li key={c.id}><Link href={`/cliente/${c.id}`} className="flex justify-between gap-3 px-4 py-3 text-sm hover:bg-sunken"><span>{c.title}</span><span className="badge">{c.status}</span></Link></li>)}</ul>
      </>}
      <form action={logout} className="mt-8"><button className="btn btn-sm">Sair</button></form>
    </main>
  );
}
