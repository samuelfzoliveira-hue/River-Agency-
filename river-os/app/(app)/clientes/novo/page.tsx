import { ActionForm, SubmitButton } from "@/components/form";
import { CriterionField, PackageFields } from "@/components/contract-fields";
import { Field, PageHeader, Section } from "@/components/ui";
import { createClientAction } from "@/lib/actions/clients";
import { loadSnapshot } from "@/lib/data";
import { todayBR } from "@/lib/domain/dates";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Novo cliente" };

export default async function NewClient() {
  const ctx = await requireCtx(["admin", "gestor"]);
  const s = await loadSnapshot(ctx);
  return (
    <>
      <PageHeader title="Novo cliente" subtitle="Cadastro e pacote contratado. As metas mensais são geradas automaticamente a partir do pacote." />
      <ActionForm action={createClientAction} className="space-y-6">
        <Section title="Empresa">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome da empresa *"><input className="input" name="name" required minLength={2} /></Field>
            <Field label="Segmento"><input className="input" name="segment" placeholder="Ex.: Saúde, Moda, Alimentação" /></Field>
            <Field label="Responsável pelo cliente">
              <select className="input" name="owner_id" defaultValue={ctx.profile.user_id}>
                <option value="">—</option>
                {s.members.filter((m) => m.role !== "cliente").map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
              </select>
            </Field>
            <Field label="Valor mensal (visível apenas a administradores e gestores)"><input className="input" name="monthly_value" inputMode="decimal" placeholder="0,00" /></Field>
          </div>
        </Section>
        <Section title="Contato e redes sociais">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Contato principal"><input className="input" name="contact_name" /></Field>
            <Field label="Cargo"><input className="input" name="contact_role" /></Field>
            <Field label="E-mail"><input className="input" type="email" name="contact_email" /></Field>
            <Field label="Telefone"><input className="input" name="contact_phone" /></Field>
            <Field label="Instagram"><input className="input" name="social_instagram" placeholder="@perfil" /></Field>
            <Field label="TikTok"><input className="input" name="social_tiktok" /></Field>
            <Field label="YouTube"><input className="input" name="social_youtube" /></Field>
            <Field label="Site"><input className="input" name="social_site" /></Field>
          </div>
        </Section>
        <Section title="Contrato e pacote mensal" hint="Deixe tudo em 0 para cadastrar o contrato depois.">
          <div className="mb-4 grid gap-4 md:grid-cols-3">
            <Field label="Início do contrato"><input className="input" type="date" name="start_date" defaultValue={todayBR()} /></Field>
            <Field label="Encerramento (opcional)"><input className="input" type="date" name="end_date" /></Field>
            <CriterionField />
          </div>
          <PackageFields types={s.types} />
        </Section>
        <Section title="Observações estratégicas">
          <textarea className="input min-h-28" name="strategic_notes" placeholder="Posicionamento, tom de voz, restrições, objetivos…" />
        </Section>
        <div className="flex justify-end"><SubmitButton pendingText="Cadastrando…">Cadastrar cliente</SubmitButton></div>
      </ActionForm>
    </>
  );
}
