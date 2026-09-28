import { cn } from "@/lib/cn";

type Props = {
  size?: number;
  animated?: boolean;
  className?: string;
};

/**
 * The BPS mark: a badge in the "letter-box" style of the firms that inspired
 * this redesign (EY, PwC, KPMG) — bold monogram, deep red gradient, a thin
 * gold ring for the premium touch, white type for contrast.
 */
export function BpsLogo({ size = 36, animated = false, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="BPS"
      className={cn(animated && "animate-logo-in", className)}
    >
      <defs>
        <linearGradient id="bps-badge" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c22a2a" />
          <stop offset="55%" stopColor="#7a1a1a" />
          <stop offset="100%" stopColor="#330b0b" />
        </linearGradient>
        <linearGradient id="bps-ring" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fdc321" />
          <stop offset="100%" stopColor="#a87400" />
        </linearGradient>
      </defs>

      <rect x="1.25" y="1.25" width="37.5" height="37.5" rx="10" fill="url(#bps-badge)" />
      <rect
        x="1.25"
        y="1.25"
        width="37.5"
        height="37.5"
        rx="10"
        fill="none"
        stroke="url(#bps-ring)"
        strokeWidth="1.4"
        opacity="0.9"
      />

      <text
        x="20"
        y="23.5"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="13.5"
        letterSpacing="0.5"
        fill="#ffffff"
      >
        BPS
      </text>

      <rect x="12.5" y="27" width="15" height="1.8" rx="0.9" fill="#fdc321" opacity="0.95" />
    </svg>
  );
}
