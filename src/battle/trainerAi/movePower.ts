import { Dex } from "@pkmn/sim";
import type { DamageSpec, MoveData } from "./damageMath";
import { estimatedStat } from "./statMath";
import type { Combatant, FieldConditions } from "./types";

/*
 * Moves whose base power (or type) is a function of battle state rather than a constant. Without
 * this, every one of them falls back to damageMath's flat NO_POWER_MOVE_BASELINE, which is off by
 * a factor of six at the extremes: Eruption from a healthy user is 150, Gyro Ball from a slow one
 * against a fast target is 150, and both were being priced at 60.
 */

/** Crit chance by Showdown's critRatio (gen 6+ tiers): 1/24, 1/8, 1/2, then guaranteed. */
const CRIT_CHANCE_BY_RATIO = [0, 1 / 24, 1 / 8, 1 / 2, 1];
/** Abilities that make the holder immune to critical hits. */
const CRIT_IMMUNE_ABILITIES = new Set(["Battle Armor", "Shell Armor"]);

export function critChanceFor(moveData: MoveData, defender: Combatant): number {
  if (defender.ability !== undefined && CRIT_IMMUNE_ABILITIES.has(defender.ability)) return 0;
  if (moveData.willCrit) return 1;
  const ratio = Math.max(1, Math.min(CRIT_CHANCE_BY_RATIO.length - 1, moveData.critRatio ?? 1));
  return CRIT_CHANCE_BY_RATIO[ratio];
}

function speciesWeightKg(combatant: Combatant): number | null {
  if (!combatant.species) return null;
  const species = Dex.species.get(combatant.species);
  return species.exists && species.weightkg > 0 ? species.weightkg : null;
}

/** Low Kick / Grass Knot's weight table. */
function weightBasedPower(weightKg: number): number {
  if (weightKg >= 200) return 120;
  if (weightKg >= 100) return 100;
  if (weightKg >= 50) return 80;
  if (weightKg >= 25) return 60;
  if (weightKg >= 10) return 40;
  return 20;
}

/** Heavy Slam / Heat Crash scale on how much heavier the user is than the target. */
function weightRatioPower(attackerKg: number, defenderKg: number): number {
  const ratio = attackerKg / Math.max(defenderKg, 0.1);
  if (ratio >= 5) return 120;
  if (ratio >= 4) return 100;
  if (ratio >= 3) return 80;
  if (ratio >= 2) return 60;
  return 40;
}

/** Flail / Reversal's HP table, sharply rewarding a nearly-fainted user. */
function flailPower(hpFraction: number) {
  const scaled = hpFraction * 48;
  if (scaled < 2) return 200;
  if (scaled < 5) return 150;
  if (scaled < 10) return 100;
  if (scaled < 17) return 80;
  if (scaled < 33) return 40;
  return 20;
}

/** Electro Ball's power rides on the speed ratio the same way Gyro Ball's rides on its inverse. */
function electroBallPower(ratio: number): number {
  if (ratio >= 4) return 150;
  if (ratio >= 3) return 120;
  if (ratio >= 2) return 80;
  if (ratio > 1) return 60;
  return 40;
}

const WEATHER_BALL_TYPE: Record<string, string> = {
  RainDance: "Water",
  SunnyDay: "Fire",
  Sandstorm: "Rock",
  Hail: "Ice",
  Snow: "Ice",
};

function countPositiveBoosts(combatant: Combatant): number {
  let total = 0;
  for (const stage of Object.values(combatant.boosts)) if (stage > 0) total += stage;
  return total;
}

export interface SpecContext {
  /** Whether the attacker is expected to move before the defender this turn (Payback's condition, inverted). */
  movesFirst?: boolean;
}

/**
 * The move's real base power and type on the current board. Returns the Dex values untouched for
 * the overwhelming majority of moves; only the state-dependent ones are recomputed.
 */
export function resolveBasePower(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
  context: SpecContext = {},
): { basePower: number; type: string } {
  const type = moveData.id === "weatherball" ? (WEATHER_BALL_TYPE[field.weather ?? ""] ?? "Normal") : moveData.type;
  const attackerHpFraction = attacker.currentHp / Math.max(attacker.maxHp, 1);
  const defenderHpFraction = defender.currentHp / Math.max(defender.maxHp, 1);

  switch (moveData.id) {
    case "gyroball": {
      const ratio = estimatedStat(defender, "spe") / Math.max(estimatedStat(attacker, "spe"), 1);
      return { basePower: Math.min(150, Math.max(1, Math.floor(25 * ratio))), type };
    }
    case "electroball": {
      const ratio = estimatedStat(attacker, "spe") / Math.max(estimatedStat(defender, "spe"), 1);
      return { basePower: electroBallPower(ratio), type };
    }
    case "lowkick":
    case "grassknot": {
      const weight = speciesWeightKg(defender);
      return { basePower: weight === null ? moveData.basePower : weightBasedPower(weight), type };
    }
    case "heavyslam":
    case "heatcrash": {
      const attackerKg = speciesWeightKg(attacker);
      const defenderKg = speciesWeightKg(defender);
      if (attackerKg === null || defenderKg === null) return { basePower: moveData.basePower, type };
      return { basePower: weightRatioPower(attackerKg, defenderKg), type };
    }
    case "eruption":
    case "waterspout":
    case "dragonenergy":
      return { basePower: Math.max(1, Math.floor(150 * attackerHpFraction)), type };
    case "flail":
    case "reversal":
      return { basePower: flailPower(attackerHpFraction), type };
    case "crushgrip":
    case "wringout":
      return { basePower: Math.max(1, Math.floor(120 * defenderHpFraction)), type };
    case "brine":
      return { basePower: defenderHpFraction <= 0.5 ? 130 : 65, type };
    case "facade":
      return { basePower: attacker.status !== null ? 140 : 70, type };
    case "hex":
      return { basePower: defender.status !== null ? 130 : 65, type };
    case "venoshock":
      return { basePower: defender.status === "psn" || defender.status === "tox" ? 130 : 65, type };
    case "wakeupslap":
      return { basePower: defender.status === "slp" ? 140 : 70, type };
    case "smellingsalts":
      return { basePower: defender.status === "par" ? 140 : 70, type };
    case "payback":
      // Doubles when the user moves last, which is exactly when it is otherwise least attractive.
      return { basePower: context.movesFirst === false ? 100 : 50, type };
    case "storedpower":
    case "powertrip":
      return { basePower: 20 + 20 * countPositiveBoosts(attacker), type };
    case "punishment":
      return { basePower: Math.min(200, 60 + 20 * countPositiveBoosts(defender)), type };
    case "magnitude":
      return { basePower: 71, type }; // probability-weighted average of magnitudes 4-10
    case "return":
    case "frustration":
      // Happiness isn't modeled anywhere in this app, so both sit at their mid-friendship power.
      return { basePower: 102, type };
    case "weatherball":
      return { basePower: field.weather === null ? 50 : 100, type };
    case "solarbeam":
    case "solarblade":
      // Halved in any weather that isn't sun (the charge turn itself is priced separately).
      return { basePower: field.weather !== null && field.weather !== "SunnyDay" ? 60 : 120, type };
    default:
      return { basePower: moveData.basePower, type };
  }
}

/** A DamageSpec for this move on this board: resolved power and type, plus its crit chance. */
export function resolveDamageSpec(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
  context: SpecContext = {},
): DamageSpec {
  const { basePower, type } = resolveBasePower(moveData, attacker, defender, field, context);
  return {
    type,
    category: moveData.category,
    basePower,
    multihit: moveData.multihit ?? undefined,
    critChance: critChanceFor(moveData, defender),
  };
}
