import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApprovalView } from "@/components/approval-view";
import { decidePortalAction } from "@/lib/actions/approval";
import type { ApprovalPayload } from "@/lib/db";
import { getCtx } from "@/lib/session";

export const metadata = { title: "Aprovação" };

export default async function ClientContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (ctx.profile?.role !== "cliente") redirect("/");
  const { data } = await ctx.supabase.rpc("approval_view_portal", { p_content: id });
  if (!data) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/cliente" className="link mb-6 inline-block text-sm">← Seus conteúdos</Link>
      <ApprovalView p={data as ApprovalPayload} decide={decidePortalAction.bind(null, id)} askName={false} />
    </main>
  );
}
