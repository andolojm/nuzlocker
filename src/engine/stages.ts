import { StageType } from "./stage";
import type { Stage } from "./stage";

/** How far an individual opponent's strength may drift from its battle's base value, in either direction. */
const STRENGTH_VARIANCE = 0.15;

/** Rolls a single opponent's strength within +-STRENGTH_VARIANCE of the battle's base strength. */
function varyStrength(baseStrength: number, random: () => number): number {
  const swing = baseStrength * STRENGTH_VARIANCE;
  return Math.round(baseStrength + (random() * 2 - 1) * swing);
}

/** Builds a Battle stage's opponentTeam: `size` strength values scattered around `baseStrength`. */
export function buildOpponentTeam(size: number, baseStrength: number, random: () => number = Math.random): number[] {
  return Array.from({ length: size }, () => varyStrength(baseStrength, random));
}

/** Range the strength (bst constraint) passed to Catch stages' encounterPokemon call scales across. */
const CATCH_STRENGTH_MIN = 300;
const CATCH_STRENGTH_MAX = 550;

/** Linearly scales `index` (0-based, out of `count` total) between CATCH_STRENGTH_MIN and _MAX. */
function catchStrength(index: number, count: number): number {
  if (count <= 1) return CATCH_STRENGTH_MIN;
  const t = index / (count - 1);
  return Math.round(CATCH_STRENGTH_MIN + t * (CATCH_STRENGTH_MAX - CATCH_STRENGTH_MIN));
}

/**
 * Assigns each Catch stage a `strength` scaled by its position among Catch stages specifically
 * (ignoring Battle/InitialChoice stages interspersed between them), so the run's wild encounters
 * get steadily tougher independent of how the Battle stages are paced.
 */
function withCatchStrengths(stages: Stage[]): Stage[] {
  const catchStageCount = stages.filter((stage) => stage.type === StageType.Catch).length;
  let catchStageIndex = 0;
  return stages.map((stage) => {
    if (stage.type !== StageType.Catch) return stage;
    return { ...stage, strength: catchStrength(catchStageIndex++, catchStageCount) };
  });
}

export const STAGES: Stage[] = withCatchStrengths([
  {
    type: StageType.InitialChoice,
    description: "A researcher offers you a choice of three Pokémon to start your journey.",
    level: 2,
    cap: 6,
  },
  {
    type: StageType.Catch,
    description: "A rustle in the grass — your first wild Pokémon encounter.",
    level: 4,
    cap: 8,
  },
  { type: StageType.Catch, description: "Another wild Pokémon appears nearby.", level: 6, cap: 10 },
  { type: StageType.Catch, description: "One more wild Pokémon crosses your path.", level: 8, cap: 12 },
  {
    type: StageType.Battle,
    description: "A trainer challenges you to a battle.",
    opponentTeam: buildOpponentTeam(2, 280),
    level: 10,
    cap: 13,
  },
  {
    type: StageType.Battle,
    description: "Another trainer steps forward, ready to fight.",
    opponentTeam: buildOpponentTeam(2, 328),
    level: 13,
    cap: 16,
  },
  { type: StageType.Catch, description: "A wild Pokémon rustles through the underbrush.", level: 16, cap: 19 },
  { type: StageType.Catch, description: "Another wild Pokémon catches your eye.", level: 19, cap: 21 },
  {
    type: StageType.Battle,
    description: "A trainer blocks the path ahead.",
    opponentTeam: buildOpponentTeam(3, 355),
    level: 22,
    cap: 24,
  },
  {
    type: StageType.Battle,
    description: "A trainer blocks the path ahead.",
    opponentTeam: buildOpponentTeam(6, 280),
    level: 25,
    cap: 27,
  },
  {
    type: StageType.Battle,
    description: "Yet another trainer wants to test their team.",
    opponentTeam: buildOpponentTeam(3, 383),
    level: 28,
    cap: 30,
  },
  { type: StageType.Catch, description: "A wild Pokémon rustles through the underbrush.", level: 31, cap: 32 },
  { type: StageType.Catch, description: "Another wild Pokémon catches your eye.", level: 34, cap: 35 },
  {
    type: StageType.Battle,
    description: "A baby trainer squares up for a fight.",
    opponentTeam: buildOpponentTeam(2, 470),
    level: 37,
    cap: 38,
  },
  {
    type: StageType.Battle,
    description: "A trainer squares up for a fight.",
    opponentTeam: buildOpponentTeam(4, 410),
    level: 41,
    cap: 42,
  },
  {
    type: StageType.Battle,
    description: "Another battle looms ahead.",
    opponentTeam: buildOpponentTeam(4, 438),
    level: 45,
    cap: 46,
  },
  { type: StageType.Catch, description: "Another wild Pokémon appears nearby.", level: 49, cap: 49 },
  {
    type: StageType.Catch,
    description: "A final wild Pokémon appears before the road gets tougher.",
    level: 53,
    cap: 53,
  },
  {
    type: StageType.Battle,
    description: "A tough trainer stands in your way.",
    opponentTeam: buildOpponentTeam(1, 600),
    level: 57,
    cap: 57,
  },
  {
    type: StageType.Battle,
    description: "A tough trainer stands in your way.",
    opponentTeam: buildOpponentTeam(5, 465),
    level: 60,
    cap: 60,
  },
  {
    type: StageType.Battle,
    description: "The battles keep coming.",
    opponentTeam: buildOpponentTeam(3, 520),
    level: 63,
    cap: 63,
  },
  {
    type: StageType.Battle,
    description: "One final trainer challenges you.",
    opponentTeam: buildOpponentTeam(6, 530),
    level: 65,
    cap: 65,
  },
]);
