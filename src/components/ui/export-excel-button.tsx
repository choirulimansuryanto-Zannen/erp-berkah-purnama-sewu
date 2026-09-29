"use client";

import { useState } from "react";
import { Download } from "lucide-react";

// Backs up/prints any Laporan Outlet sheet as a real .xlsx — reads
// whatever <table> elements are inside the given container (each table
// becomes its own worksheet, named from its data-sheet-name attribute)
// rather than needing a hand-marshaled data shape per sheet, so it works
// uniformly across every sheet regardless of how many tables it has.
export function ExportExcelButton({ containerId, filename }: { containerId: string; filename: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setPending(true);
    setError(null);
    try {
      const container = document.getElementById(containerId);
      if (!container) throw new Error("Konten sheet tidak ditemukan.");
      const tables = Array.from(container.querySelectorAll("table"));
      if (tables.length === 0) throw new Error("Tidak ada tabel untuk diekspor.");

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Berkah Purnama Sewu ERP";
      workbook.created = new Date();

      tables.forEach((table, i) => {
        const rawName = table.getAttribute("data-sheet-name") || `Sheet${i + 1}`;
        const name = rawName.replace(/[[\]*/\\?:]/g, "").slice(0, 31) || `Sheet${i + 1}`;
        const worksheet = workbook.addWorksheet(name);
        const rows = Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => cell.innerText.trim()));
        worksheet.addRows(rows);
        worksheet.columns.forEach((col) => {
          let maxLen = 10;
          col.eachCell?.({ includeEmpty: true }, (cell) => {
            const len = String(cell.value ?? "").length;
            if (len > maxLen) maxLen = len;
          });
          col.width = Math.min(maxLen + 2, 40);
        });
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengekspor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={pending}
        title="Export ke Excel (.xlsx) untuk backup/print"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" />
        {pending ? "Mengekspor..." : "Export Excel"}
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
