import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Table({
  className,
  wrapperClassName,
  ...props
}: HTMLAttributes<HTMLTableElement> & { wrapperClassName?: string }) {
  // `wrapperClassName` lets a caller turn this into a bounded, independently
  // scrolling grid (max-h-* + overflow-y-auto) so its own <thead> can use a
  // plain `sticky top-0` to freeze — plain `position: sticky` on a header
  // INSIDE an unbounded overflow-x-auto div never actually freezes to the
  // viewport (CSS Overflow spec: any ancestor with overflow != visible on
  // either axis becomes the sticky containing block, not the page — and
  // this div's own overflow-x-auto already qualifies), it just scrolls away
  // like ordinary content. Bounding height + overflow-y-auto makes this div
  // a REAL scrolling container, which is what makes `sticky top-0` work.
  return (
    <div className={cn("overflow-x-auto", wrapperClassName)}>
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  // Solid (not translucent) background — several pages make this sticky
  // (finance report/ledger headers that freeze while scrolling), where a
  // translucent bg would let scrolled-under rows show through.
  return <thead className={cn("bg-slate-50 text-left", className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-t border-slate-100 hover:bg-slate-50/60", className)} {...props} />;
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-5 py-3 text-slate-700", className)} {...props} />;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
