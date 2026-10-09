import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getCompanyMaterialSchedule } from "@/lib/company-material";

// Lets Input Persediaan Akhir auto-fill "Nilai Persediaan Akhir" for the
// Bahan Baku category from Tabel SKU's own Account Summary — Saldo grand
// "TOTAL" row (Total Saldo Akhir) — the overall stock-akhir figure, not
// broken down per account. The other 4 categories aren't covered — the
// form keeps manual entry for those.
export async function GET(request: Request) {
  const { user, response } = await requirePermission("finance:view_ledger");
  if (!user) return response!;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  if (!year || !month) {
    return NextResponse.json({ error: "year, month required" }, { status: 400 });
  }

  const { accountSummary } = await getCompanyMaterialSchedule(year, month);
  const total = accountSummary.find((a) => a.label === "TOTAL")?.totalNilaiAkhir ?? 0;

  return NextResponse.json({ BAHAN_BAKU: total });
}
