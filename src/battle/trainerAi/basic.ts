import { Dex } from "@pkmn/sim";
import type { MoveOption } from "../battleSimulator";
import type { StatusCode } from "../formatBattleLine";
import type { MoveData } from "./damageMath";
import { computeRawDamage, drainFraction, healFraction, isImmuneViaAbility, recoilFraction } from "./damageMath";
import { accuracyStageMultiplier, compareSpeed } from "./statMath";
import type { Combatant, FieldConditions, SpeedComparison, TrainerAiContext, TrainerAiImplementation } from "./types";

const STATUS_MOVE_BASELINE = 30;
const JITTER_RANGE = 0.2;
const KO_BONUS = 40;
/** Applied to any move that's down to its last PP, to discourage burning a move's final charge when a similarly-good alternative exists. */
const LAST_PP_CONSERVATION_FACTOR = 0.7;
const DEBUFF_RELEVANCE_BONUS = 10;
/** Below this HP fraction, restoring HP is worth an extra flat bonus on top of the HP% it actually restores — survival matters more than the raw number once a KO is a real threat. */
const LOW_HP_THRESHOLD = 0.35;
const SURVIVAL_BONUS = 20;
/** Value of one boosted stage of a self-targeted setup move, at full relevance and before decay. */
const SETUP_MOVE_UNIT = 8;
/** Per-stat multiplier applied per stage the attacker already holds in that stat — makes repeat casts of the same setup move rapidly less appealing without banning them outright (selfBoostAlreadyMaxed still hard-cuts once a raised stat hits +6). */
const SETUP_STAGE_DECAY = 0.4;
/** Flat bonus for a Status move that reliably inflicts a status condition, on top of the STATUS_MOVE_BASELINE — status is worth actively going for, not just a side effect. */
const STATUS_INFLICT_BONUS: Record<StatusCode, number> = {
  slp: 40,
  frz: 35,
  brn: 32,
  tox: 30,
  par: 25,
  psn: 20,
};

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

function isHazardMoveRedundant(moveId: string, hazards: FieldConditions["defenderHazards"]): boolean {
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

interface OffensiveMix {
  physical: number;
  special: number;
}

/** Base-power-weighted split of the attacker's own damaging moves, used to judge which offensive stat its setup moves should actually favor. */
function offensiveMoveMix(moves: MoveOption[]): OffensiveMix {
  let physical = 0;
  let special = 0;
  for (const move of moves) {
    const data = Dex.moves.get(move.name);
    if (data.category === "Physical") physical += data.basePower || 0;
    else if (data.category === "Special") special += data.basePower || 0;
  }
  return { physical, special };
}

/** How relevant boosting a given stat is right now, from 0 (useless) to ~1 (ideal) — pairs the boost with the attacker's own moveset/stats and the current matchup rather than valuing every stat equally. */
function setupStatRelevance(
  stat: string,
  defender: Combatant,
  speed: SpeedComparison,
  offense: OffensiveMix,
): number {
  const offenseTotal = offense.physical + offense.special;
  switch (stat) {
    case "atk":
      return offenseTotal > 0 ? offense.physical / offenseTotal : 0.5;
    case "spa":
      return offenseTotal > 0 ? offense.special / offenseTotal : 0.5;
    case "def": {
      const leaning = preferredDebuffStat(defender.knownMoves);
      if (leaning === "atk") return 0.9;
      if (leaning === "spa") return 0.3;
      return 0.6;
    }
    case "spd": {
      const leaning = preferredDebuffStat(defender.knownMoves);
      if (leaning === "spa") return 0.9;
      if (leaning === "atk") return 0.3;
      return 0.6;
    }
    case "spe":
      // Already faster: a further speed boost rarely changes anything; still behind or unsure: valuable.
      return speed === "win" ? 0.3 : 0.9;
    default:
      return 0.4; // accuracy/evasion — a minor, generically useful edge
  }
}

/** Value of using a self-targeted setup move: highest the first time on a stat that pairs with the attacker's own offense/matchup, rapidly diminishing on repeat casts of the same stat (selfBoostAlreadyMaxed cuts it off entirely once maxed). */
function setupMoveBonus(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  speed: SpeedComparison,
  offense: OffensiveMix,
): number {
  if (!moveData.boosts || moveData.target !== "self") return 0;
  let bonus = 0;
  for (const [stat, amount] of Object.entries(moveData.boosts)) {
    if (!amount || amount <= 0) continue;
    const relevance = setupStatRelevance(stat, defender, speed, offense);
    const stage = Math.max(0, attacker.boosts[stat] ?? 0);
    const decay = Math.pow(SETUP_STAGE_DECAY, stage);
    bonus += amount * relevance * decay * SETUP_MOVE_UNIT;
  }
  return bonus;
}

/** Flat bonus for a Status move that reliably inflicts a status condition — separate from (and additive with) any secondary-chance status handled by secondaryEffectBonus for damaging moves. */
function statusInflictionBonus(moveData: MoveData): number {
  if (!moveData.status) return 0;
  return STATUS_INFLICT_BONUS[moveData.status as StatusCode] ?? 25;
}

function scoreMove(
  move: MoveOption,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
  speed: SpeedComparison,
  offense: OffensiveMix,
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
      score =
        STATUS_MOVE_BASELINE +
        debuffRelevanceBonus(moveData, defender) +
        healingMoveBonus(moveData, attacker) +
        statusInflictionBonus(moveData) +
        setupMoveBonus(moveData, attacker, defender, speed, offense);
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

/** Picks the opposing trainer's move: favors super-effective/STAB/high-expected-damage moves, avoids immune or failing moves, and weighs status/setup/hazard/healing options against attacking. */
function chooseMove(ctx: TrainerAiContext): string {
  const { request, attacker, defender, field } = ctx;
  const rng = ctx.rng ?? Math.random;

  if (request.forceSwitch) return request.switches[0]?.choice ?? "move 1";

  const usable = request.moves.filter((move) => !move.disabled);
  if (usable.length === 0) return request.switches[0]?.choice ?? "move 1";

  const speed = compareSpeed(attacker, defender);
  const offense = offensiveMoveMix(request.moves);

  let best = usable[0];
  let bestScore = -Infinity;
  for (const move of usable) {
    const score = scoreMove(move, attacker, defender, field, speed, offense, rng);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best.choice;
}

export const basicTrainerAi: TrainerAiImplementation = {
  id: "basic",
  label: "Basic",
  chooseMove,
};
