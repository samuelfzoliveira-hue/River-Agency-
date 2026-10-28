import type { Profile, StatusRow } from "@/lib/db";
import { PRIORITY_LABEL } from "@/lib/db";
import { Field } from "./ui";

type Member = Pick<Profile, "user_id" | "full_name" | "role">;

export function ContentFields({ members, statuses, defaults, showStatus, supporters }: {
  members: Member[]; statuses?: StatusRow[]; showStatus?: boolean; supporters?: string[];
  defaults?: Partial<{ title: string; objective: string | null; briefing: string | null; script: string | null; assignee_id: string | null; priority: string; internal_deadline: string | null; publish_date: string | null; competence: string; is_extra: boolean; status_id: string }>;
}) {
  const staff = members.filter((m) => m.role !== "cliente");
  return (
    <div className="space-y-4">
      <Field label="Título *"><input className="input" name="title" required minLength={2} defaultValue={defaults?.title} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {showStatus && statuses && (
          <Field label="Etapa"><select className="input" name="status_id" defaultValue={defaults?.status_id}>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        )}
        <Field label="Responsável principal"><select className="input" name="assignee_id" defaultValue={defaults?.assignee_id ?? ""}><option value="">Sem responsável</option>{staff.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select></Field>
        <Field label="Prioridade"><select className="input" name="priority" defaultValue={defaults?.priority ?? "media"}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Prazo interno"><input className="input" type="date" name="internal_deadline" defaultValue={defaults?.internal_deadline ?? ""} /></Field>
        <Field label="Publicação prevista"><input className="input" type="date" name="publish_date" defaultValue={defaults?.publish_date ?? ""} /></Field>
        <Field label="Competência (mês de contagem)"><input className="input" type="month" name="competence" defaultValue={defaults?.competence?.slice(0, 7)} /></Field>
      </div>
      {supporters && (
        <fieldset>
          <legend className="label">Colaboradores de apoio</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {staff.map((m) => <label key={m.user_id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="supporters" value={m.user_id} defaultChecked={supporters.includes(m.user_id)} />{m.full_name}</label>)}
          </div>
        </fieldset>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="is_extra" className="mt-0.5" defaultChecked={defaults?.is_extra} />
        <span>Conteúdo extra <span className="block text-xs text-muted">Fora do pacote contratado: aparece separado e não conta para a meta.</span></span>
      </label>
      <Field label="Objetivo"><input className="input" name="objective" defaultValue={defaults?.objective ?? ""} placeholder="Ex.: gerar leads para a campanha de outubro" /></Field>
      <Field label="Briefing"><textarea className="input min-h-28" name="briefing" defaultValue={defaults?.briefing ?? ""} /></Field>
      <Field label="Roteiro"><textarea className="input min-h-36" name="script" defaultValue={defaults?.script ?? ""} /></Field>
    </div>
  );
}
