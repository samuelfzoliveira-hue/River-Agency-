import type { Metadata } from "next";
import { ApprovalView } from "@/components/approval-view";
import { decideByLinkAction } from "@/lib/actions/approval";
import type { ApprovalPayload } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// link privado: não indexar nem vazar o token por referer
export const metadata: Metadata = { title: "Aprovação de conteúdo", robots: { index: false, follow: false }, referrer: "no-referrer" };

function Notice({ title, text }: { title: string; text: string }) {
  return <div className="card card-pad text-center"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted">{text}</p></div>;
}

export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("approval_view", { p_token: token });
  const p = data as (ApprovalPayload & { expired?: boolean; superseded?: boolean }) | null;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-fg">R</span><span className="text-sm font-semibold">River Agency</span></div>
      {!p ? <Notice title="Link inválido" text="Este link não existe ou foi desativado. Peça um novo link à agência." />
        : p.expired ? <Notice title="Link expirado" text={`O link de “${p.title}” expirou. Peça um novo à agência.`} />
        : p.superseded ? <Notice title="Nova versão disponível" text={`Existe uma versão mais recente de “${p.title}”. Peça à agência o novo link.`} />
        : <ApprovalView p={p} decide={decideByLinkAction.bind(null, token)} askName />}
    </main>
  );
}
