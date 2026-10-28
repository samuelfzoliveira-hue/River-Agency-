import { ActionForm, SubmitButton } from "@/components/form";
import { Field, PageHeader, Section } from "@/components/ui";
import { saveAlertSettingsAction, saveStatusAction, saveTypeAction } from "@/lib/actions/settings";
import type { ClientRow, StatusRow } from "@/lib/db";
import { DEFAULT_ALERT_SETTINGS, type AlertSettings, type DeliverableType } from "@/lib/domain/types";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Configurações" };

const STAGES = [[0, "0 · Em produção"], [1, "1 · Produzido"], [2, "2 · Aprovado"], [3, "3 · Agendado"], [4, "4 · Publicado"]] as const;

function StatusForm({ st, types }: { st?: StatusRow; types: DeliverableType[] }) {
  return (
    <ActionForm action={saveStatusAction} className="grid items-end gap-3 md:grid-cols-7">
      {st && <input type="hidden" name="id" value={st.id} />}
      <Field label="Nome" className="md:col-span-2"><input className="input" name="name" defaultValue={st?.name} required /></Field>
      <Field label="Posição"><input className="input" type="number" name="position" defaultValue={st?.position ?? 99} /></Field>
      <Field label="Estágio"><select className="input" name="stage" defaultValue={st?.stage ?? 0}>{STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Aprovação"><select className="input" name="approval_state" defaultValue={st?.approval_state ?? ""}><option value="">—</option><option value="aguardando">Aguardando cliente</option><option value="ajustes">Ajustes</option><option value="aprovado">Aprovado</option></select></Field>
      <Field label="Tipo de projeto"><select className="input" name="deliverable_type_id" defaultValue={st?.deliverable_type_id ?? ""} disabled={!!st}><option value="">Padrão (todos)</option>{types.filter((t) => t.kind === "content").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
      <div className="flex items-center gap-3 pb-1">
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={st?.active ?? true} /> Ativa</label>
        <SubmitButton className="btn btn-sm">{st ? "Salvar" : "Adicionar"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

function AlertForm({ cfg, clients, label }: { cfg: AlertSettings; clients?: Pick<ClientRow, "id" | "name">[]; label?: string }) {
  return (
    <ActionForm action={saveAlertSettingsAction} className="grid items-end gap-3 md:grid-cols-5">
      {clients ? <Field label="Cliente"><select className="input" name="client_id" required defaultValue=""><option value="" disabled>Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field> : <div className="pb-2 text-sm font-medium">{label}</div>}
      <Field label="Aprovação lenta após (horas)"><input className="input" type="number" name="approval_wait_hours" min={1} defaultValue={cfg.approval_wait_hours} /></Field>
      <Field label="Aviso de prazo (dias antes)"><input className="input" type="number" name="deadline_warning_days" min={0} defaultValue={cfg.deadline_warning_days} /></Field>
      <Field label="Aviso de fim de contrato (dias)"><input className="input" type="number" name="contract_end_warning_days" min={0} defaultValue={cfg.contract_end_warning_days} /></Field>
      <Field label="Dias úteis por entrega pendente"><input className="input" type="number" step="0.5" min={0.5} name="min_business_days_per_item" defaultValue={cfg.min_business_days_per_item} /></Field>
      <div className="md:col-span-5"><SubmitButton className="btn btn-sm">Salvar limites</SubmitButton></div>
    </ActionForm>
  );
}

export default async function Settings() {
  const { supabase } = await requireCtx(["admin"]);
  const [statuses, types, settings, clients] = await Promise.all([
    supabase.from("pipeline_statuses").select("*").order("position").then((r) => (r.data ?? []) as StatusRow[]),
    supabase.from("deliverable_types").select("*").order("position").then((r) => (r.data ?? []) as (DeliverableType & { active: boolean })[]),
    supabase.from("alert_settings").select("*").then((r) => (r.data ?? []) as AlertSettings[]),
    supabase.from("clients").select("id,name").order("name").then((r) => (r.data ?? []) as Pick<ClientRow, "id" | "name">[]),
  ]);
  const base = settings.find((s) => !s.client_id && !s.deliverable_type_id) ?? DEFAULT_ALERT_SETTINGS;
  const overrides = settings.filter((s) => s.client_id && !s.deliverable_type_id);
  return (
    <>
      <PageHeader title="Configurações" subtitle="Etapas do pipeline, tipos de entrega e limites dos alertas. Alterações valem para os cálculos futuros; o histórico não é reescrito." />
      <div className="space-y-6">
        <Section title="Etapas do pipeline" hint="O estágio define quando uma entrega conta no contrato: 2 = aprovado, 3 = agendado, 4 = publicado. Etapas específicas de um tipo de projeto substituem as padrão naquele tipo.">
          <div className="space-y-5">
            {statuses.map((s) => <StatusForm key={s.id} st={s} types={types} />)}
            <div className="border-t border-line pt-5"><p className="eyebrow mb-3">Nova etapa</p><StatusForm types={types} /></div>
          </div>
        </Section>
        <Section title="Tipos de entrega" hint="Aparecem no pacote do contrato e no pipeline. “Horas padrão” é apenas sugestão — a capacidade usa a estimativa de cada tarefa.">
          <div className="space-y-4">
            {types.map((t) => (
              <ActionForm key={t.id} action={saveTypeAction} className="grid items-end gap-3 md:grid-cols-5">
                <input type="hidden" name="id" value={t.id} />
                <Field label="Nome" className="md:col-span-2"><input className="input" name="name" defaultValue={t.name} required /></Field>
                <Field label="Horas padrão"><input className="input" name="default_hours" defaultValue={t.default_hours} inputMode="decimal" /></Field>
                <label className="flex items-center gap-1.5 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={t.active} /> Ativo · {t.kind === "shoot" ? "sessão" : "conteúdo"}</label>
                <SubmitButton className="btn btn-sm">Salvar</SubmitButton>
              </ActionForm>
            ))}
            <ActionForm action={saveTypeAction} className="grid items-end gap-3 border-t border-line pt-5 md:grid-cols-5">
              <Field label="Novo tipo" className="md:col-span-2"><input className="input" name="name" required placeholder="Ex.: Vídeo institucional" /></Field>
              <Field label="Horas padrão"><input className="input" name="default_hours" defaultValue={2} /></Field>
              <Field label="Natureza"><select className="input" name="kind"><option value="content">Conteúdo</option><option value="shoot">Sessão de captação</option></select></Field>
              <SubmitButton className="btn btn-sm">Adicionar</SubmitButton>
            </ActionForm>
          </div>
        </Section>
        <Section title="Limites de alerta" hint="Padrão da agência e exceções por cliente. “Dias úteis por entrega pendente” calibra o aviso de contrato em risco.">
          <AlertForm cfg={base} label="Padrão da agência" />
          {overrides.map((o) => <div key={o.id} className="mt-5 border-t border-line pt-5"><p className="mb-2 text-sm font-medium">{clients.find((c) => c.id === o.client_id)?.name}</p><AlertOverride cfg={o} /></div>)}
          <div className="mt-5 border-t border-line pt-5"><p className="eyebrow mb-3">Exceção para um cliente</p><AlertForm cfg={base} clients={clients} /></div>
        </Section>
      </div>
    </>
  );
}

function AlertOverride({ cfg }: { cfg: AlertSettings }) {
  return (
    <ActionForm action={saveAlertSettingsAction} className="grid items-end gap-3 md:grid-cols-5">
      <input type="hidden" name="client_id" value={cfg.client_id ?? ""} />
      <Field label="Aprovação lenta (h)"><input className="input" type="number" name="approval_wait_hours" min={1} defaultValue={cfg.approval_wait_hours} /></Field>
      <Field label="Aviso de prazo (dias)"><input className="input" type="number" name="deadline_warning_days" min={0} defaultValue={cfg.deadline_warning_days} /></Field>
      <Field label="Fim de contrato (dias)"><input className="input" type="number" name="contract_end_warning_days" min={0} defaultValue={cfg.contract_end_warning_days} /></Field>
      <Field label="Dias úteis por entrega"><input className="input" type="number" step="0.5" min={0.5} name="min_business_days_per_item" defaultValue={cfg.min_business_days_per_item} /></Field>
      <SubmitButton className="btn btn-sm">Salvar</SubmitButton>
    </ActionForm>
  );
}
