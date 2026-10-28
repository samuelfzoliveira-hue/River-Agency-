import Link from "next/link";
import { Plus } from "lucide-react";
import { FilterForm } from "@/components/form";
import { Kanban, type KCard, type KCol } from "@/components/kanban";
import { PageHeader } from "@/components/ui";
import { firstName } from "@/lib/data";
import { addMonths, monthStart, todayBR } from "@/lib/domain/dates";
import type { ClientRow, ContentRow, Profile, StatusRow } from "@/lib/db";
import type { DeliverableType } from "@/lib/domain/types";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Pipeline" };
type SP = { cliente?: string; tipo?: string; resp?: string; aprovacao?: string; estagio?: string; atraso?: string; aberto?: string; q?: string };

export default async function Pipeline({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireCtx();
  const today = todayBR();
  const prev = addMonths(monthStart(today), -1);
  const [statuses, types, clients, members, contents] = await Promise.all([
    supabase.from("pipeline_statuses").select("*").eq("active", true).order("position").then((r) => (r.data ?? []) as StatusRow[]),
    supabase.from("deliverable_types").select("*").eq("active", true).order("position").then((r) => (r.data ?? []) as DeliverableType[]),
    supabase.from("clients").select("id,name,status").order("name").then((r) => (r.data ?? []) as Pick<ClientRow, "id" | "name" | "status">[]),
    supabase.from("profiles").select("user_id,full_name,role").eq("active", true).order("full_name").then((r) => (r.data ?? []) as Pick<Profile, "user_id" | "full_name" | "role">[]),
    supabase.from("contents").select("*").is("cancelled_at", null).or(`delivery_stage.lt.4,competence.gte.${prev}`).then((r) => (r.data ?? []) as Omit<ContentRow, "approval_state">[]),
  ]);

  const stMap = new Map(statuses.map((s) => [s.id, s]));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const memberName = new Map(members.map((m) => [m.user_id, m.full_name]));

  const filtered = contents.filter((c) => {
    const st = stMap.get(c.status_id);
    if (sp.cliente && c.client_id !== sp.cliente) return false;
    if (sp.tipo && c.deliverable_type_id !== sp.tipo) return false;
    if (sp.resp && (sp.resp === "none" ? c.assignee_id : c.assignee_id !== sp.resp)) return false;
    if (sp.aprovacao && st?.approval_state !== sp.aprovacao) return false;
    if (sp.estagio && c.delivery_stage !== Number(sp.estagio)) return false;
    if (sp.aberto && c.delivery_stage >= 4) return false;
    if (sp.atraso && !(c.delivery_stage < 4 && ((c.internal_deadline && c.internal_deadline < today && c.delivery_stage < 1) || (c.publish_date && c.publish_date < today)))) return false;
    if (sp.q && !c.title.toLowerCase().includes(sp.q.toLowerCase())) return false;
    return true;
  });

  // colunas: etapas padrão (ou as específicas do tipo filtrado) + específicas em uso
  const specificForFilter = sp.tipo ? statuses.filter((s) => s.deliverable_type_id === sp.tipo) : [];
  let base = specificForFilter.length ? specificForFilter : statuses.filter((s) => s.deliverable_type_id === null);
  const used = new Set(filtered.map((c) => c.status_id));
  const extra = statuses.filter((s) => s.deliverable_type_id !== null && used.has(s.id) && !base.includes(s));
  base = [...base, ...extra].sort((a, b) => a.position - b.position);
  const cols: KCol[] = base.map((s) => ({ id: s.id, name: s.deliverable_type_id ? `${s.name} (${typeName.get(s.deliverable_type_id)})` : s.name, stage: s.stage, approval: s.approval_state }));

  const cards: KCard[] = filtered.map((c) => ({
    id: c.id, title: c.title, client: clientName.get(c.client_id) ?? "—", type: typeName.get(c.deliverable_type_id) ?? "—", statusId: c.status_id,
    assignee: c.assignee_id ? firstName(memberName.get(c.assignee_id) ?? "") : null, priority: c.priority, publish: c.publish_date, deadline: c.internal_deadline,
    late: c.delivery_stage < 4 && !!((c.internal_deadline && c.internal_deadline < today && c.delivery_stage < 1) || (c.publish_date && c.publish_date < today)),
    check: [c.checklist?.filter((i) => i.done).length ?? 0, c.checklist?.length ?? 0], extra: c.is_extra, late_published: c.published_late,
  }));
  const filtersActive = Object.values(sp).some(Boolean);

  return (
    <>
      <PageHeader title="Pipeline de produção" subtitle="Arraste os cartões entre as etapas. Em telas pequenas, use o seletor abaixo de cada cartão."
        actions={<Link href="/conteudos/novo" className="btn btn-primary"><Plus size={16} /> Novo conteúdo</Link>} />
      <FilterForm className="mb-6 flex flex-wrap items-end gap-3">
        <input className="input w-44" type="search" name="q" defaultValue={sp.q} placeholder="Buscar título" aria-label="Buscar título" />
        <select className="input w-44" name="cliente" defaultValue={sp.cliente ?? ""} aria-label="Cliente"><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input w-40" name="tipo" defaultValue={sp.tipo ?? ""} aria-label="Tipo"><option value="">Todos os tipos</option>{types.filter((t) => t.kind === "content").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="input w-44" name="resp" defaultValue={sp.resp ?? ""} aria-label="Responsável"><option value="">Todos os responsáveis</option><option value="none">Sem responsável</option>{members.filter((m) => m.role !== "cliente").map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select>
        <select className="input w-44" name="aprovacao" defaultValue={sp.aprovacao ?? ""} aria-label="Aprovação"><option value="">Qualquer aprovação</option><option value="aguardando">Aguardando cliente</option><option value="ajustes">Ajustes solicitados</option><option value="aprovado">Aprovados</option></select>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="atraso" value="1" defaultChecked={!!sp.atraso} /> Só atrasados</label>
        {filtersActive && <Link href="/pipeline" className="btn btn-sm mb-0.5">Limpar</Link>}
      </FilterForm>
      <Kanban cols={cols} cards={cards} />
      {cards.length === 0 && <p className="mt-4 text-sm text-muted">Nenhum conteúdo para os filtros atuais.</p>}
    </>
  );
}
