import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { signup } from "@/lib/actions/auth";

export const metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Use o mesmo e-mail do convite para entrar na agência. Sem convite, você poderá criar uma nova agência no próximo passo.</p>
      <ActionForm action={signup} className="space-y-4">
        <div><label className="label" htmlFor="full_name">Nome</label><input id="full_name" name="full_name" autoComplete="name" required className="input" /></div>
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Senha (mín. 8 caracteres)</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" /></div>
        <SubmitButton className="btn btn-primary w-full" pendingText="Criando…">Criar conta</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">Já tem conta? <Link href="/login" className="link text-fg">Entrar</Link></p>
    </>
  );
}
