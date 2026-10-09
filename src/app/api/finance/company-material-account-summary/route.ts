import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-guard";
import { getCompanyMaterialSchedule } from "@/lib/company-material";

// Lets Input Persediaan Akhir auto-fill "Nilai Persediaan Akhir" from
// Tabel SKU's own Account Summary — Saldo "Total Saldo Akhir" figures,
// for the handful of InventoryClosing categories that have an exact
// match there, instead of re-typing a number the Tabel SKU already
// computed. Categories without a clean match (Bahan Setengah Jadi,
// Proyek Dalam Penyelesaian) aren't covered — the form keeps manual
// entry for those.
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
  const find = (label: string) => accountSummary.find((a) => a.label === label)?.totalNilaiAkhir ?? 0;

  // "Bahan Baku" = both Bahan Baku AB and Bahan Baku AD rows combined —
  // the two account-summary lines literally named "Bahan Baku *".
  const BAHAN_BAKU = find("Bahan Baku AB") + find("Bahan Baku AD");
  const BAHAN_PENDUKUNG = find("Bahan Pendukung AB");
  const BARANG_JADI = find("Barang Jadi AD");

  return NextResponse.json({ BAHAN_BAKU, BAHAN_PENDUKUNG, BARANG_JADI });
}
