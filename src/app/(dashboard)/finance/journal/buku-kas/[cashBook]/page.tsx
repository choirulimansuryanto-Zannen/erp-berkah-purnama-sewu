import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BukuKasHeaderCard } from "@/components/finance/buku-kas-header-card";
import { getBukuKasHeaderData } from "@/lib/buku-kas-header";
import { CASH_BOOK_LABELS } from "@/lib/accounting";
import type { CashBook } from "@prisma/client";

const CASH_BOOKS = Object.keys(CASH_BOOK_LABELS) as CashBook[];
const MONTH_LABELS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Replicates the header block the business already uses on its own
// Excel ledger sheets — requested 2026-10-13 right after the
// Excel-import workflow went live, as a printable per-Buku-Kas summary
// (the same card also appears inline on the Jurnal page itself when one
// Buku Kas is filtered — see BukuKasHeaderCard).
export default async function BukuKasHeaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ cashBook: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!can(user.role, "finance:view_ledger")) redirect("/dashboard");

  const { cashBook: cashBookParam } = await params;
  if (!(CASH_BOOKS as string[]).includes(cashBookParam)) notFound();
  const cashBook = cashBookParam as CashBook;

  const now = new Date();
  const { month: monthParam, year: yearParam } = await searchParams;
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();

  const data = await getBukuKasHeaderData(cashBook, month, year);
  if (!data) notFound();

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Buku Kas — ${CASH_BOOK_LABELS[cashBook]}`}
        description="Header ringkasan buku kas: saldo awal, mutasi debit/kredit, dan saldo akhir untuk periode yang dipilih."
        actions={
          <Link href="/finance/journal" className="text-xs font-semibold text-accent-700 hover:text-accent-800">
            ← Kembali ke Jurnal
          </Link>
        }
      />

      <Card>
        <form className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label className="text-[11px]">Bulan</Label>
            <Select name="month" defaultValue={String(month)} className="mt-1">
              {MONTH_LABELS_ID.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Tahun</Label>
            <Select name="year" defaultValue={String(year)} className="mt-1">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            Tampilkan
          </Button>
        </form>
      </Card>

      <BukuKasHeaderCard data={data} month={month} year={year} />
    </div>
  );
}
