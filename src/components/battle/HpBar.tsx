export interface HpBarProps {
  current: number;
  max: number;
  /** Use lighter label/track colors for placement on a dark background. */
  dark?: boolean;
}

function hpBarColor(fraction: number): string {
  if (fraction > 0.5) return "bg-green-500";
  if (fraction > 0.2) return "bg-yellow-400";
  return "bg-red-500";
}

export function HpBar({ current, max, dark = false }: HpBarProps) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

  return (
    <div className="flex items-center gap-1">
      <span className={`text-[10px] font-bold italic ${dark ? "text-slate-300" : "text-slate-700"}`}>HP</span>
      <div className={`h-1.5 flex-1 rounded-full ${dark ? "bg-slate-900/50" : "bg-slate-800/20"}`}>
        <div className={`h-1.5 rounded-full ${hpBarColor(fraction)}`} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
