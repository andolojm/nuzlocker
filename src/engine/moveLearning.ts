import { PikaLocal } from "../api/pikaLocal";
import type { Move } from "../api/pikaserve";

/**
 * Levels at which every Pokemon learns a new move. There's no per-species learnset data (and
 * movesets in this game are already fully randomized rather than species-accurate), so these
 * levels are the same for every Pokemon and the move learned is simply rolled at random.
 */
export const LEVEL_UP_MOVE_LEVELS = [6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 44, 48, 52, 56, 60, 62, 65];

/** The next move-learning milestone strictly after `currentLevel`, if any. */
export function nextMoveLearnLevel(currentLevel: number): number | undefined {
  return LEVEL_UP_MOVE_LEVELS.find((level) => level > currentLevel);
}

/** Rolls a random move via PikaLocal, re-rolling if it duplicates one the Pokemon already knows. */
export async function rollLearnableMove(knownMoves: readonly Move[]): Promise<Move> {
  const knownIds = new Set(knownMoves.map((move) => move.id));

  let move: Move;
  do {
    move = await PikaLocal.getRandomMove();
  } while (knownIds.has(move.id));

  return move;
}
