import type { Move } from "./pikaserve";

/** Level at which the power cap bottoms out. */
const MIN_LEVEL = 1;
/** Level at which the power cap reaches (and thereafter stays at) its ceiling. */
const MAX_LEVEL = 44;
const MIN_MAX_POWER = 40;
const MAX_MAX_POWER = 150;

/** Full-power moves that don't fit the level scale (they cost the user its own HP/faint either
 * way), so they're learnable at any level regardless of the cap. */
const POWER_CAP_EXEMPT_MOVE_NAMES = new Set(["Self-Destruct", "Explosion", "Misty Explosion"]);

/** Linearly scales from 40 power at level 1 to 150 power at level 44; flat at 150 beyond that. */
export function maxMovePowerForLevel(level: number): number {
  const clampedLevel = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
  const t = (clampedLevel - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL);
  return MIN_MAX_POWER + t * (MAX_MAX_POWER - MIN_MAX_POWER);
}

/** The vendored data's power field sometimes carries a trailing "*" footnote (e.g. "60*");
 * parseFloat tolerates that. Non-numeric power (status moves, and fixed/variable-damage moves
 * like Counter or Seismic Toss) has nothing to compare against the cap, so those are always allowed. */
function numericPower(move: Pick<Move, "power">): number | null {
  const value = parseFloat(move.power);
  return Number.isFinite(value) ? value : null;
}

/** Whether `move` can be rolled for a Pokemon of `level`, per the power-vs-level cap. */
export function isMoveAllowedAtLevel(move: Pick<Move, "power" | "name">, level: number): boolean {
  if (POWER_CAP_EXEMPT_MOVE_NAMES.has(move.name.english)) return true;
  const power = numericPower(move);
  return power === null || power <= maxMovePowerForLevel(level);
}
