import { FilterForm, ActionForm, SubmitButton, ConfirmButton } from "@/components/form";
import { Avatar, Empty, Field, PageHeader, Section } from "@/components/ui";
import { createTaskAction, deleteTaskAction, setTaskStatusAction, updateTaskAction } from "@/lib/actions/tasks";
import { PRIORITY_LABEL, TASK_STATUS_LABEL, type ClientRow, type Profile, type TaskRow } from "@/lib/db";
import { addDays, formatBR, todayBR } from "@/lib/domain/dates";
import { isManager, requireCtx } from "@/lib/session";

export const metadata = { title: "Tarefas" };
type SP = { quando?: string; resp?: string; cliente?: string; status?: string; tarefa?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const { supabase } = ctx;
  const today = todayBR();
  const [tasks, clients, members] = await Promise.all([
    supabase.from("tasks").select("*").order("due_date", { nullsFirst: false }).limit(500).then((r) => (r.data ?? []) as TaskRow[]),
    supabase.from("clients").select("id,name").order("name").then((r) => (r.data ?? []) as Pick<ClientRow, "id" | "name">[]),
    supabase.from("profiles").select("*").eq("active", true).order("full_name").then((r) => (r.data ?? []) as Profile[]),
  ]);
  const staff = members.filter((m) => m.role !== "cliente");
  const cn = (id: string | null) => clients.find((c) => c.id === id)?.name;
  const nm = (id: string | null) => members.find((m) => m.user_id === id)?.full_name ?? "Sem responsável";
  const isOpen = (t: TaskRow) => t.status === "todo" || t.status === "doing";

  const filtered = tasks.filter((t) => {
    if (sp.resp && (sp.resp === "eu" ? t.assignee_id !== ctx.user.id : sp.resp === "none" ? t.assignee_id : t.assignee_id !== sp.resp)) return false;
    if (sp.cliente && t.client_id !== sp.cliente) return false;
    if (sp.status === "concluidas") return t.status === "done";
    if (!sp.tarefa && t.status !== "todo" && t.status !== "doing" && sp.status !== "todas") return false;
    if (sp.quando === "hoje") return t.due_date === today;
    if (sp.quando === "semana") return !!t.due_date && t.due_date >= today && t.due_date <= addDays(today, 7);
    if (sp.quando === "atrasadas") return isOpen(t) && !!t.due_date && t.due_date < today;
    return true;
  });
  const groups: { title: string; items: TaskRow[] }[] = sp.status === "concluidas" || sp.status === "todas"
    ? [{ title: sp.status === "todas" ? "Todas" : "Concluídas", items: filtered }]
    : [
        { title: "Atrasadas", items: filtered.filter((t) => isOpen(t) && t.due_date && t.due_date < today) },
        { title: "Hoje", items: filtered.filter((t) => isOpen(t) && t.due_date === today) },
        { title: "Próximas", items: filtered.filter((t) => isOpen(t) && t.due_date && t.due_date > today) },
        { title: "Sem prazo", items: filtered.filter((t) => isOpen(t) && !t.due_date) },
      ];
  const canEdit = (t: TaskRow) => isManager(ctx.profile.role) || t.assignee_id === ctx.user.id || t.created_by === ctx.user.id;

  return (
    <>
      <PageHeader title="Tarefas" subtitle="Trabalho interno da equipe. Tarefas não são entregas contratuais: o que conta para o cliente são os conteúdos." />
      <Section title="Nova tarefa" className="mb-6">
        <ActionForm action={createTaskAction} resetOnSuccess className="grid gap-3 md:grid-cols-6">
          <Field label="Título *" className="md:col-span-2"><input className="input" name="title" required minLength={2} /></Field>
          <Field label="Responsável"><select className="input" name="assignee_id" defaultValue={ctx.user.id}><option value="">Sem responsável</option>{staff.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select></Field>
          <Field label="Cliente"><select className="input" name="client_id" defaultValue=""><option value="">Interna da agência</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Prazo"><input className="input" type="date" name="due_date" /></Field>
          <Field label="Horas estimadas"><input className="input" name="estimated_hours" inputMode="decimal" placeholder="Ex.: 2,5" /></Field>
          <div className="md:col-span-6"><SubmitButton>Criar tarefa</SubmitButton></div>
        </ActionForm>
      </Section>

      <FilterForm className="mb-6 flex flex-wrap items-end gap-3">
        <select className="input w-44" name="quando" defaultValue={sp.quando ?? ""} aria-label="Quando"><option value="">Qualquer prazo</option><option value="atrasadas">Atrasadas</option><option value="hoje">Hoje</option><option value="semana">Próximos 7 dias</option></select>
        <select className="input w-48" name="resp" defaultValue={sp.resp ?? ""} aria-label="Responsável"><option value="">Todos</option><option value="eu">Minhas</option><option value="none">Sem responsável</option>{staff.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select>
        <select className="input w-44" name="cliente" defaultValue={sp.cliente ?? ""} aria-label="Cliente"><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input w-40" name="status" defaultValue={sp.status ?? ""} aria-label="Situação"><option value="">Em aberto</option><option value="concluidas">Concluídas</option><option value="todas">Todas</option></select>
      </FilterForm>

      <div className="space-y-6">
        {groups.every((g) => g.items.length === 0) && <Empty>Nenhuma tarefa para os filtros atuais.</Empty>}
        {groups.filter((g) => g.items.length).map((g) => (
          <section key={g.title}>
            <h2 className={`eyebrow mb-2 ${g.title === "Atrasadas" ? "text-bad" : ""}`}>{g.title} · {g.items.length}</h2>
            <ul className="card divide-y divide-line">
              {g.items.map((t) => (
                <li key={t.id} id={t.id} className={sp.tarefa === t.id ? "bg-sunken" : ""}>
                  <details open={sp.tarefa === t.id}>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                      <form action={setTaskStatusAction}>
                        <input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value={t.status === "done" ? "todo" : "done"} />
                        <button className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${t.status === "done" ? "border-ok bg-ok text-white" : "border-line hover:border-ok"}`} aria-label={t.status === "done" ? "Reabrir tarefa" : "Concluir tarefa"} disabled={!canEdit(t)}>{t.status === "done" ? "✓" : ""}</button>
                      </form>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm ${t.status === "done" ? "text-muted line-through" : "font-medium"}`}>{t.title}</span>
                        <span className="text-xs text-muted">{cn(t.client_id) ?? "Interna"}{t.content_id ? " · vinculada a conteúdo" : ""}{t.estimated_hours != null ? ` · ${t.estimated_hours}h` : " · sem estimativa"}</span>
                      </span>
                      {t.priority !== "media" && <span className={`badge ${t.priority === "urgente" ? "badge-bad" : t.priority === "alta" ? "badge-warn" : ""}`}>{PRIORITY_LABEL[t.priority]}</span>}
                      <span className={`hidden text-xs sm:block ${t.due_date && t.due_date < today && isOpen(t) ? "text-bad" : "text-muted"}`}>{t.due_date ? formatBR(t.due_date).slice(0, 5) : "—"}</span>
                      <Avatar name={nm(t.assignee_id)} size={24} />
                    </summary>
                    <div className="border-t border-line bg-sunken/50 px-4 py-4">
                      {canEdit(t) ? (
                        <ActionForm action={updateTaskAction} className="grid gap-3 md:grid-cols-4">
                          <input type="hidden" name="id" value={t.id} />
                          <Field label="Título" className="md:col-span-2"><input className="input" name="title" defaultValue={t.title} required /></Field>
                          <Field label="Responsável"><select className="input" name="assignee_id" defaultValue={t.assignee_id ?? ""}><option value="">Sem responsável</option>{staff.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select></Field>
                          <Field label="Situação"><select className="input" name="status" defaultValue={t.status}>{Object.entries(TASK_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                          <Field label="Prazo"><input className="input" type="date" name="due_date" defaultValue={t.due_date ?? ""} /></Field>
                          <Field label="Prioridade"><select className="input" name="priority" defaultValue={t.priority}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                          <Field label="Horas estimadas"><input className="input" name="estimated_hours" defaultValue={t.estimated_hours ?? ""} inputMode="decimal" /></Field>
                          <Field label="Horas registradas"><input className="input" name="logged_hours" defaultValue={t.logged_hours} inputMode="decimal" /></Field>
                          <Field label="Descrição" className="md:col-span-4"><textarea className="input min-h-20" name="description" defaultValue={t.description ?? ""} /></Field>
                          <div className="flex gap-2 md:col-span-4"><SubmitButton>Salvar</SubmitButton></div>
                        </ActionForm>
                      ) : <p className="text-sm text-muted">{t.description || "Sem descrição."} Você pode editar apenas tarefas atribuídas ou criadas por você.</p>}
                      {t.content_id && <p className="mt-3 text-xs"><a className="link" href={`/conteudos/${t.content_id}`}>Abrir conteúdo vinculado</a></p>}
                      {isManager(ctx.profile.role) && <div className="mt-3"><ConfirmButton action={deleteTaskAction} fields={{ id: t.id }} label="Excluir tarefa" message="Excluir esta tarefa?" /></div>}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
