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

/**
 * Each Catch stage's `strength` (bst constraint passed to encounterPokemon), hand-set here so the
 * run's wild-encounter difficulty curve can be balanced directly instead of via a formula. These
 * were originally computed by linearly scaling 300-575 across the run's 13 Catch stages.
 */
export const STAGES: Stage[] = [
  {
    type: StageType.InitialChoice,
    level: 2,
    cap: 6,
  },
  {
    type: StageType.Catch,
    strength: 300,
    level: 2,
    cap: 6,
    ballBonus: 1,
  },
  {
    type: StageType.Catch,
    strength: 323,
    level: 3,
    cap: 6,
    ballBonus: 1,
  },
  {
    type: StageType.Catch,
    strength: 346,
    level: 2,
    cap: 6,
    ballBonus: 1,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(2, 280),
    level: 8,
    cap: 14,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(2, 328),
    level: 10,
    cap: 14,
  },
    {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(2, 348),
    level: 12,
    cap: 14,
  },
  {
    type: StageType.Catch,
    strength: 369,
    level: 12,
    cap: 20,
    ballBonus: 1,
  },
  {
    type: StageType.Catch,
    strength: 392,
    level: 13,
    cap: 20,
    ballBonus: 1.5,
  },
  {
    type: StageType.Catch,
    strength: 415,
    level: 13,
    cap: 20,
    ballBonus: 1.5,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(3, 355),
    level: 16,
    cap: 20,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(6, 280),
    level: 18,
    cap: 20,
  },
  {
    type: StageType.Catch,
    strength: 438,
    level: 18,
    cap: 26,
    ballBonus: 1.5,
  },
  {
    type: StageType.Catch,
    strength: 460,
    level: 20,
    cap: 26,
    ballBonus: 1.5,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(3, 311),
    level: 21,
    cap: 26,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(3, 383),
    level: 23,
    cap: 26,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(1, 500),
    level: 23,
    cap: 26,
  },
  {
    type: StageType.Catch,
    strength: 483,
    level: 25,
    cap: 35,
    ballBonus: 1.5,
  },
  {
    type: StageType.Catch,
    strength: 506,
    level: 26,
    cap: 35,
    ballBonus: 2,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(2, 470),
    level: 31,
    cap: 35,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(4, 410),
    level: 33,
    cap: 35,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(3, 460),
    level: 34,
    cap: 35,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(3, 450),
    level: 35,
    cap: 44,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(3, 470),
    level: 36,
    cap: 44,
  },
  {
    type: StageType.Catch,
    strength: 529,
    level: 28,
    cap: 44,
    ballBonus: 2,
  },
  {
    type: StageType.Catch,
    strength: 552,
    level: 29,
    cap: 44,
    ballBonus: 2,
  },
  {
    type: StageType.Catch,
    strength: 575,
    level: 40,
    cap: 44,
    ballBonus: 2,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(2, 600),
    level: 41,
    cap: 44,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(5, 465),
    level: 51,
    cap: 55,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(3, 520),
    level: 53,
    cap: 55,
  },
  {
    type: StageType.Battle,
    opponentTeam: buildOpponentTeam(6, 535),
    level: 55,
    cap: 55,
  },
];

/**
 * Position of the stage at `stageIndex` among all stages of its own type, e.g. the 4th of 12 Catch
 * stages. Used to number the stage header ("Wild Pokemon #4/12").
 */
export function stageTypePosition(stageIndex: number): { position: number; total: number } {
  const type = STAGES[stageIndex]?.type;
  const sameType = STAGES.filter((stage) => stage.type === type);
  const position = STAGES.slice(0, stageIndex + 1).filter((stage) => stage.type === type).length;
  return { position, total: sameType.length };
}

/**
 * The stretch of upcoming stages up to (and not past) the next stage-type change: its type and how
 * many stages it contains. If more stages of the current type are still ahead, that's the block; once
 * they run out, it's the next differently-typed run. Used for the "Next: 3 Battles" sub-header.
 * Returns null if no stages remain.
 */
export function nextStageBlock(stageIndex: number): { type: StageType; count: number } | null {
  let i = stageIndex + 1;
  if (i >= STAGES.length) return null;
  // The run the next stage belongs to, whether that continues the current type or starts a new one.
  const type = STAGES[i].type;
  let count = 0;
  while (i < STAGES.length && STAGES[i].type === type) {
    count++;
    i++;
  }
  return { type, count };
}
