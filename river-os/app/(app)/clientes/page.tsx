import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterForm } from "@/components/form";
import { Avatar, Empty, PageHeader, Progress, pctTone } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { STATE_LABEL } from "@/lib/domain/contracts";
import { monthLabel } from "@/lib/domain/dates";
import { isManager, requireCtx } from "@/lib/session";

export const metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const s = await loadSnapshot(ctx);
  const q = (sp.q ?? "").toLowerCase();
  const status = sp.status ?? "ativo";
  const list = s.clients.filter((c) => (status === "todos" || c.status === status) && (!q || `${c.name} ${c.segment ?? ""}`.toLowerCase().includes(q)));

  return (
    <>
      <PageHeader title="Clientes" subtitle={`Cumprimento contratual de ${monthLabel(s.competence)}.`}
        actions={isManager(ctx.profile.role) && <Link href="/clientes/novo" className="btn btn-primary"><Plus size={16} /> Novo cliente</Link>} />
      <FilterForm className="mb-6 flex flex-wrap gap-3">
        <input className="input max-w-xs" type="search" name="q" defaultValue={sp.q} placeholder="Buscar por nome ou segmento" aria-label="Buscar cliente" />
        <select className="input w-40" name="status" defaultValue={status} aria-label="Status">
          <option value="ativo">Ativos</option><option value="pausado">Pausados</option><option value="encerrado">Encerrados</option><option value="todos">Todos</option>
        </select>
      </FilterForm>
      {list.length === 0 ? <Empty>Nenhum cliente encontrado.{isManager(ctx.profile.role) && <> <Link href="/clientes/novo" className="link">Cadastrar o primeiro</Link>.</>}</Empty> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const p = s.progress.find((x) => x.clientId === c.id);
            const owner = s.members.find((m) => m.user_id === c.owner_id);
            return (
              <Link key={c.id} href={`/clientes/${c.id}`} className="card card-pad block transition hover:border-brand/40">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{c.name}</h2>
                    <p className="truncate text-xs text-muted">{c.segment || "Sem segmento"}</p>
                  </div>
                  {c.status !== "ativo" && <span className="badge">{c.status}</span>}
                </div>
                {p && p.contracted > 0 ? (
                  <>
                    <div className="mb-1.5 flex justify-between text-sm"><span className="text-muted">{STATE_LABEL[p.state]}</span><span className="tabular-nums font-medium">{p.pct}%</span></div>
                    <Progress value={p.pct ?? 0} tone={p.late ? "bad" : pctTone(p.pct)} label={`Cumprimento de ${c.name}`} />
                    <p className="mt-2 text-xs text-muted">{p.delivered}/{p.contracted} entregas · {p.pending} pendentes{p.late ? ` · ${p.late} atrasada(s)` : ""}{p.extras ? ` · ${p.extras} extra(s)` : ""}</p>
                  </>
                ) : <p className="text-sm text-muted">{c.status === "ativo" ? "Sem metas neste mês" : "—"}</p>}
                {owner && <div className="mt-4 flex items-center gap-2 text-xs text-muted"><Avatar name={owner.full_name} size={20} /> {owner.full_name}</div>}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
