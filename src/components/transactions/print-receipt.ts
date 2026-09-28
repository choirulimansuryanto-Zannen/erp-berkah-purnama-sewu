import { trxCode, type TransactionRow } from "@/components/transactions/types";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Opens a dedicated print-only window rather than printing the app page
// itself — avoids needing any print-media CSS in the main app to hide the
// rest of the UI, and matches how thermal-receipt printing normally works
// on the web (a plain, self-contained document that just gets sent to the
// printer / saved as PDF).
export function printReceipt(t: TransactionRow) {
  const time = new Date(t.time);
  const dateStr = time.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const itemsHtml = t.items
    .map((item) => {
      const toppingsHtml = item.toppings
        .map(
          (tp) => `<div class="row topping"><span>+ ${escapeHtml(tp.toppingName)} &times; ${tp.qty}</span><span>${currency.format(tp.unitPrice * tp.qty)}</span></div>`,
        )
        .join("");
      return `
        <div class="row"><span>${escapeHtml(item.productName)} &times; ${item.qty}</span><span>${currency.format(item.unitPrice * item.qty)}</span></div>
        ${toppingsHtml}
      `;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${trxCode(t.id)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #111; margin: 0; padding: 16px; }
  .receipt { max-width: 300px; margin: 0 auto; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #999; margin: 8px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .topping { padding-left: 10px; color: #555; }
  .total { font-size: 14px; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="bold" style="font-size:14px;">${escapeHtml(t.outletName)}</div>
      <div>PT Berkah Purnama Sewu</div>
    </div>
    <div class="divider"></div>
    <div class="row"><span>${trxCode(t.id)}</span><span>${escapeHtml(t.channel)}</span></div>
    <div class="row"><span>${dateStr}</span><span>${timeStr}</span></div>
    <div class="row"><span>Kasir</span><span>${escapeHtml(t.kasirName)}</span></div>
    ${t.memberName ? `<div class="row"><span>Member</span><span>${escapeHtml(t.memberName)}</span></div>` : ""}
    <div class="divider"></div>
    ${itemsHtml}
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><span>${currency.format(t.subtotal)}</span></div>
    ${t.discount > 0 ? `<div class="row"><span>Diskon</span><span>-${currency.format(t.discount)}</span></div>` : ""}
    <div class="row bold total"><span>TOTAL</span><span>${currency.format(t.total)}</span></div>
    <div class="divider"></div>
    <div class="center">Terima kasih atas kunjungan Anda</div>
  </div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=380,height=640");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
