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
    level: 2,
    cap: 6,
    ballBonus: 1,
  },
  { type: StageType.Catch, description: "Another wild Pokémon appears nearby.", level: 3, cap: 6, ballBonus: 1 },
  {
    type: StageType.Catch,
    description: "One more wild Pokémon crosses your path.",
    level: 5,
    cap: 14,
    ballBonus: 1,
  },
  {
    type: StageType.Battle,
    description: "A trainer challenges you to a battle.",
    opponentTeam: buildOpponentTeam(2, 280),
    level: 8,
    cap: 14,
  },
  {
    type: StageType.Battle,
    description: "Another trainer steps forward, ready to fight.",
    opponentTeam: buildOpponentTeam(2, 328),
    level: 12,
    cap: 14,
  },
  {
    type: StageType.Catch,
    description: "A wild Pokémon rustles through the underbrush.",
    level: 12,
    cap: 20,
    ballBonus: 1,
  },
  {
    type: StageType.Catch,
    description: "Another wild Pokémon catches your eye.",
    level: 13,
    cap: 20,
    ballBonus: 1.5,
  },
  {
    type: StageType.Battle,
    description: "A trainer blocks the path ahead.",
    opponentTeam: buildOpponentTeam(3, 355),
    level: 16,
    cap: 20,
  },
  {
    type: StageType.Battle,
    description: "A trainer blocks the path ahead.",
    opponentTeam: buildOpponentTeam(6, 280),
    level: 18,
    cap: 20,
  },
  {
    type: StageType.Catch,
    description: "A wild Pokémon rustles through the underbrush.",
    level: 18,
    cap: 26,
    ballBonus: 1.5,
  },
  {
    type: StageType.Catch,
    description: "Another wild Pokémon catches your eye.",
    level: 20,
    cap: 26,
    ballBonus: 1.5,
  },
    {
    type: StageType.Battle,
    description: "A trainer blocks the path ahead.",
    opponentTeam: buildOpponentTeam(3, 311),
    level: 22,
    cap: 26,
  },
  {
    type: StageType.Battle,
    description: "Yet another trainer wants to test their team.",
    opponentTeam: buildOpponentTeam(3, 383),
    level: 24,
    cap: 26,
  },
  {
    type: StageType.Catch,
    description: "A wild Pokémon rustles through the underbrush.",
    level: 25,
    cap: 34,
    ballBonus: 1.5,
  },
  {
    type: StageType.Catch,
    description: "Another wild Pokémon catches your eye.",
    level: 26,
    cap: 34,
    ballBonus: 2,
  },
  {
    type: StageType.Battle,
    description: "A baby trainer squares up for a fight.",
    opponentTeam: buildOpponentTeam(2, 470),
    level: 31,
    cap: 34,
  },
  {
    type: StageType.Battle,
    description: "A trainer squares up for a fight.",
    opponentTeam: buildOpponentTeam(4, 410),
    level: 33,
    cap: 34,
  },
  {
    type: StageType.Battle,
    description: "Another battle looms ahead.",
    opponentTeam: buildOpponentTeam(3, 460),
    level: 34,
    cap: 34,
  },
  {
    type: StageType.Catch,
    description: "Another wild Pokémon appears nearby.",
    level: 32,
    cap: 41,
    ballBonus: 2,
  },
  {
    type: StageType.Catch,
    description: "A final wild Pokémon appears before the road gets tougher.",
    level: 33,
    cap: 41,
    ballBonus: 2,
  },
  {
    type: StageType.Battle,
    description: "A tough trainer stands in your way.",
    opponentTeam: buildOpponentTeam(2, 600),
    level: 41,
    cap: 41,
  },
  {
    type: StageType.Battle,
    description: "A tough trainer stands in your way.",
    opponentTeam: buildOpponentTeam(5, 465),
    level: 46,
    cap: 46,
  },
  {
    type: StageType.Battle,
    description: "The battles keep coming.",
    opponentTeam: buildOpponentTeam(3, 520),
    level: 50,
    cap: 50,
  },
  {
    type: StageType.Battle,
    description: "One final trainer challenges you.",
    opponentTeam: buildOpponentTeam(6, 530),
    level: 53,
    cap: 53,
  },
]);
