import type { Pokemon } from "../api/pikaserve";
import type { StatusCode } from "../battle/formatBattleLine";

export interface CatchAttemptOptions {
  /** Ball catch-rate multiplier (Poké Ball = 1). Defaults to 1. */
  ballBonus?: number;
  /** Status condition multiplier (sleep/freeze = 2.5, paralyze/poison/burn = 1.5, none = 1). Defaults to 1. */
  statusBonus?: number;
  /** The wild Pokemon's current HP as a fraction of its max HP (0-1). Defaults to 1 (full health). */
  currentHpFraction?: number;
  /** Injectable RNG for deterministic testing. Must return a float in [0, 1). Defaults to Math.random. */
  random?: () => number;
}

export interface CatchAttemptResult {
  caught: boolean;
  /** How many of the 4 shake checks succeeded (4 always means caught). */
  shakes: number;
}

const TOTAL_SHAKE_CHECKS = 4;
const CERTAIN_CAPTURE_THRESHOLD = 255;
const SHAKE_ROLL_MAX = 65536;
// Distinct from SHAKE_ROLL_MAX: the shake-success threshold is computed from a separate constant
// (Gen III+ capture formula), not the roll range itself. Conflating the two made every shake ~16x
// less likely to succeed than intended — a 4-shake catch became ~1/65536 as likely as it should be.
const SHAKE_THRESHOLD_NUMERATOR = 1048560;

/** Gen III+ status catch-rate multipliers. `tox` counts as regular poison, same as the real games. */
const STATUS_CATCH_BONUS: Record<StatusCode, number> = {
  slp: 2.5,
  frz: 2.5,
  par: 1.5,
  psn: 1.5,
  tox: 1.5,
  brn: 1.5,
};

/** The catch-rate multiplier for the wild Pokemon's current status condition (1 if none). */
export function statusCatchBonus(status: StatusCode | null): number {
  return status ? STATUS_CATCH_BONUS[status] : 1;
}

export function attemptCatch(pokemon: Pokemon, options: CatchAttemptOptions = {}): CatchAttemptResult {
  const ballBonus = options.ballBonus ?? 1;
  const statusBonus = options.statusBonus ?? 1;
  const currentHpFraction = options.currentHpFraction ?? 1;
  const random = options.random ?? Math.random;

  const maxHp = pokemon.base.HP;
  const currentHp = maxHp * currentHpFraction;

  const modifiedCatchRate = Math.floor(
    (Math.floor(3 * maxHp - 2 * currentHp) * pokemon.catchRate * ballBonus * statusBonus) / (3 * maxHp),
  );

  if (modifiedCatchRate >= CERTAIN_CAPTURE_THRESHOLD) {
    return { caught: true, shakes: TOTAL_SHAKE_CHECKS };
  }

  const shakeThreshold = Math.floor(
    SHAKE_THRESHOLD_NUMERATOR / Math.floor(Math.sqrt(Math.sqrt(16711680 / modifiedCatchRate))),
  );

  let shakes = 0;
  for (let i = 0; i < TOTAL_SHAKE_CHECKS; i++) {
    if (Math.floor(random() * SHAKE_ROLL_MAX) >= shakeThreshold) break;
    shakes += 1;
  }

  return { caught: shakes === TOTAL_SHAKE_CHECKS, shakes };
}
