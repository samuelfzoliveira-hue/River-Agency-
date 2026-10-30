import Link from "next/link";
import { ActionForm, ConfirmButton, FilterForm, SubmitButton } from "@/components/form";
import { ChecklistEditor } from "@/components/checklist-editor";
import { Empty, Field, PageHeader, Section } from "@/components/ui";
import { createShootAction, saveShootChecklistAction, linkShootContentAction, rescheduleShootAction, setShootStatusAction, toggleRecordedAction, unlinkShootContentAction } from "@/lib/actions/shoots";
import type { ClientRow, ContentRow, Profile, ShootRow } from "@/lib/db";
import { brDate, brTime, formatBR, todayBR } from "@/lib/domain/dates";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Captações" };

const STATUS_BADGE: Record<string, string> = { agendada: "", reagendada: "badge-warn", realizada: "badge-ok", cancelada: "badge-bad" };

export default async function ShootsPage({ searchParams }: { searchParams: Promise<{ cliente?: string; ver?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireCtx();
  const today = todayBR();
  const [shoots, clients, members, links, team, contents] = await Promise.all([
    supabase.from("shoots").select("*").order("starts_at", { ascending: true }).limit(300).then((r) => (r.data ?? []) as ShootRow[]),
    supabase.from("clients").select("id,name,status").order("name").then((r) => (r.data ?? []) as Pick<ClientRow, "id" | "name" | "status">[]),
    supabase.from("profiles").select("user_id,full_name,role").eq("active", true).order("full_name").then((r) => (r.data ?? []) as Pick<Profile, "user_id" | "full_name" | "role">[]),
    supabase.from("shoot_contents").select("*").then((r) => (r.data ?? []) as { shoot_id: string; content_id: string; recorded: boolean }[]),
    supabase.from("shoot_members").select("*").then((r) => (r.data ?? []) as { shoot_id: string; user_id: string }[]),
    supabase.from("contents").select("id,title,client_id,delivery_stage").is("cancelled_at", null).lt("delivery_stage", 4).then((r) => (r.data ?? []) as Pick<ContentRow, "id" | "title" | "client_id" | "delivery_stage">[]),
  ]);
  const cn = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const staff = members.filter((m) => m.role !== "cliente");
  const list = shoots.filter((s) => !sp.cliente || s.client_id === sp.cliente);
  const upcoming = list.filter((s) => (s.status === "agendada" || s.status === "reagendada"));
  const past = list.filter((s) => s.status === "realizada" || s.status === "cancelada").reverse();

  const card = (s: ShootRow) => {
    const sl = links.filter((l) => l.shoot_id === s.id);
    const members_ = team.filter((t) => t.shoot_id === s.id).map((t) => staff.find((m) => m.user_id === t.user_id)?.full_name).filter(Boolean);
    const day = brDate(s.starts_at);
    const open = s.status === "agendada" || s.status === "reagendada";
    const linkable = contents.filter((c) => c.client_id === s.client_id && !sl.some((l) => l.content_id === c.id));
    return (
      <li key={s.id} className="card card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold"><Link href={`/clientes/${s.client_id}`} className="hover:underline">{cn(s.client_id)}</Link> <span className="font-normal text-muted">· {s.title}</span></p>
            <p className="mt-0.5 text-sm text-muted">{formatBR(day)} às {brTime(s.starts_at)} · {s.duration_minutes} min{s.location ? ` · ${s.location}` : ""}{s.is_extra ? " · extra" : ""}</p>
            {members_.length > 0 && <p className="text-xs text-muted">Equipe: {members_.join(", ")}</p>}
          </div>
          <div className="flex items-center gap-2">
            {open && day < today && <span className="badge badge-bad">sem registro</span>}
            <span className={`badge ${STATUS_BADGE[s.status]}`}>{s.status}</span>
          </div>
        </div>

        <div className="mt-4">
          <p className="eyebrow mb-2">Conteúdos a produzir · {sl.filter((l) => l.recorded).length}/{sl.length} gravados</p>
          {sl.length === 0 ? <p className="text-xs text-muted">Nenhum conteúdo vinculado.</p> : (
            <ul className="space-y-1.5 text-sm">
              {sl.map((l) => {
                const c = contents.find((x) => x.id === l.content_id);
                return (
                  <li key={l.content_id} className="flex items-center gap-2">
                    <form action={toggleRecordedAction} className="flex items-center gap-2">
                      <input type="hidden" name="shoot_id" value={s.id} /><input type="hidden" name="content_id" value={l.content_id} /><input type="hidden" name="recorded" value={String(!l.recorded)} />
                      <button className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] ${l.recorded ? "border-ok bg-ok text-white" : "border-line"}`} aria-label={l.recorded ? "Marcar como não gravado" : "Marcar como gravado"}>{l.recorded ? "✓" : ""}</button>
                    </form>
                    <Link href={`/conteudos/${l.content_id}`} className={`flex-1 hover:underline ${l.recorded ? "" : "text-fg"}`}>{c?.title ?? "Conteúdo"}</Link>
                    {!l.recorded && sl.length > 0 && s.status === "realizada" && <span className="badge badge-warn">ainda a produzir</span>}
                    <form action={unlinkShootContentAction}><input type="hidden" name="shoot_id" value={s.id} /><input type="hidden" name="content_id" value={l.content_id} /><button className="text-xs text-muted hover:text-bad" aria-label="Desvincular">remover</button></form>
                  </li>
                );
              })}
            </ul>
          )}
          {linkable.length > 0 && (
            <form action={linkShootContentAction} className="mt-3 flex gap-2">
              <input type="hidden" name="shoot_id" value={s.id} />
              <select name="content_id" className="input" aria-label="Vincular conteúdo" defaultValue=""><option value="" disabled>Vincular conteúdo do cliente…</option>{linkable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
              <SubmitButton className="btn" pendingText="…">Vincular</SubmitButton>
            </form>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {open && <form action={setShootStatusAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="realizada" /><SubmitButton className="btn btn-primary btn-sm" pendingText="…">Marcar como realizada</SubmitButton></form>}
          {open && <ConfirmButton action={setShootStatusAction} fields={{ id: s.id, status: "cancelada" }} label="Cancelar captação" message="Cancelar esta captação? Ela deixará de contar para o contrato." />}
          {s.status === "cancelada" && <form action={setShootStatusAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="agendada" /><SubmitButton className="btn btn-sm" pendingText="…">Reativar</SubmitButton></form>}
          {s.raw_material_url && <a href={s.raw_material_url} target="_blank" rel="noopener noreferrer" className="link text-sm">Material bruto</a>}
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-fg">Checklists de equipamentos e cenas</summary>
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            <div><p className="eyebrow mb-2">Equipamentos</p><ChecklistEditor initial={s.equipment_checklist ?? []} save={saveShootChecklistAction.bind(null, s.id, "equipment")} /></div>
            <div><p className="eyebrow mb-2">Cenas</p><ChecklistEditor initial={s.scene_checklist ?? []} save={saveShootChecklistAction.bind(null, s.id, "scene")} /></div>
          </div>
        </details>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted hover:text-fg">Reagendar / local / material bruto / observações</summary>
          <ActionForm action={rescheduleShootAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={s.id} />
            <Field label="Nova data e hora"><input className="input" type="datetime-local" name="starts_at" required defaultValue={`${day}T${brTime(s.starts_at)}`} /></Field>
            <Field label="Local"><input className="input" name="location" defaultValue={s.location ?? ""} /></Field>
            <Field label="Link do material bruto" className="sm:col-span-2"><input className="input" type="url" name="raw_material_url" defaultValue={s.raw_material_url ?? ""} placeholder="https://drive.google.com/…" /></Field>
            <Field label="Observações" className="sm:col-span-2"><textarea className="input min-h-20" name="notes" defaultValue={s.notes ?? ""} /></Field>
            <div className="sm:col-span-2"><SubmitButton className="btn">Salvar</SubmitButton></div>
          </ActionForm>
        </details>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Captações" subtitle="Sessões de gravação são atividades separadas dos conteúdos. Contam para o contrato quando marcadas como realizadas." />
      <Section title="Agendar captação" className="mb-6">
        <ActionForm action={createShootAction} resetOnSuccess className="grid gap-3 md:grid-cols-4">
          <Field label="Cliente *"><select className="input" name="client_id" required defaultValue={sp.cliente ?? ""}><option value="" disabled>Selecione</option>{clients.filter((c) => c.status === "ativo").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Data e hora *"><input className="input" type="datetime-local" name="starts_at" required /></Field>
          <Field label="Duração (min)"><input className="input" type="number" name="duration_minutes" min={15} step={15} defaultValue={120} /></Field>
          <Field label="Local"><input className="input" name="location" /></Field>
          <Field label="Título" className="md:col-span-2"><input className="input" name="title" defaultValue="Captação" /></Field>
          <fieldset className="md:col-span-2"><legend className="label">Equipe</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{staff.map((m) => <label key={m.user_id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="team" value={m.user_id} />{m.full_name}</label>)}</div></fieldset>
          <label className="flex items-center gap-2 text-sm md:col-span-4"><input type="checkbox" name="is_extra" /> Captação extra (fora do pacote contratado)</label>
          <div className="md:col-span-4"><SubmitButton>Agendar</SubmitButton></div>
        </ActionForm>
      </Section>
      <FilterForm className="mb-6">
        <select className="input w-52" name="cliente" defaultValue={sp.cliente ?? ""} aria-label="Cliente"><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </FilterForm>
      <h2 className="eyebrow mb-3">A realizar · {upcoming.length}</h2>
      {upcoming.length === 0 ? <Empty>Nenhuma captação pendente.</Empty> : <ul className="space-y-4">{upcoming.map(card)}</ul>}
      {past.length > 0 && <><h2 className="eyebrow mb-3 mt-10">Histórico · {past.length}</h2><ul className="space-y-4">{past.slice(0, 20).map(card)}</ul></>}
    </>
  );
}
