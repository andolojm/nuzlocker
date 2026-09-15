import { Dex } from "@pkmn/sim";
import type { StatusCode } from "../formatBattleLine";
import { estimatedStat } from "./statMath";
import type { Combatant, FieldConditions, StatKey } from "./types";

export type MoveData = ReturnType<typeof Dex.moves.get>;

/** Stand-in base power for a damaging move whose power the Dex reports as 0/variable (Seismic Toss, Gyro Ball, Return, ...). */
export const NO_POWER_MOVE_BASELINE = 60;
/** Mid-range damage roll — the scoring here is a heuristic, not an exact Showdown roll. */
export const AVERAGE_DAMAGE_ROLL = 0.925;

const STAB_DOUBLING_ABILITIES = new Set(["Adaptability"]);

/** STAB multiplier once we already know the move's type matches the attacker's — 2x for Adaptability, the usual 1.5x otherwise. */
export function abilityStabMultiplier(ability: string | undefined): number {
  return ability !== undefined && STAB_DOUBLING_ABILITIES.has(ability) ? 2 : 1.5;
}

export function abilityPowerMultiplier(ability: string | undefined, basePower: number): number {
  return ability === "Technician" && basePower > 0 && basePower <= 60 ? 1.5 : 1;
}

export function abilityOffenseStatMultiplier(ability: string | undefined, category: string): number {
  return category === "Physical" && (ability === "Huge Power" || ability === "Pure Power") ? 2 : 1;
}

export function abilityStatusAttackMultiplier(ability: string | undefined, status: StatusCode | null): number {
  return ability === "Guts" && status !== null ? 1.5 : 1;
}

export function burnMultiplier(category: string, status: StatusCode | null, ability: string | undefined): number {
  if (category !== "Physical" || status !== "brn" || ability === "Guts") return 1;
  return 0.5;
}

/** Common, high-value type-immunity abilities only — not exhaustive. */
const ABILITY_TYPE_IMMUNITY: Record<string, string> = {
  Levitate: "Ground",
  "Flash Fire": "Fire",
  "Water Absorb": "Water",
  "Volt Absorb": "Electric",
  "Storm Drain": "Water",
  "Lightning Rod": "Electric",
  "Motor Drive": "Electric",
  "Sap Sipper": "Grass",
  "Dry Skin": "Water",
};

export function isImmuneViaAbility(moveType: string, ability: string | undefined): boolean {
  return ability !== undefined && ABILITY_TYPE_IMMUNITY[ability] === moveType;
}

const WEATHER_BOOSTED_TYPE: Record<string, string> = { RainDance: "Water", SunnyDay: "Fire" };
const WEATHER_WEAKENED_TYPE: Record<string, string> = { RainDance: "Fire", SunnyDay: "Water" };

export function weatherMultiplier(moveType: string, weather: string | null): number {
  if (!weather) return 1;
  if (WEATHER_BOOSTED_TYPE[weather] === moveType) return 1.5;
  if (WEATHER_WEAKENED_TYPE[weather] === moveType) return 0.5;
  return 1;
}

const TERRAIN_BOOSTED_TYPE: Record<string, string> = {
  "Electric Terrain": "Electric",
  "Grassy Terrain": "Grass",
  "Psychic Terrain": "Psychic",
};

export function terrainMultiplier(moveType: string, terrain: string | null): number {
  if (!terrain) return 1;
  if (terrain === "Misty Terrain" && moveType === "Dragon") return 0.5;
  // Real terrain boosts only apply to a grounded attacker (Flying-type/Levitate/etc. don't get
  // them) — grounding isn't tracked here, so this assumes the attacker is grounded.
  return TERRAIN_BOOSTED_TYPE[terrain] === moveType ? 1.3 : 1;
}

export function averageHits(multihit: number | number[] | undefined): number {
  if (multihit === undefined) return 1;
  if (typeof multihit === "number") return multihit;
  const [min, max] = multihit;
  if (min === 2 && max === 5) return 3.1; // standard 35/35/15/15 hit-count distribution
  return (min + max) / 2;
}

export function recoilFraction(moveData: MoveData): number {
  return moveData.recoil ? moveData.recoil[0] / moveData.recoil[1] : 0;
}

export function drainFraction(moveData: MoveData): number {
  return moveData.drain ? moveData.drain[0] / moveData.drain[1] : 0;
}

export function healFraction(moveData: MoveData): number {
  return moveData.heal ? moveData.heal[0] / moveData.heal[1] : 0;
}

export function baseDamage(level: number, power: number, attackStat: number, defenseStat: number): number {
  return (((2 * level) / 5 + 2) * power * (attackStat / Math.max(defenseStat, 1))) / 50 + 2;
}

/** The only fields of a move that actually feed the damage formula — lets a caller price a hypothetical move (an unrevealed attack the player might have) without a Dex entry. */
export interface DamageSpec {
  type: string;
  category: string;
  basePower: number;
  multihit?: number | number[];
}

/** Estimated raw damage (HP points), not a percentage — this is a scoring heuristic, not an exact Showdown damage roll. */
export function computeRawDamage(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
): number {
  return computeSpecDamage(moveData, attacker, defender, field);
}

/** computeRawDamage over a bare {type, category, basePower} spec rather than a full Dex move. */
export function computeSpecDamage(
  spec: DamageSpec,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
): number {
  const isPhysical = spec.category === "Physical";
  const atkKey: StatKey = isPhysical ? "atk" : "spa";
  const defKey: StatKey = isPhysical ? "def" : "spd";

  const attackStat =
    estimatedStat(attacker, atkKey) *
    abilityOffenseStatMultiplier(attacker.ability, spec.category) *
    abilityStatusAttackMultiplier(attacker.ability, attacker.status) *
    burnMultiplier(spec.category, attacker.status, attacker.ability);
  const defenseStat = estimatedStat(defender, defKey);

  const power =
    (spec.basePower || NO_POWER_MOVE_BASELINE) *
    abilityPowerMultiplier(attacker.ability, spec.basePower) *
    averageHits(spec.multihit);

  const stab = attacker.types.includes(spec.type) ? abilityStabMultiplier(attacker.ability) : 1;
  const typeMultiplier = isImmuneViaAbility(spec.type, defender.ability)
    ? 0
    : Math.pow(2, Dex.getEffectiveness(spec.type, defender.types));

  return (
    baseDamage(attacker.level, power, attackStat, defenseStat) *
    stab *
    typeMultiplier *
    weatherMultiplier(spec.type, field.weather) *
    terrainMultiplier(spec.type, field.terrain) *
    AVERAGE_DAMAGE_ROLL
  );
}
