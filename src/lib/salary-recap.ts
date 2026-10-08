import { prisma } from "@/lib/prisma";

// Rekap Salary — one monthly payroll recap row per department. TOTAL
// (aktual) is DERIVED here (sum of all 7 line items), never stored —
// verified against the source: each department's printed total is
// exactly the sum of its own 7 figures, not a net-of-deductions figure.
export const SALARY_RECAP_DEPARTMENT_LABELS: Record<string, string> = {
  BOD: "BOD",
  PRODUCTION: "PRODUCTION",
  OPERATION: "OPERATION",
  SALES_OFFICE: "SALES OFFICE",
  SALES_OUTLET: "SALES OUTLET",
  MARKETING: "MARKETING",
  FA: "FA",
  HR_GA: "HR & GA",
};
export const SALARY_RECAP_DEPARTMENT_ORDER = ["BOD", "PRODUCTION", "OPERATION", "SALES_OFFICE", "SALES_OUTLET", "MARKETING", "FA", "HR_GA"] as const;

const LINE_ITEMS = ["totalTerimaNet", "koperasi", "iuranBpjs", "kasbon", "pph21", "adjLain", "sanksi", "insentifTjOutlet"] as const;
export type SalaryRecapLineItem = (typeof LINE_ITEMS)[number];
export const SALARY_RECAP_LINE_LABELS: Record<SalaryRecapLineItem, string> = {
  totalTerimaNet: "Total Terima (NET)",
  koperasi: "KOPERASI",
  iuranBpjs: "Iuran BPJS",
  kasbon: "Kasbon",
  pph21: "PPh21",
  adjLain: "ADJ Lain",
  sanksi: "Sanksi",
  insentifTjOutlet: "Insentive&Tj.Outlet",
};

export type SalaryRecapColumn = {
  department: string;
  label: string;
  values: Record<SalaryRecapLineItem, number>;
  total: number;
};

export async function getSalaryRecap(year: number, month: number) {
  const rows = await prisma.salaryRecap.findMany({ where: { year, month } });
  const byDept = new Map(rows.map((r) => [r.department, r]));

  const columns: SalaryRecapColumn[] = SALARY_RECAP_DEPARTMENT_ORDER.map((dept) => {
    const r = byDept.get(dept);
    const values = Object.fromEntries(LINE_ITEMS.map((k) => [k, Number(r?.[k] ?? 0)])) as Record<SalaryRecapLineItem, number>;
    const total = LINE_ITEMS.reduce((s, k) => s + values[k], 0);
    return { department: dept, label: SALARY_RECAP_DEPARTMENT_LABELS[dept], values, total };
  });

  const rowTotals = Object.fromEntries(
    LINE_ITEMS.map((k) => [k, columns.reduce((s, c) => s + c.values[k], 0)]),
  ) as Record<SalaryRecapLineItem, number>;
  const grandTotal = columns.reduce((s, c) => s + c.total, 0);

  return { columns, rowTotals, grandTotal };
}
