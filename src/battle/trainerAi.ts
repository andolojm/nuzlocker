import { Dex } from "@pkmn/sim";
import { calculateStat } from "../engine/stats";
import type { BattleRequest, MoveOption } from "./battleSimulator";
import type { StatusCode } from "./formatBattleLine";

type MoveData = ReturnType<typeof Dex.moves.get>;

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export interface StatTable {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/** Stat stage (-6..6) by short stat key (atk, def, spa, spd, spe, accuracy, evasion). Omitted/zero stats are unboosted. */
export type Boosts = Record<string, number>;

export function clampBoost(value: number): number {
  return Math.max(-6, Math.min(6, value));
}

/** Converts a base-stat-shaped object (species base stats, or an IV spread — same field names) to the short-key StatTable this module works with. */
export function toStatTable(stats: {
  HP: number;
  Attack: number;
  Defense: number;
  "Sp. Attack": number;
  "Sp. Defense": number;
  Speed: number;
}): StatTable {
  return {
    hp: stats.HP,
    atk: stats.Attack,
    def: stats.Defense,
    spa: stats["Sp. Attack"],
    spd: stats["Sp. Defense"],
    spe: stats.Speed,
  };
}

export interface Combatant {
  types: string[];
  level: number;
  /** Species base stats (no IVs/EVs baked in). */
  baseStats: StatTable;
  /**
   * Individual values, 0-31 per stat. Omit for a Pokemon whose true IVs the trainer AI has no way
   * to know (the human player's active Pokemon) — its real stats are then treated as a min..max
   * range (see `compareSpeed`) instead of an exact value.
   */
  ivs?: StatTable;
  boosts: Boosts;
  currentHp: number;
  maxHp: number;
  status: StatusCode | null;
  /** Own ability is always known; the opponent's is only known once revealed in battle. */
  ability?: string;
  /**
   * Moves this Pokemon is confirmed to know. Only ever populated for the human player's Pokemon,
   * restricted to moves already revealed in this battle — the AI's own moveset is already fully
   * available via `TrainerAiContext.request.moves`, so this field doesn't apply to it.
   */
  knownMoves?: string[];
}

export type SpeedComparison = "win" | "lose" | "range";

export interface HazardState {
  stealthRock: boolean;
  /** Layers, 0-3. */
  spikes: number;
  /** Layers, 0-2. */
  toxicSpikes: number;
  stickyWeb: boolean;
}

export const NO_HAZARDS: HazardState = { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false };

export interface FieldConditions {
  /** Raw Showdown weather id ("RainDance", "SunnyDay", "Sandstorm", "Hail", "Snow"), or null. */
  weather: string | null;
  /** Terrain name as Showdown reports it ("Electric Terrain", etc.), or null. */
  terrain: string | null;
  /** Entry hazards on the defender's side — the side the attacker's own hazard moves would affect. */
  defenderHazards: HazardState;
}

export interface TrainerAiContext {
  request: BattleRequest;
  /** The AI's own active Pokemon. */
  attacker: Combatant;
  /** The player's active Pokemon. */
  defender: Combatant;
  field: FieldConditions;
  /** Injectable for deterministic tests; defaults to Math.random. */
  rng?: () => number;
}

const STATUS_MOVE_BASELINE = 30;
const NO_POWER_MOVE_BASELINE = 60;
const JITTER_RANGE = 0.2;
const AVERAGE_DAMAGE_ROLL = 0.925;
const KO_BONUS = 40;
/** Applied to any move that's down to its last PP, to discourage burning a move's final charge when a similarly-good alternative exists. */
const LAST_PP_CONSERVATION_FACTOR = 0.7;
const DEBUFF_RELEVANCE_BONUS = 10;
/** Below this HP fraction, restoring HP is worth an extra flat bonus on top of the HP% it actually restores — survival matters more than the raw number once a KO is a real threat. */
const LOW_HP_THRESHOLD = 0.35;
const SURVIVAL_BONUS = 20;

function estimatedStatRange(
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

function statStageMultiplier(stage: number): number {
  const clamped = clampBoost(stage);
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

function accuracyStageMultiplier(stage: number): number {
  const clamped = clampBoost(stage);
  return clamped >= 0 ? (3 + clamped) / 3 : 3 / (3 - clamped);
}

/** Best single-value estimate of a stat: exact when IVs are known, otherwise the midpoint of the 0..31 IV range. */
function estimatedStat(combatant: Combatant, key: StatKey): number {
  const { min, max } = estimatedStatRange(combatant.baseStats, combatant.ivs, combatant.level, key);
  const midpoint = (min + max) / 2;
  if (key === "hp") return midpoint;
  return midpoint * statStageMultiplier(combatant.boosts[key] ?? 0);
}

function paralysisSpeedMultiplier(status: StatusCode | null): number {
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

const STAB_DOUBLING_ABILITIES = new Set(["Adaptability"]);

/** STAB multiplier once we already know the move's type matches the attacker's — 2x for Adaptability, the usual 1.5x otherwise. */
function abilityStabMultiplier(ability: string | undefined): number {
  return ability !== undefined && STAB_DOUBLING_ABILITIES.has(ability) ? 2 : 1.5;
}

function abilityPowerMultiplier(ability: string | undefined, basePower: number): number {
  return ability === "Technician" && basePower > 0 && basePower <= 60 ? 1.5 : 1;
}

function abilityOffenseStatMultiplier(ability: string | undefined, category: string): number {
  return category === "Physical" && (ability === "Huge Power" || ability === "Pure Power") ? 2 : 1;
}

function abilityStatusAttackMultiplier(ability: string | undefined, status: StatusCode | null): number {
  return ability === "Guts" && status !== null ? 1.5 : 1;
}

function burnMultiplier(category: string, status: StatusCode | null, ability: string | undefined): number {
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

function isImmuneViaAbility(moveType: string, ability: string | undefined): boolean {
  return ability !== undefined && ABILITY_TYPE_IMMUNITY[ability] === moveType;
}

const WEATHER_BOOSTED_TYPE: Record<string, string> = { RainDance: "Water", SunnyDay: "Fire" };
const WEATHER_WEAKENED_TYPE: Record<string, string> = { RainDance: "Fire", SunnyDay: "Water" };

function weatherMultiplier(moveType: string, weather: string | null): number {
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

function terrainMultiplier(moveType: string, terrain: string | null): number {
  if (!terrain) return 1;
  if (terrain === "Misty Terrain" && moveType === "Dragon") return 0.5;
  // Real terrain boosts only apply to a grounded attacker (Flying-type/Levitate/etc. don't get
  // them) — grounding isn't tracked here, so this assumes the attacker is grounded.
  return TERRAIN_BOOSTED_TYPE[terrain] === moveType ? 1.3 : 1;
}

function averageHits(multihit: number | number[] | undefined): number {
  if (multihit === undefined) return 1;
  if (typeof multihit === "number") return multihit;
  const [min, max] = multihit;
  if (min === 2 && max === 5) return 3.1; // standard 35/35/15/15 hit-count distribution
  return (min + max) / 2;
}

function recoilFraction(moveData: MoveData): number {
  return moveData.recoil ? moveData.recoil[0] / moveData.recoil[1] : 0;
}

function drainFraction(moveData: MoveData): number {
  return moveData.drain ? moveData.drain[0] / moveData.drain[1] : 0;
}

function healFraction(moveData: MoveData): number {
  return moveData.heal ? moveData.heal[0] / moveData.heal[1] : 0;
}

/** Whether a dedicated healing Status move (Recover, Roost, etc.) would just fail — already at full HP. */
function healingMoveWouldFail(moveData: MoveData, attacker: Combatant): boolean {
  return healFraction(moveData) > 0 && attacker.currentHp >= attacker.maxHp;
}

/** HP-aware value of a dedicated healing Status move: the %HP it actually restores, plus a survival bonus once the attacker is low enough that staying alive matters more than the raw amount. */
function healingMoveBonus(moveData: MoveData, attacker: Combatant): number {
  const fraction = healFraction(moveData);
  if (fraction <= 0) return 0;
  const missingHp = attacker.maxHp - attacker.currentHp;
  if (missingHp <= 0) return 0;
  const healedHp = Math.min(fraction * attacker.maxHp, missingHp);
  const restoredPercent = (healedHp / attacker.maxHp) * 100;
  const urgency = attacker.currentHp / attacker.maxHp <= LOW_HP_THRESHOLD ? SURVIVAL_BONUS : 0;
  return restoredPercent + urgency;
}

function baseDamage(level: number, power: number, attackStat: number, defenseStat: number): number {
  return (((2 * level) / 5 + 2) * power * (attackStat / Math.max(defenseStat, 1))) / 50 + 2;
}

/** Estimated raw damage (HP points), not a percentage — this is a scoring heuristic, not an exact Showdown damage roll. */
function computeRawDamage(moveData: MoveData, attacker: Combatant, defender: Combatant, field: FieldConditions): number {
  const isPhysical = moveData.category === "Physical";
  const atkKey: StatKey = isPhysical ? "atk" : "spa";
  const defKey: StatKey = isPhysical ? "def" : "spd";

  const attackStat =
    estimatedStat(attacker, atkKey) *
    abilityOffenseStatMultiplier(attacker.ability, moveData.category) *
    abilityStatusAttackMultiplier(attacker.ability, attacker.status) *
    burnMultiplier(moveData.category, attacker.status, attacker.ability);
  const defenseStat = estimatedStat(defender, defKey);

  const power =
    (moveData.basePower || NO_POWER_MOVE_BASELINE) *
    abilityPowerMultiplier(attacker.ability, moveData.basePower) *
    averageHits(moveData.multihit);

  const stab = attacker.types.includes(moveData.type) ? abilityStabMultiplier(attacker.ability) : 1;
  const typeMultiplier = isImmuneViaAbility(moveData.type, defender.ability)
    ? 0
    : Math.pow(2, Dex.getEffectiveness(moveData.type, defender.types));

  return (
    baseDamage(attacker.level, power, attackStat, defenseStat) *
    stab *
    typeMultiplier *
    weatherMultiplier(moveData.type, field.weather) *
    terrainMultiplier(moveData.type, field.terrain) *
    AVERAGE_DAMAGE_ROLL
  );
}

function priorityBonus(moveData: MoveData, speed: SpeedComparison): number {
  if (moveData.priority <= 0) return 0;
  // Priority is most valuable when we wouldn't otherwise act first.
  return moveData.priority * (speed === "lose" ? 12 : 3);
}

function secondaryEffectBonus(moveData: MoveData, speed: SpeedComparison): number {
  const secondaries = moveData.secondaries ?? (moveData.secondary ? [moveData.secondary] : []);
  let bonus = 0;
  for (const secondary of secondaries) {
    const chance = (secondary.chance ?? 100) / 100;
    if (secondary.volatileStatus === "flinch") {
      // Flinch only matters if we're actually going to move first.
      if (speed !== "lose") bonus += chance * 15;
    } else if (secondary.status) {
      bonus += chance * 10;
    } else if (secondary.boosts) {
      const isNegative = Object.values(secondary.boosts).some((amount) => (amount ?? 0) < 0);
      bonus += chance * (isNegative ? 8 : 6);
    }
  }
  return bonus;
}

function koBonus(damagePercent: number, defenderHpFraction: number, speed: SpeedComparison, priority: number): number {
  if (damagePercent < defenderHpFraction) return 0;
  // Only value a KO highly when we're confident we act first (priority, or we simply outspeed).
  if (priority > 0 || speed === "win") return KO_BONUS;
  if (speed === "range") return KO_BONUS / 2;
  return 0;
}

function recoilPenalty(rawDamage: number, recoilFrac: number, attacker: Combatant): number {
  if (recoilFrac <= 0) return 0;
  const recoilHp = rawDamage * recoilFrac;
  const wouldFaintSelf = recoilHp >= attacker.currentHp;
  return (recoilHp / attacker.maxHp) * 40 + (wouldFaintSelf ? 60 : 0);
}

function drainBonus(rawDamage: number, drainFrac: number, attacker: Combatant): number {
  if (drainFrac <= 0) return 0;
  const missingHp = attacker.maxHp - attacker.currentHp;
  if (missingHp <= 0) return 0;
  const usefulHeal = Math.min(rawDamage * drainFrac, missingHp);
  return (usefulHeal / attacker.maxHp) * 40;
}

function isHazardMoveRedundant(moveId: string, hazards: HazardState): boolean {
  switch (moveId) {
    case "stealthrock":
      return hazards.stealthRock;
    case "spikes":
      return hazards.spikes >= 3;
    case "toxicspikes":
      return hazards.toxicSpikes >= 2;
    case "stickyweb":
      return hazards.stickyWeb;
    default:
      return false;
  }
}

const WEATHER_MOVE_RESULT: Record<string, string[]> = {
  sunnyday: ["SunnyDay"],
  raindance: ["RainDance"],
  sandstorm: ["Sandstorm"],
  hail: ["Hail", "Snow"],
  snowscape: ["Snow"],
  chillyreception: ["Snow"],
};

function isWeatherMoveRedundant(moveId: string, weather: string | null): boolean {
  return weather !== null && (WEATHER_MOVE_RESULT[moveId]?.includes(weather) ?? false);
}

const TERRAIN_MOVE_RESULT: Record<string, string> = {
  electricterrain: "Electric Terrain",
  grassyterrain: "Grassy Terrain",
  mistyterrain: "Misty Terrain",
  psychicterrain: "Psychic Terrain",
};

function isTerrainMoveRedundant(moveId: string, terrain: string | null): boolean {
  return terrain !== null && TERRAIN_MOVE_RESULT[moveId] === terrain;
}

function selfBoostAlreadyMaxed(moveData: MoveData, attacker: Combatant): boolean {
  if (!moveData.boosts || moveData.target !== "self") return false;
  return Object.entries(moveData.boosts).every(
    ([stat, amount]) => (amount ?? 0) <= 0 || (attacker.boosts[stat] ?? 0) >= 6,
  );
}

/** Which of the defender's revealed moves lean on, to make a stat-lowering move target the stat that actually matters. */
function preferredDebuffStat(knownMoves: string[] | undefined): "atk" | "spa" | null {
  if (!knownMoves || knownMoves.length === 0) return null;
  let physical = 0;
  let special = 0;
  for (const name of knownMoves) {
    const data = Dex.moves.get(name);
    if (data.category === "Physical") physical++;
    else if (data.category === "Special") special++;
  }
  if (physical === special) return null;
  return physical > special ? "atk" : "spa";
}

function debuffRelevanceBonus(moveData: MoveData, defender: Combatant): number {
  if (!moveData.boosts || moveData.target === "self") return 0;
  const preferred = preferredDebuffStat(defender.knownMoves);
  if (!preferred) return 0;
  return (moveData.boosts[preferred] ?? 0) < 0 ? DEBUFF_RELEVANCE_BONUS : 0;
}

function scoreMove(
  move: MoveOption,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
  speed: SpeedComparison,
  rng: () => number,
): number {
  const moveData = Dex.moves.get(move.name);
  let score: number;

  if (moveData.category === "Status") {
    if (
      isHazardMoveRedundant(moveData.id, field.defenderHazards) ||
      isWeatherMoveRedundant(moveData.id, field.weather) ||
      isTerrainMoveRedundant(moveData.id, field.terrain) ||
      (Boolean(moveData.status) && Boolean(defender.status)) ||
      selfBoostAlreadyMaxed(moveData, attacker) ||
      healingMoveWouldFail(moveData, attacker)
    ) {
      score = 0; // this move would just fail
    } else {
      score = STATUS_MOVE_BASELINE + debuffRelevanceBonus(moveData, defender) + healingMoveBonus(moveData, attacker);
    }
  } else {
    const immune = !Dex.getImmunity(moveData.type, defender.types) || isImmuneViaAbility(moveData.type, defender.ability);
    if (immune) return 0;

    const rawDamage = Math.max(computeRawDamage(moveData, attacker, defender, field), 0);
    const damagePercent = rawDamage / defender.maxHp;
    const accuracy =
      moveData.accuracy === true
        ? 1
        : (moveData.accuracy / 100) * accuracyStageMultiplier((attacker.boosts.accuracy ?? 0) - (defender.boosts.evasion ?? 0));

    score = damagePercent * 100 * accuracy;
    score += priorityBonus(moveData, speed);
    score += secondaryEffectBonus(moveData, speed);
    score += koBonus(damagePercent, defender.currentHp / defender.maxHp, speed, moveData.priority);
    score += drainBonus(rawDamage, drainFraction(moveData), attacker);
    score -= recoilPenalty(rawDamage, recoilFraction(moveData), attacker);
  }

  if (typeof move.pp === "number" && move.pp <= 1) score *= LAST_PP_CONSERVATION_FACTOR;

  const jitter = 1 - JITTER_RANGE / 2 + rng() * JITTER_RANGE;
  return score * jitter;
}

/** Picks the opposing trainer's move: favors super-effective/STAB/high-expected-damage moves, avoids immune or failing moves. */
export function chooseTrainerMove(ctx: TrainerAiContext): string {
  const { request, attacker, defender, field } = ctx;
  const rng = ctx.rng ?? Math.random;

  if (request.forceSwitch) return request.switches[0]?.choice ?? "move 1";

  const usable = request.moves.filter((move) => !move.disabled);
  if (usable.length === 0) return request.switches[0]?.choice ?? "move 1";

  const speed = compareSpeed(attacker, defender);

  let best = usable[0];
  let bestScore = -Infinity;
  for (const move of usable) {
    const score = scoreMove(move, attacker, defender, field, speed, rng);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best.choice;
}
