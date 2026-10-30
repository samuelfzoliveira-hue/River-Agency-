import { CRITERION_LABEL } from "@/lib/domain/types";
import type { ContractItemRow } from "@/lib/db";
import { PERIODICITY_LABEL } from "@/lib/db";
import type { DeliverableType } from "@/lib/domain/types";
import { Field } from "./ui";

/** Campos do pacote contratado: uma linha por tipo de entrega (quantidade + periodicidade). */
export function PackageFields({ types, items }: { types: DeliverableType[]; items?: ContractItemRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-sunken text-left text-xs text-muted"><tr><th className="px-3 py-2 font-medium">Entrega</th><th className="px-3 py-2 font-medium">Quantidade</th><th className="px-3 py-2 font-medium">Periodicidade</th></tr></thead>
        <tbody>
          {types.map((t) => {
            const it = items?.find((i) => i.deliverable_type_id === t.id);
            return (
              <tr key={t.id} className="border-t border-line">
                <td className="px-3 py-2">{t.name}{t.kind === "shoot" && <span className="ml-1.5 text-xs text-muted">(sessão)</span>}</td>
                <td className="px-3 py-2"><input className="input w-24" type="number" min={0} step={1} name={`item_${t.id}`} defaultValue={it?.quantity ?? 0} aria-label={`Quantidade de ${t.name}`} /></td>
                <td className="px-3 py-2">
                  <select className="input w-36" name={`per_${t.id}`} defaultValue={it?.periodicity ?? "monthly"} aria-label={`Periodicidade de ${t.name}`}>
                    {Object.entries(PERIODICITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-line bg-sunken px-3 py-2 text-xs text-muted">Semanal = quantidade × semanas (segundas-feiras) do mês · Quinzenal = quantidade × metade delas · 0 = não contratado.</p>
    </div>
  );
}

export function CriterionField({ defaultValue = "published" }: { defaultValue?: string }) {
  return (
    <Field label="A entrega conta como concluída…">
      <select name="criterion" className="input" defaultValue={defaultValue}>
        {Object.entries(CRITERION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </Field>
  );
}
