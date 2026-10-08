import { redirect } from "next/navigation";

// Merged into /finance/adjustment (single "Adjustment" menu covering
// Persediaan, Jurnal Penyesuaian, Fixed Asset, Buku Hutang Vendor, and
// Buku Piutang on one scrollable sheet) — kept as a redirect so old
// links/bookmarks still land somewhere useful.
export default function VendorPayableRedirect() {
  redirect("/finance/adjustment#adj-vendor-payable");
}
