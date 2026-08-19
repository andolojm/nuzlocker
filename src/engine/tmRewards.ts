import { PikaLocal } from "../api/pikaLocal";
import { gameStateEngine } from "./gameStateEngine";
import type { GameStateEngine, OwnedTM } from "./gameStateEngine";

export const VICTORY_TM_COUNT = 2;
export const CATCH_TM_COUNT = 1;

async function awardTMs(count: number, engine: GameStateEngine): Promise<OwnedTM[]> {
  const tms = await Promise.all(Array.from({ length: count }, () => PikaLocal.getRandomTM()));
  for (const tm of tms) engine.addTM(tm);
  return tms;
}

/** Awards VICTORY_TM_COUNT random TMs for winning a battle. */
export function awardVictoryTMs(engine: GameStateEngine = gameStateEngine): Promise<OwnedTM[]> {
  return awardTMs(VICTORY_TM_COUNT, engine);
}

/** Awards CATCH_TM_COUNT random TM(s) for successfully catching a wild Pokemon. */
export function awardCatchTM(engine: GameStateEngine = gameStateEngine): Promise<OwnedTM[]> {
  return awardTMs(CATCH_TM_COUNT, engine);
}
