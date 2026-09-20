import { calculateStat } from "../../engine/stats";
import type { StatusCode } from "../formatBattleLine";
import type { Combatant, SpeedComparison, StatKey, StatTable } from "./types";
import { clampBoost } from "./types";

export function estimatedStatRange(
  baseStats: StatTable,
  ivs: StatTable | undefined,
  level: number,
  key: StatKey,
): { min: number; max: number } {
  const isHp = key === "hp";
  if (ivs) {
    const value = calculateStat(baseStats[key], ivs[key], level, isHp);
    return { min: value, max: value };
  }
  return {
    min: calculateStat(baseStats[key], 0, level, isHp),
    max: calculateStat(baseStats[key], 31, level, isHp),
  };
}

export function statStageMultiplier(stage: number): number {
  const clamped = clampBoost(stage);
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

export function accuracyStageMultiplier(stage: number): number {
  const clamped = clampBoost(stage);
  return clamped >= 0 ? (3 + clamped) / 3 : 3 / (3 - clamped);
}

/**
 * How a stat's boost stage is read. "normal" uses it as-is; a critical hit ignores the stages that
 * would work against the attacker, so it reads offensive stats with negatives clamped away and
 * defensive stats with positives clamped away.
 */
export type BoostReading = "normal" | "critAttack" | "critDefense";

function readBoostStage(stage: number, reading: BoostReading): number {
  if (reading === "critAttack") return Math.max(stage, 0);
  if (reading === "critDefense") return Math.min(stage, 0);
  return stage;
}

/** Best single-value estimate of a stat: exact when IVs are known, otherwise the midpoint of the 0..31 IV range. */
export function estimatedStat(combatant: Combatant, key: StatKey, reading: BoostReading = "normal"): number {
  const { min, max } = estimatedStatRange(combatant.baseStats, combatant.ivs, combatant.level, key);
  const midpoint = (min + max) / 2;
  if (key === "hp") return midpoint;
  return midpoint * statStageMultiplier(readBoostStage(combatant.boosts[key] ?? 0, reading));
}

export function paralysisSpeedMultiplier(status: StatusCode | null): number {
  return status === "par" ? 0.5 : 1;
}

/** Compares true Speed (stat stages, paralysis included) between the two sides. "range" covers both a tie and any case where the defender's unknown IVs could put it on either side of the attacker. */
export function compareSpeed(attacker: Combatant, defender: Combatant): SpeedComparison {
  const attackerRange = estimatedStatRange(attacker.baseStats, attacker.ivs, attacker.level, "spe");
  const defenderRange = estimatedStatRange(defender.baseStats, defender.ivs, defender.level, "spe");

  const attackerMultiplier = statStageMultiplier(attacker.boosts.spe ?? 0) * paralysisSpeedMultiplier(attacker.status);
  const defenderMultiplier = statStageMultiplier(defender.boosts.spe ?? 0) * paralysisSpeedMultiplier(defender.status);

  const attackerMin = attackerRange.min * attackerMultiplier;
  const attackerMax = attackerRange.max * attackerMultiplier;
  const defenderMin = defenderRange.min * defenderMultiplier;
  const defenderMax = defenderRange.max * defenderMultiplier;

  if (attackerMin > defenderMax) return "win";
  if (attackerMax < defenderMin) return "lose";
  return "range";
}
