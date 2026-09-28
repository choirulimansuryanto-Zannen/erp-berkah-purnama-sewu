import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DecisionButtons } from "@/components/validations/decision-buttons";

type Adjustment = {
  id: string;
  qtyChange: number;
  reason: string;
  outlet: { name: string };
  product: { name: string };
  requester: { name: string };
};

export function AdjustmentList({ adjustments, canDecide }: { adjustments: Adjustment[]; canDecide: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Adjustment {canDecide ? "Menunggu Persetujuan" : "Anda"}</CardTitle>
      </CardHeader>
      <ul className="divide-y divide-slate-100">
        {adjustments.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
            <div>
              <p className="font-medium text-slate-900">
                {a.product.name} ·{" "}
                <span className={a.qtyChange > 0 ? "text-emerald-600" : "text-rose-600"}>
                  {a.qtyChange > 0 ? "+" : ""}
                  {a.qtyChange}
                </span>
              </p>
              <p className="text-slate-500">
                {a.outlet.name} · {a.requester.name} · {a.reason}
              </p>
            </div>
            {canDecide && <DecisionButtons endpoint={`/api/inventory/stock-adjustment/${a.id}/decision`} />}
          </li>
        ))}
        {adjustments.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-slate-400">Tidak ada data.</li>
        )}
      </ul>
    </Card>
  );
}
