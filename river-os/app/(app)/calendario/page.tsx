import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActionForm, ConfirmButton, FilterForm, SubmitButton } from "@/components/form";
import { Empty, Field, PageHeader, Section } from "@/components/ui";
import { createEventAction, deleteEventAction } from "@/lib/actions/misc";
import type { ClientRow, ContentRow, EventRow, Profile, ShootRow, StatusRow } from "@/lib/db";
import { buildCalendarItems, KIND_LABEL, type CalendarItem, type CalendarKind } from "@/lib/domain/calendar";
import { addDays, addMonths, eachDay, formatBR, isoWeekday, monthEnd, monthLabel, monthStart, todayBR, weekStart } from "@/lib/domain/dates";
import type { DeliverableType } from "@/lib/domain/types";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Calendário" };
type SP = { modo?: string; data?: string; cliente?: string; resp?: string; tipo?: string; status?: string };

// produção, aprovação e publicação têm cores distintas
const STYLE: Record<CalendarKind, string> = {
  producao: "border-info/40 bg-info/10 text-info",
  aprovacao: "border-warn/40 bg-warn/10 text-warn",
  publicacao: "border-ok/40 bg-ok/10 text-ok",
  captacao: "border-brand bg-brand text-brand-fg",
  reuniao: "border-line bg-sunken text-fg",
  campanha: "border-bad/30 bg-bad/10 text-bad",
  interno: "border-line bg-surface text-muted",
};

function Chip({ i, names }: { i: CalendarItem; names: Map<string, string> }) {
  return (
    <Link href={i.href} title={`${KIND_LABEL[i.kind]} · ${i.title}${i.clientId ? ` · ${names.get(i.clientId)}` : ""}`}
      className={`block truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight ${STYLE[i.kind]} ${i.done ? "opacity-50 line-through" : ""}`}>
      {i.time && <span className="mr-1 opacity-80">{i.time}</span>}{i.clientId ? `${names.get(i.clientId)?.split(" ")[0]} · ` : ""}{i.title}
    </Link>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireCtx();
  const today = todayBR();
  const modo = sp.modo === "semana" || sp.modo === "dia" ? sp.modo : "mes";
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : today;
  const from = modo === "mes" ? weekStart(monthStart(ref)) : modo === "semana" ? weekStart(ref) : ref;
  const to = modo === "mes" ? addDays(weekStart(monthStart(ref)), 41) : modo === "semana" ? addDays(from, 6) : ref;

  const [clients, members, types, statuses, contents, shoots, events] = await Promise.all([
    supabase.from("clients").select("id,name").order("name").then((r) => (r.data ?? []) as Pick<ClientRow, "id" | "name">[]),
    supabase.from("profiles").select("user_id,full_name,role").eq("active", true).order("full_name").then((r) => (r.data ?? []) as Pick<Profile, "user_id" | "full_name" | "role">[]),
    supabase.from("deliverable_types").select("*").eq("active", true).order("position").then((r) => (r.data ?? []) as DeliverableType[]),
    supabase.from("pipeline_statuses").select("*").eq("active", true).order("position").then((r) => (r.data ?? []) as StatusRow[]),
    supabase.from("contents").select("*").is("cancelled_at", null)
      .or(`and(publish_date.gte.${from},publish_date.lte.${to}),and(internal_deadline.gte.${from},internal_deadline.lte.${to})`).then((r) => (r.data ?? []) as Omit<ContentRow, "approval_state">[]),
    supabase.from("shoots").select("*").neq("status", "cancelada").gte("starts_at", `${addDays(from, -1)}T00:00:00Z`).lte("starts_at", `${addDays(to, 1)}T23:59:59Z`).then((r) => (r.data ?? []) as ShootRow[]),
    supabase.from("events").select("*").gte("starts_at", `${addDays(from, -1)}T00:00:00Z`).lte("starts_at", `${addDays(to, 1)}T23:59:59Z`).then((r) => (r.data ?? []) as EventRow[]),
  ]);
  const apr = new Map(statuses.map((s) => [s.id, s.approval_state]));
  const names = new Map(clients.map((c) => [c.id, c.name]));
  const contentFilter = !!(sp.resp || sp.tipo || sp.status);

  let items = buildCalendarItems({ contents: contents.map((c) => ({ ...c, approval_state: apr.get(c.status_id) ?? null })), shoots, events })
    .filter((i) => i.date >= from && i.date <= to);
  items = items.filter((i) => {
    if (sp.cliente && i.clientId !== sp.cliente) return false;
    if (contentFilter && (i.kind === "producao" || i.kind === "publicacao")) {
      if (sp.resp && i.assigneeId !== sp.resp) return false;
      if (sp.tipo && i.typeId !== sp.tipo) return false;
      if (sp.status && i.statusId !== sp.status) return false;
    } else if (contentFilter) return false; // filtros de conteúdo ocultam captações e eventos
    return true;
  });
  const byDay = new Map<string, CalendarItem[]>();
  items.forEach((i) => byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]));

  const step = modo === "mes" ? 31 : modo === "semana" ? 7 : 1;
  const prev = modo === "mes" ? addMonths(ref, -1) : addDays(ref, -step);
  const next = modo === "mes" ? addMonths(ref, 1) : addDays(ref, step);
  const q = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(sp as Record<string, string>), ...over });
    [...p.keys()].forEach((k) => !p.get(k) && p.delete(k));
    return `?${p.toString()}`;
  };
  const title = modo === "mes" ? monthLabel(ref) : modo === "semana" ? `${formatBR(from)} – ${formatBR(to)}` : formatBR(ref);
  const days = eachDay(from, to);
  const WD = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

  return (
    <>
      <PageHeader title="Calendário editorial" subtitle="Produção, aprovação e publicação em cores distintas. Clique em um item para abrir a ficha." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link className="btn btn-sm" href={q({ data: prev })} aria-label="Anterior"><ChevronLeft size={14} /></Link>
          <span className="min-w-52 text-center text-sm font-medium capitalize">{title}</span>
          <Link className="btn btn-sm" href={q({ data: next })} aria-label="Próximo"><ChevronRight size={14} /></Link>
          <Link className="btn btn-sm" href={q({ data: "" })}>Hoje</Link>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
          {(["mes", "semana", "dia"] as const).map((m) => <Link key={m} href={q({ modo: m })} className={`px-3 py-1.5 ${modo === m ? "bg-brand text-brand-fg" : "bg-surface hover:bg-sunken"}`}>{m === "mes" ? "Mês" : m === "semana" ? "Semana" : "Dia"}</Link>)}
        </div>
      </div>
      <FilterForm className="mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="modo" value={modo} /><input type="hidden" name="data" value={ref} />
        <select className="input w-44" name="cliente" defaultValue={sp.cliente ?? ""} aria-label="Cliente"><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input w-44" name="resp" defaultValue={sp.resp ?? ""} aria-label="Colaborador"><option value="">Todos os colaboradores</option>{members.filter((m) => m.role !== "cliente").map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select>
        <select className="input w-40" name="tipo" defaultValue={sp.tipo ?? ""} aria-label="Tipo"><option value="">Todos os tipos</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select className="input w-48" name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">Todos os status</option>{statuses.filter((s) => !s.deliverable_type_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      </FilterForm>
      <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
        {(["producao", "aprovacao", "publicacao", "captacao", "reuniao", "campanha"] as CalendarKind[]).map((k) => <span key={k} className={`rounded-md border px-2 py-0.5 ${STYLE[k]}`}>{KIND_LABEL[k]}</span>)}
        {contentFilter && <span className="text-muted">Filtros de colaborador/tipo/status mostram apenas conteúdos.</span>}
      </div>

      {modo === "mes" ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line md:block">
            <div className="grid grid-cols-7 border-b border-line bg-sunken text-center text-xs text-muted">{WD.map((d) => <div key={d} className="py-2 uppercase tracking-wider">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const inMonth = d >= monthStart(ref) && d <= monthEnd(ref);
                const its = byDay.get(d) ?? [];
                return (
                  <div key={d} className={`min-h-28 border-b border-r border-line p-1.5 ${inMonth ? "bg-surface" : "bg-sunken/50"} ${d === today ? "ring-2 ring-inset ring-brand/60" : ""}`}>
                    <Link href={q({ modo: "dia", data: d })} className={`mb-1 block text-xs ${inMonth ? "" : "text-muted"} ${d === today ? "font-bold" : ""}`}>{Number(d.slice(8))}</Link>
                    <div className="space-y-1">{its.slice(0, 4).map((i) => <Chip key={i.id} i={i} names={names} />)}{its.length > 4 && <Link href={q({ modo: "dia", data: d })} className="block text-[11px] text-muted">+{its.length - 4} mais</Link>}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="space-y-3 md:hidden">
            {days.filter((d) => byDay.has(d) && d >= monthStart(ref) && d <= monthEnd(ref)).map((d) => (
              <div key={d} className="card card-pad"><p className="eyebrow mb-2">{formatBR(d).slice(0, 5)}</p><div className="space-y-1">{byDay.get(d)!.map((i) => <Chip key={i.id} i={i} names={names} />)}</div></div>
            ))}
            {items.length === 0 && <Empty>Nada neste mês.</Empty>}
          </div>
        </>
      ) : (
        <div className={`grid gap-3 ${modo === "semana" ? "md:grid-cols-7" : ""}`}>
          {days.map((d) => (
            <div key={d} className={`card card-pad ${d === today ? "border-brand" : ""}`}>
              <p className="eyebrow mb-2">{WD[isoWeekday(d) - 1]} {formatBR(d).slice(0, 5)}</p>
              <div className="space-y-1.5">{(byDay.get(d) ?? []).map((i) => <Chip key={i.id} i={i} names={names} />)}{!(byDay.get(d) ?? []).length && <p className="text-xs text-muted">—</p>}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Section title="Novo evento" hint="Reuniões, prazos de aprovação, campanhas sazonais e entregas internas. Publicações e prazos vêm dos conteúdos.">
          <ActionForm action={createEventAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Field label="Título *" className="sm:col-span-2"><input className="input" name="title" required minLength={2} /></Field>
            <Field label="Tipo"><select className="input" name="kind" defaultValue="reuniao"><option value="reuniao">Reunião</option><option value="prazo_aprovacao">Prazo de aprovação</option><option value="campanha">Campanha sazonal</option><option value="interno">Entrega interna</option><option value="outro">Outro</option></select></Field>
            <Field label="Data e hora *"><input className="input" type="datetime-local" name="starts_at" required defaultValue={`${ref}T10:00`} /></Field>
            <Field label="Cliente" className="sm:col-span-2"><select className="input" name="client_id" defaultValue=""><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <div className="sm:col-span-2"><SubmitButton>Criar evento</SubmitButton></div>
          </ActionForm>
        </Section>
        <Section title="Eventos do período">
          {events.filter((e) => e.starts_at.slice(0, 10) >= from).length === 0 ? <Empty>Sem eventos avulsos no período.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2"><span>{e.title}<span className="block text-xs text-muted">{formatBR(e.starts_at.slice(0, 10))} · {e.kind.replace("_", " ")}{e.client_id ? ` · ${names.get(e.client_id)}` : ""}</span></span>
                  {profile.role !== "designer" && <ConfirmButton action={deleteEventAction} fields={{ id: e.id }} label="Excluir" message="Excluir este evento?" />}</li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
