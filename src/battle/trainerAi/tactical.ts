import { Dex } from "@pkmn/sim";
import type { MoveOption } from "../battleSimulator";
import type { StatusCode } from "../formatBattleLine";
import { residualDamagePerTurn, residualFractionPerTurn, switchInHazardCost } from "./attrition";
import type { DamageSpec, MoveData } from "./damageMath";
import {
  computeRawDamage,
  computeSpecDamage,
  drainFraction,
  healFraction,
  isImmuneViaAbility,
  recoilFraction,
} from "./damageMath";
import { accuracyStageMultiplier, compareSpeed, statStageMultiplier } from "./statMath";
import type {
  BenchOption,
  Combatant,
  FieldConditions,
  SpeedComparison,
  TrainerAiContext,
  TrainerAiImplementation,
} from "./types";

/*
 * Every score in this file is denominated in one unit: "percent of the opponent's max HP this turn
 * is worth". A move that deals 40% scores ~40, and a Status move scores only what its modeled
 * effect is actually worth in that same currency. There is deliberately NO flat baseline for Status
 * moves — the flat baseline is what makes the "basic" AI re-cast no-op status and keep setting up
 * long past the point of usefulness, because a move with zero real effect still outscored a
 * mediocre attack.
 */

/** Ceiling on what a Status move whose effect this AI doesn't model (Protect, Trick Room, ...) can be worth. */
const UNMODELED_STATUS_VALUE = 6;
/** Floor beneath that, so an unmodeled Status move still beats a move that does literally nothing (every attack immune). */
const LAST_RESORT_VALUE = 0.5;
/** Fraction of the best available attack an unmodeled Status move may be worth. Below 1 so that spending a turn on a move we cannot price never beats simply attacking — the flat floor is what let Substitute loop until it fainted. */
const UNMODELED_ATTACK_SHARE = 0.9;
/** Self-inflicted HP cost, as a fraction of max HP, of moves that pay HP for their effect. */
const SELF_HP_COST: Record<string, number> = {
  substitute: 0.25,
  bellydrum: 0.5,
  curse: 0.5, // Ghost-type Curse only; see selfHpCostFraction
  clangoroussoul: 0.33,
  filletaway: 0.5,
};
/** A status or debuff needs turns on the field to pay off; it's only worth full value once the matchup is expected to last this many turns. */
const LONGEVITY_HORIZON = 3;
/** Most turns of payoff a setup move is credited with — a boost that only pays off far in the future is speculative. */
const MAX_PAYOFF_TURNS = 3;
/** Stat stage past which further setup needs an explicitly safe board, not merely a positive score. */
const SETUP_SOFT_CAP = 2;
/** Stat stage past which setup is never worth another turn, safe or not. */
const SETUP_HARD_CAP = 4;
/** HP fraction the attacker must hold, alongside surviving SAFE_TURNS_TO_LIVE hits, for setup past the soft cap to "feel safe". */
const SAFE_HP_FRACTION = 0.5;
const SAFE_TURNS_TO_LIVE = 3;
/** Bound on the turn estimates, so a near-zero damage estimate can't produce an unbounded horizon. */
const MAX_ESTIMATED_TURNS = 6;
/** A low damage roll relative to the average roll the damage math uses — a KO only counts as guaranteed if even the low roll gets there. */
const LOW_ROLL_RATIO = 0.85 / 0.925;
const GUARANTEED_KO_BONUS = 45;
const LIKELY_KO_BONUS = 18;
/** Score for a move known to fail outright. Below zero so that any other option — even a useless one — outranks a guaranteed wasted turn. */
const KNOWN_FAILURE_SCORE = -1;
/**
 * Width of the tie-breaking wobble, as a fraction of the reference score below. Applied additively
 * rather than multiplicatively: scaling each move's jitter by its own score gave a pair of
 * equally-bad 4-point options a +-0.2 wobble, which resolved to the same option every single time.
 */
const JITTER_RANGE = 0.1;
/** Floor on the score the jitter is sized against, so near-ties between weak moves still get shuffled. */
const JITTER_REFERENCE_FLOOR = 10;
/** Jittered scores are held above zero, so a real move can never fall below a known-failure score. */
const JITTERED_SCORE_FLOOR = 0.01;
/** Status damping when a guaranteed KO is available but the speed check is a coin flip rather than a win. */
const KO_RANGE_SUPPRESSION = 0.5;
/** Applied to any move down to its last PP, to discourage burning a move's final charge when a similarly-good alternative exists. */
const LAST_PP_CONSERVATION_FACTOR = 0.7;
/** Hyper Beam and friends give up the following turn; charge moves give up the current one. */
const RECHARGE_FACTOR = 0.6;
const CHARGE_FACTOR = 0.55;
/** Worth of inflicting each status, before matchup relevance and the longevity scale. */
const STATUS_BASE_VALUE: Record<StatusCode, number> = {
  slp: 55,
  frz: 45,
  tox: 35,
  par: 35,
  brn: 30,
  psn: 18,
};
/** Worth of setting one entry hazard against a full party. Deliberately modest: the payoff lands on a future Pokemon, not on this matchup. */
const HAZARD_VALUE = 14;
/** Switch-ins the player must still have left for a hazard to be worth its full value. */
const HAZARD_FULL_VALUE_SWITCH_INS = 3;
/** Turns a prospective switch-in is judged over, matching the payoff window setup and status are priced against. */
const SWITCH_HORIZON_TURNS = 3;
/** How far a switch must beat staying put before it is worth conceding a free turn to make. */
const VOLUNTARY_SWITCH_MARGIN = 25;
/** Turns to live at or below which the current matchup counts as one worth abandoning. */
const LOSING_TURNS_TO_LIVE = 2;
/** Charged to a switch-in that hazards plus the free turn would knock out on the way in. */
const FAINTS_ON_ENTRY_PENALTY = 200;
/** Worth of the volatiles this AI models well enough to price; anything absent falls back to UNMODELED_STATUS_VALUE. */
const VOLATILE_VALUE: Record<string, number> = {
  leechseed: 30,
  yawn: 35,
  confusion: 18,
  taunt: 16,
  attract: 16,
};

type BoostTable = Record<string, number | undefined>;

// ---------------------------------------------------------------------------
// Threat and horizon model
// ---------------------------------------------------------------------------

/** Base power assumed for an attack the player hasn't revealed yet — a generic strong STAB hit. */
const ASSUMED_UNKNOWN_BASE_POWER = 80;

/** The defender's likely best attack, in HP points. Uses revealed moves when there are any; otherwise assumes a STAB attack of each of its types in whichever category its base stats favor. */
function estimateIncomingDamage(attacker: Combatant, defender: Combatant, field: FieldConditions): number {
  let best = 0;

  for (const name of defender.knownMoves ?? []) {
    const data = Dex.moves.get(name);
    if (data.category === "Status") continue;
    // Roles swap: the player's Pokemon is the attacker of this hypothetical hit.
    best = Math.max(best, computeRawDamage(data, defender, attacker, field));
  }
  if (best > 0) return best;

  const category = defender.baseStats.atk >= defender.baseStats.spa ? "Physical" : "Special";
  for (const type of defender.types) {
    const spec: DamageSpec = { type, category, basePower: ASSUMED_UNKNOWN_BASE_POWER };
    best = Math.max(best, computeSpecDamage(spec, defender, attacker, field));
  }
  return best;
}

function turnsToDeplete(currentHp: number, damagePerTurn: number): number {
  if (damagePerTurn <= 0) return MAX_ESTIMATED_TURNS;
  return Math.min(MAX_ESTIMATED_TURNS, Math.max(1, Math.ceil(currentHp / damagePerTurn)));
}

interface Horizon {
  /** Incoming *attack* damage per turn as a fraction of the attacker's max HP — the part a Def/SpD boost actually reduces. */
  incomingFraction: number;
  /** Non-attack chip per turn (status ticks, weather) net of terrain healing, as a fraction of max HP. No stat boost touches it. */
  residualFraction: number;
  /** Turns the attacker survives the defender's best attack, residual chip included. */
  turnsToLive: number;
  /** Turns the attacker needs to KO with its own best attack, the defender's own residual chip included. */
  turnsToKo: number;
  /** Turns this matchup is expected to last — the window any status or setup has to pay off in. */
  expectedTurns: number;
  /** 0..1 scale applied to every effect that needs time to pay off. */
  longevity: number;
  /** Whether the attacker can afford to spend another turn not attacking. */
  feelsSafe: boolean;
}

/**
 * Builds the turn budget every time-dependent valuation is scaled against. Both turn counts fold in
 * residual damage: a burned Pokemon standing in a sandstorm loses an eighth of its health per turn
 * to things no attack accounts for, and reading that as three safe turns is how setup gets a
 * Pokemon killed.
 */
function buildHorizon(attacker: Combatant, defender: Combatant, field: FieldConditions, bestDamage: number): Horizon {
  const incoming = estimateIncomingDamage(attacker, defender, field);
  const attackerResidual = residualDamagePerTurn(attacker, field);
  const defenderResidual = residualDamagePerTurn(defender, field);
  const turnsToLive = turnsToDeplete(attacker.currentHp, incoming + attackerResidual);
  const turnsToKo = turnsToDeplete(defender.currentHp, bestDamage + defenderResidual);
  const expectedTurns = Math.min(turnsToLive, turnsToKo);
  return {
    incomingFraction: incoming / Math.max(attacker.maxHp, 1),
    residualFraction: residualFractionPerTurn(attacker, field),
    turnsToLive,
    turnsToKo,
    expectedTurns,
    longevity: Math.min(1, expectedTurns / LONGEVITY_HORIZON),
    feelsSafe: turnsToLive >= SAFE_TURNS_TO_LIVE && attacker.currentHp / attacker.maxHp >= SAFE_HP_FRACTION,
  };
}

// ---------------------------------------------------------------------------
// Status legality — the bulk of "that move did nothing"
// ---------------------------------------------------------------------------

/** Types outright immune to each status. */
const STATUS_IMMUNE_TYPES: Record<StatusCode, string[]> = {
  brn: ["Fire"],
  par: ["Electric"],
  frz: ["Ice"],
  psn: ["Poison", "Steel"],
  tox: ["Poison", "Steel"],
  slp: [],
};

/** Abilities granting immunity to a specific status. */
const STATUS_IMMUNE_ABILITIES: Record<StatusCode, string[]> = {
  brn: ["Water Veil", "Water Bubble", "Comatose", "Thermal Exchange"],
  par: ["Limber", "Comatose"],
  frz: ["Magma Armor", "Comatose"],
  psn: ["Immunity", "Comatose", "Pastel Veil"],
  tox: ["Immunity", "Comatose", "Pastel Veil"],
  slp: ["Insomnia", "Vital Spirit", "Comatose", "Sweet Veil"],
};

/** Abilities that block every non-volatile status outright. */
const GENERAL_STATUS_IMMUNE_ABILITIES = new Set(["Shields Down", "Purifying Salt", "Leaf Guard"]);

function isStatusBlocked(status: StatusCode, defender: Combatant, field: FieldConditions): boolean {
  if (STATUS_IMMUNE_TYPES[status].some((type) => defender.types.includes(type))) return true;
  if (defender.ability !== undefined) {
    if (GENERAL_STATUS_IMMUNE_ABILITIES.has(defender.ability)) return true;
    if (STATUS_IMMUNE_ABILITIES[status].includes(defender.ability)) return true;
  }
  // Grounding isn't tracked here, so this assumes a grounded target the same way terrainMultiplier does.
  if (field.terrain === "Misty Terrain") return true;
  if (field.terrain === "Electric Terrain" && status === "slp") return true;
  return false;
}

/** Fraction of its own max HP the attacker pays to use this move. Curse only costs HP for a Ghost-type user; for anyone else it is an ordinary boosting move. */
function selfHpCostFraction(moveData: MoveData, attacker: Combatant): number {
  const cost = SELF_HP_COST[moveData.id] ?? 0;
  if (moveData.id === "curse" && !attacker.types.includes("Ghost")) return 0;
  return cost;
}

/**
 * What a Status move with no modeled effect may be worth. Capped below the best attack available, so
 * a move this AI cannot price never beats simply attacking — an absolute floor is what let Substitute
 * outscore four weak-but-real attacks and loop until the user fainted.
 */
function unmodeledStatusValue(bestDamagePercent: number): number {
  return Math.min(UNMODELED_STATUS_VALUE, Math.max(LAST_RESORT_VALUE, bestDamagePercent * UNMODELED_ATTACK_SHARE));
}

/** Powder and spore moves (Spore, Sleep Powder, Stun Spore, ...) do nothing to Grass-types or Overcoat. */
function isPowderBlocked(moveData: MoveData, defender: Combatant): boolean {
  if (!moveData.flags?.powder) return false;
  return defender.types.includes("Grass") || defender.ability === "Overcoat";
}

/** Whether every stat a foe-targeting boosts move would lower already sits at the -6 floor (or the move lowers nothing at all). */
function foeDebuffAlreadyFloored(boosts: BoostTable, defender: Combatant): boolean {
  const drops = Object.entries(boosts).filter(([, amount]) => (amount ?? 0) < 0);
  if (drops.length === 0) return true;
  return drops.every(([stat]) => (defender.boosts[stat] ?? 0) <= -6);
}

function selfBoostAlreadyMaxed(boosts: BoostTable, attacker: Combatant): boolean {
  return Object.entries(boosts).every(([stat, amount]) => (amount ?? 0) <= 0 || (attacker.boosts[stat] ?? 0) >= 6);
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

const HAZARD_MOVE_IDS = new Set(["stealthrock", "spikes", "toxicspikes", "stickyweb"]);

const WEATHER_MOVE_RESULT: Record<string, string[]> = {
  sunnyday: ["SunnyDay"],
  raindance: ["RainDance"],
  sandstorm: ["Sandstorm"],
  hail: ["Hail", "Snow"],
  snowscape: ["Snow"],
  chillyreception: ["Snow"],
};

const TERRAIN_MOVE_RESULT: Record<string, string> = {
  electricterrain: "Electric Terrain",
  grassyterrain: "Grassy Terrain",
  mistyterrain: "Misty Terrain",
  psychicterrain: "Psychic Terrain",
};

/**
 * Whether a Status move would flatly do nothing on the current board. This is the check the "basic"
 * AI is thinnest on: it only catches an already-statused target, never a status the target's type or
 * ability makes impossible, and never a stat drop that has already bottomed out.
 */
function statusMoveWouldFail(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
  defenderPartyRemaining: number | undefined,
): boolean {
  const targetsFoe = moveData.target !== "self" && moveData.target !== "allySide";

  if (isHazardMoveRedundant(moveData.id, field.defenderHazards)) return true;
  // Hazards with nobody left to switch in are a wasted turn as surely as a redundant layer is.
  if (HAZARD_MOVE_IDS.has(moveData.id) && remainingSwitchIns(defenderPartyRemaining) === 0) return true;
  if (field.weather !== null && (WEATHER_MOVE_RESULT[moveData.id]?.includes(field.weather) ?? false)) return true;
  if (field.terrain !== null && TERRAIN_MOVE_RESULT[moveData.id] === field.terrain) return true;
  if (healFraction(moveData) > 0 && attacker.currentHp >= attacker.maxHp) return true;

  // Substitute and friends simply fail without the HP to pay for them (Substitute needs more than 1/4 max).
  const hpCost = selfHpCostFraction(moveData, attacker);
  if (hpCost > 0 && attacker.currentHp <= hpCost * attacker.maxHp) return true;

  if (moveData.status) {
    if (defender.status) return true;
    // The move's own type still has to connect: Thunder Wave into a Ground-type, Toxic into Steel.
    if (targetsFoe && !Dex.getImmunity(moveData.type, defender.types)) return true;
    if (targetsFoe && isImmuneViaAbility(moveData.type, defender.ability)) return true;
    if (isPowderBlocked(moveData, defender)) return true;
    if (isStatusBlocked(moveData.status as StatusCode, defender, field)) return true;
  }

  if (moveData.volatileStatus && targetsFoe) {
    if (isPowderBlocked(moveData, defender)) return true;
    if (!Dex.getImmunity(moveData.type, defender.types)) return true;
    if (moveData.volatileStatus === "leechseed" && defender.types.includes("Grass")) return true;
    if (moveData.volatileStatus === "yawn" && (defender.status !== null || isStatusBlocked("slp", defender, field))) {
      return true;
    }
  }

  if (moveData.boosts) {
    const boosts = moveData.boosts as BoostTable;
    if (targetsFoe) {
      if (foeDebuffAlreadyFloored(boosts, defender)) return true;
      if (!Dex.getImmunity(moveData.type, defender.types)) return true;
    } else if (selfBoostAlreadyMaxed(boosts, attacker)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Matchup relevance
// ---------------------------------------------------------------------------

/**
 * Sharpening exponent on the base-stat prior. A raw atk/(atk+spa) share reads a 130/45 attacker as
 * only 74% physical; squaring reads it as 89%, which is much closer to how such a spread actually plays.
 */
const OFFENSIVE_PRIOR_EXPONENT = 2;
/** Revealed damaging moves needed before what we have seen fully replaces the base-stat prior. */
const OFFENSIVE_EVIDENCE_FULL = 2;
/** Weight given to a revealed damaging move whose base power the Dex reports as variable. */
const NO_POWER_FALLBACK_WEIGHT = 60;

/**
 * How physical a Pokemon looks from its base stats alone. This is the prior the AI leans on before
 * the player has revealed anything — a 130 Atk / 45 SpA Pokemon is a physical attacker with very
 * high probability, and treating that as a coin flip threw away information already in hand.
 */
function baseStatPhysicalShare(combatant: Combatant): number {
  const atk = Math.pow(Math.max(combatant.baseStats.atk, 1), OFFENSIVE_PRIOR_EXPONENT);
  const spa = Math.pow(Math.max(combatant.baseStats.spa, 1), OFFENSIVE_PRIOR_EXPONENT);
  return atk / (atk + spa);
}

/** Base-power-weighted physical share of the damaging moves a Pokemon has actually shown us, plus how many that is. */
function revealedPhysicalShare(knownMoves: string[] | undefined): { share: number; count: number } {
  let physical = 0;
  let special = 0;
  let count = 0;
  for (const name of knownMoves ?? []) {
    const data = Dex.moves.get(name);
    if (data.category === "Physical") physical += data.basePower || NO_POWER_FALLBACK_WEIGHT;
    else if (data.category === "Special") special += data.basePower || NO_POWER_FALLBACK_WEIGHT;
    else continue;
    count++;
  }
  const total = physical + special;
  return { share: total <= 0 ? 0.5 : physical / total, count };
}

interface OffensiveMix {
  physical: number;
  special: number;
}

/** Base-power-weighted split of the attacker's own damaging moves, used to judge which offensive stat its setup should favor. */
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

function offensiveShare(offense: OffensiveMix, stat: "atk" | "spa"): number {
  const total = offense.physical + offense.special;
  if (total <= 0) return 0.5;
  return (stat === "atk" ? offense.physical : offense.special) / total;
}

/** 0..1 usefulness of hitting the defender's given defensive stat, judged from what the attacker actually attacks with. */
function defensiveDropRelevance(offense: OffensiveMix, stat: "def" | "spd"): number {
  return offensiveShare(offense, stat === "def" ? "atk" : "spa");
}

/**
 * 0..1 usefulness of blunting the defender's given offensive stat. Blends what it has actually
 * shown us with the prior its base stats imply, so an unrevealed Pokemon is still read as the
 * attacker its spread says it is instead of defaulting to an uninformative 0.5.
 */
function offensiveDropRelevance(defender: Combatant, stat: "atk" | "spa"): number {
  const prior = baseStatPhysicalShare(defender);
  const revealed = revealedPhysicalShare(defender.knownMoves);
  const confidence = Math.min(1, revealed.count / OFFENSIVE_EVIDENCE_FULL);
  const physicalShare = confidence * revealed.share + (1 - confidence) * prior;
  return stat === "atk" ? physicalShare : 1 - physicalShare;
}

// ---------------------------------------------------------------------------
// Status move value
// ---------------------------------------------------------------------------

function statusInflictValue(
  status: StatusCode,
  defender: Combatant,
  speed: SpeedComparison,
  horizon: Horizon,
): number {
  let value = STATUS_BASE_VALUE[status];
  if (status === "par") {
    // Paralysis mostly buys the speed swing; once we already outspeed, only the full-para chance is left.
    if (speed === "win") value *= 0.3;
  } else if (status === "brn") {
    // A burn on a special attacker only chips; on a physical one it halves the incoming hit.
    value *= offensiveDropRelevance(defender, "atk") + 0.1;
  }
  return value * horizon.longevity;
}

/**
 * Value of a self-targeting setup move, priced as the extra damage (or the avoided damage) the boost
 * actually buys over the turns left in this matchup, minus the turn it costs. The payoff is
 * inherently diminishing: +0 to +2 doubles a stat, while +2 to +4 only multiplies it by 1.5.
 */
function setupValue(
  boosts: BoostTable,
  attacker: Combatant,
  defender: Combatant,
  bestDamagePercent: number,
  offense: OffensiveMix,
  speed: SpeedComparison,
  horizon: Horizon,
): number {
  // Setup buys future turns; with none left, it buys nothing.
  const payoffTurns = Math.min(MAX_PAYOFF_TURNS, horizon.expectedTurns - 1);
  if (payoffTurns <= 0) return 0;

  let value = 0;
  for (const [stat, rawAmount] of Object.entries(boosts)) {
    const amount = rawAmount ?? 0;
    if (amount <= 0) continue;

    const current = attacker.boosts[stat] ?? 0;
    // +2 is enough unless the board is clearly safe, and +4 is always enough.
    if (current >= SETUP_HARD_CAP) continue;
    if (current >= SETUP_SOFT_CAP && !horizon.feelsSafe) continue;

    const gained = Math.min(amount, 6 - current);
    if (gained <= 0) continue;
    const ratio = statStageMultiplier(current + gained) / statStageMultiplier(current);

    if (stat === "atk" || stat === "spa") {
      value += bestDamagePercent * (ratio - 1) * offensiveShare(offense, stat) * payoffTurns;
    } else if (stat === "def" || stat === "spd") {
      // Worth only as much of the incoming damage as this stat actually soaks.
      const relevance = offensiveDropRelevance(defender, stat === "def" ? "atk" : "spa");
      value += horizon.incomingFraction * 100 * (1 - 1 / ratio) * relevance * payoffTurns;
    } else if (stat === "spe") {
      // Only worth a turn if it can flip the turn order; once we're already faster it buys nothing.
      if (speed !== "win") value += bestDamagePercent * 0.4 * payoffTurns;
    } else {
      value += 3 * payoffTurns; // accuracy/evasion — a real but minor edge
    }
  }
  return value;
}

/** Value of a foe-targeting stat drop, in the same currency: damage we gain plus damage we avoid, over the turns left. */
function debuffValue(
  boosts: BoostTable,
  defender: Combatant,
  bestDamagePercent: number,
  offense: OffensiveMix,
  speed: SpeedComparison,
  horizon: Horizon,
): number {
  const payoffTurns = Math.min(MAX_PAYOFF_TURNS, horizon.expectedTurns - 1);
  if (payoffTurns <= 0) return 0;

  let value = 0;
  for (const [stat, rawAmount] of Object.entries(boosts)) {
    const amount = rawAmount ?? 0;
    if (amount >= 0) continue;

    const current = defender.boosts[stat] ?? 0;
    const dropped = Math.min(-amount, current + 6);
    if (dropped <= 0) continue;
    const ratio = statStageMultiplier(current) / statStageMultiplier(current - dropped);

    if (stat === "atk" || stat === "spa") {
      value += horizon.incomingFraction * 100 * (1 - 1 / ratio) * offensiveDropRelevance(defender, stat) * payoffTurns;
    } else if (stat === "def" || stat === "spd") {
      value += bestDamagePercent * (ratio - 1) * defensiveDropRelevance(offense, stat) * payoffTurns;
    } else if (stat === "spe") {
      if (speed !== "win") value += bestDamagePercent * 0.4 * payoffTurns;
    } else {
      value += 3 * payoffTurns;
    }
  }
  return value;
}

function healingValue(moveData: MoveData, attacker: Combatant, horizon: Horizon): number {
  const fraction = healFraction(moveData);
  if (fraction <= 0) return 0;
  const missingHp = attacker.maxHp - attacker.currentHp;
  if (missingHp <= 0) return 0;
  const restoredPercent = (Math.min(fraction * attacker.maxHp, missingHp) / attacker.maxHp) * 100;
  // Healing for less than the foe hits for is losing slowly — credit the net gain, with a small floor
  // so healing stays worth something when nothing better is available.
  // Residual chip counts against the heal just as an attack does: recovering 50% while a toxic tick
  // and a sandstorm take 19% back is a much thinner gain than the raw number suggests.
  const netPercent = restoredPercent - (horizon.incomingFraction + Math.max(horizon.residualFraction, 0)) * 100;
  return Math.max(restoredPercent * 0.25, netPercent);
}

/**
 * Switch-ins the player has left to pay a hazard's toll. The Pokemon currently out has already
 * paid whatever was down when it entered, so only the ones still on the bench count.
 */
function remainingSwitchIns(defenderPartyRemaining: number | undefined): number | null {
  if (defenderPartyRemaining === undefined) return null;
  return Math.max(0, defenderPartyRemaining - 1);
}

/**
 * What a hazard is worth here. A flat value treated Stealth Rock against a full party and against
 * a player down to their last Pokemon as the same move, when the second one does nothing at all.
 */
function hazardValue(defenderPartyRemaining: number | undefined): number {
  const switchIns = remainingSwitchIns(defenderPartyRemaining);
  if (switchIns === null) return HAZARD_VALUE;
  return HAZARD_VALUE * Math.min(1, switchIns / HAZARD_FULL_VALUE_SWITCH_INS);
}

function fieldMoveValue(moveData: MoveData, field: FieldConditions, defenderPartyRemaining: number | undefined): number {
  if (HAZARD_MOVE_IDS.has(moveData.id)) return hazardValue(defenderPartyRemaining);
  if (WEATHER_MOVE_RESULT[moveData.id] || TERRAIN_MOVE_RESULT[moveData.id]) {
    // Redundant cases are already screened out by statusMoveWouldFail; overwriting an existing
    // condition is worth less than setting one on an empty field.
    return field.weather === null && field.terrain === null ? 12 : 8;
  }
  return 0;
}

function scoreStatusMove(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
  speed: SpeedComparison,
  offense: OffensiveMix,
  horizon: Horizon,
  bestDamagePercent: number,
  defenderPartyRemaining: number | undefined,
): number {
  if (statusMoveWouldFail(moveData, attacker, defender, field, defenderPartyRemaining)) return KNOWN_FAILURE_SCORE;

  let value = 0;
  if (moveData.status) value += statusInflictValue(moveData.status as StatusCode, defender, speed, horizon);
  if (moveData.volatileStatus) {
    // A Substitute soaks exactly the HP it costs, so its real worth is the free turns behind it —
    // which this AI has no way to exploit. It lands in the unmodeled bucket and is then charged its
    // HP cost below, leaving it net-negative: correct for an AI that cannot cash a sub in.
    const known = VOLATILE_VALUE[moveData.volatileStatus];
    value += (known ?? unmodeledStatusValue(bestDamagePercent)) * horizon.longevity;
  }
  if (moveData.boosts) {
    const boosts = moveData.boosts as BoostTable;
    value +=
      moveData.target === "self"
        ? setupValue(boosts, attacker, defender, bestDamagePercent, offense, speed, horizon)
        : debuffValue(boosts, defender, bestDamagePercent, offense, speed, horizon);
  }
  value += healingValue(moveData, attacker, horizon);
  value += fieldMoveValue(moveData, field, defenderPartyRemaining);

  if (value <= 0) value = unmodeledStatusValue(bestDamagePercent);

  // Charged after the floor, so a move whose only modeled effect is its price can go net-negative:
  // a Substitute that soaks less than the quarter of max HP it costs is worse than doing nothing.
  value -= selfHpCostFraction(moveData, attacker) * 100;

  // Status moves miss too: the "basic" AI never charges Hypnosis or Will-O-Wisp for their accuracy.
  return value * moveAccuracy(moveData, attacker, defender, field);
}

// ---------------------------------------------------------------------------
// Damaging move value
// ---------------------------------------------------------------------------

/** Moves that simply cannot miss in the right weather, whatever the Dex lists their accuracy as. */
const PERFECT_ACCURACY_WEATHER: Record<string, string[]> = {
  thunder: ["RainDance"],
  hurricane: ["RainDance"],
  blizzard: ["Hail", "Snow"],
};
/** The flip side: the same moves are actively unreliable in sun. */
const SUN_REDUCED_ACCURACY: Record<string, number> = { thunder: 50, hurricane: 50 };
/** Abilities that switch accuracy checks off entirely, on either side of the hit. */
const NO_GUARD_ABILITIES = new Set(["No Guard"]);

/** Flat accuracy multipliers from the attacker's ability. Hustle only taxes physical moves. */
function abilityAccuracyMultiplier(ability: string | undefined, moveData: MoveData): number {
  if (ability === undefined) return 1;
  if (ability === "Compound Eyes") return 1.3;
  if (ability === "Victory Star") return 1.1;
  if (ability === "Hustle" && moveData.category === "Physical") return 0.8;
  return 1;
}

/**
 * 0..1 chance the move connects. Beyond the stage multiplier, this covers the cases where the Dex
 * number is simply not the real one: a move that cannot miss in its weather, an OHKO move's
 * level-scaled 30%, and the abilities that bend every accuracy check.
 */
function moveAccuracy(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
): number {
  const noGuard =
    (attacker.ability !== undefined && NO_GUARD_ABILITIES.has(attacker.ability)) ||
    (defender.ability !== undefined && NO_GUARD_ABILITIES.has(defender.ability));
  if (noGuard) return 1;

  if (moveData.ohko) {
    // Fissure and friends flatly fail on a higher-level target, and otherwise land 30% of the time
    // plus the level gap. Stat stages don't enter into it.
    if (defender.level > attacker.level) return 0;
    return Math.min(1, (30 + attacker.level - defender.level) / 100);
  }

  if (field.weather !== null && (PERFECT_ACCURACY_WEATHER[moveData.id]?.includes(field.weather) ?? false)) return 1;
  if (moveData.accuracy === true) return 1;

  const listed =
    field.weather === "SunnyDay" ? (SUN_REDUCED_ACCURACY[moveData.id] ?? moveData.accuracy) : moveData.accuracy;
  const stage = (attacker.boosts.accuracy ?? 0) - (defender.boosts.evasion ?? 0);
  return Math.min(
    1,
    (listed / 100) * accuracyStageMultiplier(stage) * abilityAccuracyMultiplier(attacker.ability, moveData),
  );
}

/**
 * Damage that bypasses the formula: Seismic Toss and Night Shade's level, Dragon Rage's flat 40,
 * and an OHKO move, which deals exactly as much as the target has left.
 */
function fixedDamage(moveData: MoveData, attacker: Combatant, defender: Combatant): number | null {
  if (moveData.ohko) return defender.currentHp;
  if (moveData.damage === "level") return attacker.level;
  if (typeof moveData.damage === "number") return moveData.damage;
  return null;
}

function priorityBonus(moveData: MoveData, speed: SpeedComparison): number {
  if (moveData.priority <= 0) return 0;
  // Priority is most valuable when we wouldn't otherwise act first.
  return moveData.priority * (speed === "lose" ? 12 : 3);
}

function secondaryEffectBonus(
  moveData: MoveData,
  defender: Combatant,
  field: FieldConditions,
  speed: SpeedComparison,
  horizon: Horizon,
): number {
  const secondaries = moveData.secondaries ?? (moveData.secondary ? [moveData.secondary] : []);
  let bonus = 0;
  for (const secondary of secondaries) {
    const chance = (secondary.chance ?? 100) / 100;
    if (secondary.volatileStatus === "flinch") {
      // Flinch only matters if we're actually going to move first.
      if (speed !== "lose") bonus += chance * 15;
    } else if (secondary.status) {
      const status = secondary.status as StatusCode;
      // The same legality screen the dedicated status moves get: a 30% burn chance on a Fire-type is 0%.
      if (defender.status || isStatusBlocked(status, defender, field)) continue;
      bonus += chance * statusInflictValue(status, defender, speed, horizon) * 0.4;
    } else if (secondary.boosts) {
      // A drop on the target is good; a drop on ourselves (and a boost on the target) is not.
      const isSelf = Boolean(secondary.self);
      const isNegative = Object.values(secondary.boosts).some((amount) => (amount ?? 0) < 0);
      bonus += chance * (isSelf === isNegative ? -6 : 7);
    }
  }
  return bonus;
}

/** Penalty for a move's guaranteed self-inflicted stat drop (Close Combat's defenses, Overheat's Sp. Atk). */
function selfDropPenalty(moveData: MoveData): number {
  const boosts = moveData.self?.boosts as BoostTable | undefined;
  if (!boosts) return 0;
  let drops = 0;
  for (const amount of Object.values(boosts)) if ((amount ?? 0) < 0) drops += -(amount ?? 0);
  return drops * 5;
}

function recoilPenalty(rawDamage: number, moveData: MoveData, attacker: Combatant): number {
  const fraction = recoilFraction(moveData);
  if (fraction <= 0) return 0;
  const recoilHp = rawDamage * fraction;
  return (recoilHp / attacker.maxHp) * 40 + (recoilHp >= attacker.currentHp ? 60 : 0);
}

function drainBonus(rawDamage: number, moveData: MoveData, attacker: Combatant): number {
  const fraction = drainFraction(moveData);
  if (fraction <= 0) return 0;
  const missingHp = attacker.maxHp - attacker.currentHp;
  if (missingHp <= 0) return 0;
  return (Math.min(rawDamage * fraction, missingHp) / attacker.maxHp) * 40;
}

/** Multi-turn moves cost a turn the raw damage number doesn't show — Hyper Beam's recharge, Solar Beam's charge. */
function multiTurnFactor(moveData: MoveData, field: FieldConditions): number {
  if (moveData.flags?.recharge) return RECHARGE_FACTOR;
  if (moveData.flags?.charge) {
    if ((moveData.id === "solarbeam" || moveData.id === "solarblade") && field.weather === "SunnyDay") return 1;
    return CHARGE_FACTOR;
  }
  return 1;
}

interface DamageAssessment {
  score: number;
  /** Expected damage as a percent of the defender's max HP, accuracy included. */
  expectedPercent: number;
  /** Whether even a low roll takes the defender out, on a move that can't miss. */
  guaranteedKo: boolean;
  /** Whether this move resolves before the defender's — via priority, or by simply being faster. */
  actsFirst: boolean;
}

function scoreDamagingMove(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
  speed: SpeedComparison,
  horizon: Horizon,
): DamageAssessment {
  const immune =
    !Dex.getImmunity(moveData.type, defender.types) || isImmuneViaAbility(moveData.type, defender.ability);
  if (immune) return { score: KNOWN_FAILURE_SCORE, expectedPercent: 0, guaranteedKo: false, actsFirst: false };

  const actsFirst = moveData.priority > 0 || speed === "win";
  const fixed = fixedDamage(moveData, attacker, defender);
  const rawDamage = fixed ?? Math.max(computeRawDamage(moveData, attacker, defender, field, { movesFirst: actsFirst }), 0);
  const damagePercent = rawDamage / Math.max(defender.maxHp, 1);
  const accuracy = moveAccuracy(moveData, attacker, defender, field);
  const defenderHpFraction = defender.currentHp / Math.max(defender.maxHp, 1);

  // A KO is only worth the full bonus when it's guaranteed even on a low roll and we land it first.
  const guaranteedKo = damagePercent * LOW_ROLL_RATIO >= defenderHpFraction;
  const possibleKo = damagePercent >= defenderHpFraction;
  let ko = 0;
  if (guaranteedKo) {
    ko = actsFirst ? GUARANTEED_KO_BONUS : speed === "range" ? GUARANTEED_KO_BONUS / 2 : LIKELY_KO_BONUS;
  } else if (possibleKo) {
    ko = actsFirst ? LIKELY_KO_BONUS : LIKELY_KO_BONUS / 2;
  }

  // Every conditional payoff rides on the move actually connecting, the KO bonus included.
  let score = damagePercent * 100 * accuracy;
  score += (ko + priorityBonus(moveData, speed) + secondaryEffectBonus(moveData, defender, field, speed, horizon)) * accuracy;
  score += drainBonus(rawDamage, moveData, attacker) * accuracy;
  score -= recoilPenalty(rawDamage, moveData, attacker) * accuracy;
  score -= selfDropPenalty(moveData);
  score *= multiTurnFactor(moveData, field);

  return {
    score,
    expectedPercent: damagePercent * 100 * accuracy,
    guaranteedKo: guaranteedKo && accuracy >= 1,
    actsFirst,
  };
}

// ---------------------------------------------------------------------------
// Switching
// ---------------------------------------------------------------------------

/** Best damage, as a percent of the target's max HP, a Pokemon could manage with the moves it knows. */
function bestMoveDamagePercent(
  moves: string[],
  self: Combatant,
  target: Combatant,
  field: FieldConditions,
): number {
  let best = 0;
  for (const name of moves) {
    const data = Dex.moves.get(name);
    if (data.category === "Status") continue;
    if (!Dex.getImmunity(data.type, target.types) || isImmuneViaAbility(data.type, target.ability)) continue;
    const fixed = fixedDamage(data, self, target);
    const raw = fixed ?? Math.max(computeRawDamage(data, self, target, field), 0);
    const percent = (raw / Math.max(target.maxHp, 1)) * 100 * moveAccuracy(data, self, target, field);
    best = Math.max(best, percent);
  }
  return best;
}

interface SwitchAssessment {
  choice: string;
  /** Net percent-of-max-HP this candidate trades over SWITCH_HORIZON_TURNS, entry toll already deducted. */
  score: number;
}

/**
 * Prices bringing one benched teammate in against the player's current Pokemon, in the same
 * percent-of-max-HP currency every move is scored in: what it trades per turn over the switch
 * horizon, minus the entry hazards it walks into and (when the switch is voluntary) the free turn
 * the player gets to attack into.
 */
function assessSwitch(
  option: BenchOption,
  defender: Combatant,
  field: FieldConditions,
  concedesFreeTurn: boolean,
): SwitchAssessment {
  const candidate = option.combatant;
  const hpPercent = (candidate.currentHp / Math.max(candidate.maxHp, 1)) * 100;

  const outgoing = bestMoveDamagePercent(option.moves, candidate, defender, field);
  const incoming =
    (estimateIncomingDamage(candidate, defender, field) / Math.max(candidate.maxHp, 1)) * 100 +
    residualFractionPerTurn(candidate, field) * 100;

  const entryCost = switchInHazardCost(candidate, field.attackerHazards) * 100 + (concedesFreeTurn ? incoming : 0);
  // Pivoting into something that dies on the way in trades one Pokemon for nothing.
  const dies = entryCost >= hpPercent;

  return {
    choice: option.choice,
    score: (outgoing - incoming) * SWITCH_HORIZON_TURNS - entryCost - (dies ? FAINTS_ON_ENTRY_PENALTY : 0),
  };
}

/**
 * Picks the replacement after a knockout. Party order is not a strategy: this sends in whichever
 * teammate actually wins the matchup it is walking into, hazards on our own side included.
 */
function chooseReplacement(ctx: TrainerAiContext): string {
  const fallback = ctx.request.switches[0]?.choice ?? "move 1";
  const bench = ctx.bench ?? [];
  if (bench.length === 0) return fallback;

  let best = fallback;
  let bestScore = -Infinity;
  for (const option of bench) {
    const { score } = assessSwitch(option, ctx.defender, ctx.field, false);
    if (score > bestScore) {
      bestScore = score;
      best = option.choice;
    }
  }
  return best;
}

/**
 * Whether to pivot out instead of attacking. Deliberately conservative: switching hands the player
 * a free turn, so it only fires out of a matchup that is genuinely losing, and only for a
 * replacement that beats staying by a clear margin. Without cross-turn memory the margin is also
 * what stops the AI oscillating between two Pokemon.
 */
function considerVoluntarySwitch(
  ctx: TrainerAiContext,
  horizon: Horizon,
  bestDamagePercent: number,
  guaranteedKoFirst: boolean,
  speed: SpeedComparison,
): string | null {
  const bench = ctx.bench ?? [];
  if (bench.length === 0 || ctx.request.trapped || ctx.request.switches.length === 0) return null;
  // Winning the matchup outright this turn beats any pivot.
  if (guaranteedKoFirst) return null;

  const outpaced = horizon.turnsToKo > horizon.turnsToLive || (horizon.turnsToKo === horizon.turnsToLive && speed === "lose");
  if (horizon.turnsToLive > LOSING_TURNS_TO_LIVE || !outpaced) return null;

  const stayScore =
    (bestDamagePercent - (horizon.incomingFraction + horizon.residualFraction) * 100) * SWITCH_HORIZON_TURNS;

  let best: SwitchAssessment | null = null;
  for (const option of bench) {
    const assessment = assessSwitch(option, ctx.defender, ctx.field, true);
    if (best === null || assessment.score > best.score) best = assessment;
  }
  if (best === null || best.score <= stayScore + VOLUNTARY_SWITCH_MARGIN) return null;
  return best.choice;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function applyPpConservation(score: number, move: MoveOption): number {
  if (typeof move.pp !== "number" || move.pp > 1) return score;
  return score > 0 ? score * LAST_PP_CONSERVATION_FACTOR : score;
}

/**
 * How far a Status move is damped by having a knockout available. Landing the KO before the player
 * moves makes everything else worthless, but a "range" speed check is a coin flip, not a win —
 * zeroing status there gambled the turn on winning a roll the AI cannot see.
 */
function koSuppressionFactor(guaranteedKoFirst: boolean, guaranteedKoAny: boolean, speed: SpeedComparison): number {
  if (guaranteedKoFirst) return 0;
  if (!guaranteedKoAny) return 1;
  return speed === "range" ? KO_RANGE_SUPPRESSION : 1;
}

/**
 * Additive tie-breaking wobble, sized against the best score on the board rather than each move's
 * own. Non-positive scores are left alone so a move known to fail can never jitter its way above a
 * real one.
 */
function applyJitter(score: number, amplitude: number, rng: () => number): number {
  if (score <= 0) return score;
  return Math.max(JITTERED_SCORE_FLOOR, score + (rng() - 0.5) * 2 * amplitude);
}

/**
 * Picks the opposing trainer's move. Same general shape as the "basic" AI, but every Status move is
 * priced by its modeled effect instead of a flat baseline, screened for real legality (type and
 * ability status immunities, bottomed-out stat drops, powder into Grass) and for accuracy, setup is
 * capped at +2 unless the board is clearly safe, and a losing matchup is a reason to pivot out
 * rather than something to stand and die in.
 */
function chooseMove(ctx: TrainerAiContext): string {
  const { request, attacker, defender, field, defenderPartyRemaining } = ctx;
  const rng = ctx.rng ?? Math.random;

  if (request.forceSwitch) return chooseReplacement(ctx);

  const usable = request.moves.filter((move) => !move.disabled);
  if (usable.length === 0) return chooseReplacement(ctx);

  const speed = compareSpeed(attacker, defender);
  const offense = offensiveMoveMix(request.moves);
  const moveData = usable.map((move) => Dex.moves.get(move.name));

  // Pass 1: price the damaging moves against a provisional horizon, purely to learn how hard this
  // Pokemon can hit. Only expectedPercent and the KO flags are kept — the scores are recomputed
  // below, because a horizon built with zero damage overstates how long the matchup will last and
  // every secondary effect is valued against that window.
  const provisionalHorizon = buildHorizon(attacker, defender, field, 0);
  let bestDamagePercent = 0;
  for (let index = 0; index < usable.length; index++) {
    if (moveData[index].category === "Status") continue;
    const assessment = scoreDamagingMove(moveData[index], attacker, defender, field, speed, provisionalHorizon);
    bestDamagePercent = Math.max(bestDamagePercent, assessment.expectedPercent);
  }
  const horizon = buildHorizon(attacker, defender, field, (bestDamagePercent / 100) * defender.maxHp);

  // Pass 2: rescore everything against the real horizon, so damaging and Status moves are judged
  // over the same turn budget.
  const scores: number[] = [];
  let guaranteedKoAny = false;
  let guaranteedKoFirst = false;
  const assessments = usable.map((_move, index) =>
    moveData[index].category === "Status"
      ? null
      : scoreDamagingMove(moveData[index], attacker, defender, field, speed, horizon),
  );
  for (const assessment of assessments) {
    if (!assessment?.guaranteedKo) continue;
    guaranteedKoAny = true;
    if (assessment.actsFirst) guaranteedKoFirst = true;
  }

  const suppression = koSuppressionFactor(guaranteedKoFirst, guaranteedKoAny, speed);
  for (let index = 0; index < usable.length; index++) {
    const data = moveData[index];
    let raw: number;
    if (data.category === "Status") {
      const value = scoreStatusMove(
        data,
        attacker,
        defender,
        field,
        speed,
        offense,
        horizon,
        bestDamagePercent,
        defenderPartyRemaining,
      );
      // Suppression only damps a move that is worth something; scaling a known-failure score toward
      // zero would quietly promote it above the other options it is meant to rank below.
      raw = value > 0 ? value * suppression : value;
    } else {
      raw = assessments[index]?.score ?? 0;
    }
    scores.push(applyPpConservation(raw, usable[index]));
  }

  // Pass 3: pivot out of a hopeless matchup rather than spending the turn losing it slowly.
  const pivot = considerVoluntarySwitch(ctx, horizon, bestDamagePercent, guaranteedKoFirst, speed);
  if (pivot !== null) return pivot;

  const amplitude = (Math.max(...scores, JITTER_REFERENCE_FLOOR) * JITTER_RANGE) / 2;
  let best = usable[0];
  let bestScore = -Infinity;
  for (let index = 0; index < usable.length; index++) {
    const score = applyJitter(scores[index], amplitude, rng);
    if (score > bestScore) {
      bestScore = score;
      best = usable[index];
    }
  }
  return best.choice;
}

export const tacticalTrainerAi: TrainerAiImplementation = {
  id: "tactical",
  label: "Tactical",
  chooseMove,
};
