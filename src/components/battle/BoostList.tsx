import { STAT_NAMES } from "../../battle/formatBattleLine";

/** Display order for stat stages; accuracy/evasion rarely change but are included for completeness. */
const STAT_ORDER = ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"];

export interface BoostListProps {
  /** Stat stage (-6..6) by short stat key (atk, def, spa, spd, spe, accuracy, evasion). Omitted/zero stats aren't shown. */
  boosts: Record<string, number>;
}

/** Renders each non-zero stat stage as e.g. "Speed ^2" (raised) or "Attack -" (lowered one stage). */
export function BoostList({ boosts }: BoostListProps) {
  const entries = STAT_ORDER.map((stat) => ({ stat, value: boosts[stat] ?? 0 })).filter((entry) => entry.value !== 0);
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-bold min-[600px]:text-xs">
      {entries.map(({ stat, value }) => {
        const magnitude = Math.abs(value);
        const symbol = value > 0 ? "^" : "-";
        return (
          <span key={stat} className={value > 0 ? "text-green-600" : "text-red-600"}>
            {STAT_NAMES[stat] ?? stat} {symbol}
            {magnitude > 1 ? magnitude : ""}
          </span>
        );
      })}
    </div>
  );
}
