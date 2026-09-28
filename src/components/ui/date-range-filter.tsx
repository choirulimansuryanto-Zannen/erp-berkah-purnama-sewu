import { Label, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// Plain GET <form> with no client JS — submitting it navigates the current
// page to `?from=...&to=...` via the browser's own form handling, same
// pattern already used on Riwayat Transaksi.
export function DateRangeFilter({ from, to }: { from: string; to: string }) {
  return (
    <form className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor="from">Dari Tanggal</Label>
        <Input id="from" type="date" name="from" defaultValue={from} max={todayStr()} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="to">Sampai Tanggal</Label>
        <Input id="to" type="date" name="to" defaultValue={to} max={todayStr()} className="mt-1" />
      </div>
      <Button type="submit" variant="secondary">
        Tampilkan
      </Button>
    </form>
  );
}
