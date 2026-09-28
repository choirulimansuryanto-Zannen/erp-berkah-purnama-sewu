import type { AchievementZone } from "@/lib/outlet-achievement";

export const ZONE_STYLES: Record<
  AchievementZone,
  { badge: string; dot: string; rowBorder: string; solid: string; label: string; onDark: string }
> = {
  HIJAU: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
    dot: "bg-emerald-500",
    rowBorder: "border-l-emerald-400",
    solid: "bg-emerald-500",
    label: "Zona Hijau",
    onDark: "text-emerald-300",
  },
  KUNING: {
    badge: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
    dot: "bg-amber-500",
    rowBorder: "border-l-amber-400",
    solid: "bg-amber-500",
    label: "Zona Kuning",
    onDark: "text-amber-300",
  },
  JINGGA: {
    badge: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
    dot: "bg-orange-500",
    rowBorder: "border-l-orange-400",
    solid: "bg-orange-500",
    label: "Zona Jingga",
    onDark: "text-orange-300",
  },
  MERAH: {
    badge: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
    dot: "bg-rose-500",
    rowBorder: "border-l-rose-400",
    solid: "bg-rose-500",
    label: "Zona Merah",
    onDark: "text-rose-300",
  },
  HITAM: {
    badge: "bg-slate-800 text-white ring-1 ring-inset ring-slate-700",
    dot: "bg-slate-800",
    rowBorder: "border-l-slate-700",
    solid: "bg-slate-800",
    label: "Zona Hitam",
    onDark: "text-slate-300",
  },
};
