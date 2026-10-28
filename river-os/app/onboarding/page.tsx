import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/form";
import { bootstrapAgency, logout } from "@/lib/actions/auth";
import { getCtx } from "@/lib/session";

export const metadata = { title: "Configurar agência" };

export default async function OnboardingPage() {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (ctx.profile?.active) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card card-pad w-full max-w-md">
        <p className="eyebrow">Primeiro acesso</p>
        <h1 className="mt-1 text-2xl font-semibold">Criar a agência</h1>
        <p className="mb-6 mt-2 text-sm text-muted">
          Seu e-mail ({ctx.user.email}) não tem um convite pendente. Você pode criar uma nova agência e será o administrador.
          Se você deveria entrar em uma agência existente, peça ao administrador para convidar este e-mail e saia desta conta.
        </p>
        <ActionForm action={bootstrapAgency} className="space-y-4">
          <div><label className="label" htmlFor="org">Nome da agência</label><input id="org" name="org" defaultValue="River Agency" required className="input" /></div>
          <div><label className="label" htmlFor="name">Seu nome</label><input id="name" name="name" defaultValue={(ctx.user.user_metadata?.full_name as string) ?? ""} required className="input" /></div>
          <SubmitButton className="btn btn-primary w-full" pendingText="Criando…">Criar agência</SubmitButton>
        </ActionForm>
        <form action={logout} className="mt-4"><button className="btn btn-sm">Sair</button></form>
      </div>
    </div>
  );
}
