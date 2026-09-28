// Matches the channel color-coding already established on the POS terminal
// (src/components/pos/pos-terminal.tsx) so a channel reads as the same
// color everywhere in the app — the chart bars, the table cells, and these
// badges.
export const CHANNEL_COLORS: Record<string, string> = {
  CASH: "#059669",
  CASHLESS: "#2563eb",
  GRAB: "#0d9488",
  GOFOOD: "#16a34a",
  SHOPEE: "#f97316",
  QPON: "#7c3aed",
  TIKTOK: "#0f172a",
};

export const CHANNEL_LABELS: Record<string, string> = {
  CASH: "CASH",
  CASHLESS: "CASHLESS",
  GRAB: "GRABFOOD",
  GOFOOD: "GOFOOD",
  SHOPEE: "SHOPEEFOOD",
  QPON: "QPON",
  TIKTOK: "TIKTOK",
};

// A badge tinted to the channel's own color, matching the chart bar next to
// it — the shared Badge component's fixed "brand" tone would look
// inconsistent sitting beside a differently-colored bar for the same row.
export function ChannelBadge({ channel }: { channel: string }) {
  const color = CHANNEL_COLORS[channel] ?? "#64748b";
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}
    >
      {CHANNEL_LABELS[channel] ?? channel}
    </span>
  );
}
