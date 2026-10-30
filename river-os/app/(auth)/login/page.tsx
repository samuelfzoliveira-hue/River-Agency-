import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/form";
import { login } from "@/lib/actions/auth";

export const metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Acesse o RIVER OS com seu e-mail.</p>
      <ActionForm action={login} className="space-y-4">
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Senha</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="input" /></div>
        <SubmitButton className="btn btn-primary w-full" pendingText="Entrando…">Entrar</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-sm text-muted">Primeiro acesso ou convite recebido? <Link href="/cadastro" className="link text-fg">Criar conta</Link></p>
    </>
  );
}
