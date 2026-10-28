import { ActionForm, SubmitButton } from "@/components/form";
import { ContentFields } from "@/components/content-fields";
import { Field, PageHeader, Section } from "@/components/ui";
import { createContentAction } from "@/lib/actions/contents";
import type { ClientRow, Profile } from "@/lib/db";
import { monthStart, todayBR } from "@/lib/domain/dates";
import type { DeliverableType } from "@/lib/domain/types";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Novo conteúdo" };

export default async function NewContent({ searchParams }: { searchParams: Promise<{ cliente?: string; mes?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireCtx();
  const [clients, types, members] = await Promise.all([
    supabase.from("clients").select("id,name").eq("status", "ativo").order("name").then((r) => (r.data ?? []) as Pick<ClientRow, "id" | "name">[]),
    supabase.from("deliverable_types").select("*").eq("active", true).eq("kind", "content").order("position").then((r) => (r.data ?? []) as DeliverableType[]),
    supabase.from("profiles").select("user_id,full_name,role").eq("active", true).order("full_name").then((r) => (r.data ?? []) as Pick<Profile, "user_id" | "full_name" | "role">[]),
  ]);
  const comp = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : monthStart(todayBR());
  return (
    <>
      <PageHeader title="Novo conteúdo" subtitle="Cada conteúdo pertence a um cliente, um tipo de entrega e uma competência mensal. Tarefas podem ser adicionadas depois sem duplicar a contagem." />
      <ActionForm action={createContentAction}>
        <Section title="Dados do conteúdo">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field label="Cliente *"><select className="input" name="client_id" required defaultValue={sp.cliente ?? ""}><option value="" disabled>Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Tipo de conteúdo *"><select className="input" name="deliverable_type_id" required defaultValue=""><option value="" disabled>Selecione</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          </div>
          <ContentFields members={members} defaults={{ competence: comp }} />
          <div className="mt-6"><SubmitButton pendingText="Criando…">Criar conteúdo</SubmitButton></div>
        </Section>
      </ActionForm>
    </>
  );
}
