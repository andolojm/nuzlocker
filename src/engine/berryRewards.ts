import { PikaLocal } from "../api/pikaLocal";
import type { Item } from "../api/pikaserve";
import { gameStateEngine } from "./gameStateEngine";
import type { GameStateEngine } from "./gameStateEngine";

/** Matches VICTORY_HELD_ITEM_COUNT — a win hands out as many berries as it does held items. */
export const VICTORY_BERRY_COUNT = 2;
/** Matches CATCH_HELD_ITEM_COUNT. */
export const CATCH_BERRY_COUNT = 1;

async function awardBerries(count: number, engine: GameStateEngine): Promise<Item[]> {
  const berries = await Promise.all(Array.from({ length: count }, () => PikaLocal.getRandomBerry()));
  for (const berry of berries) engine.addItem(berry);
  return berries;
}

/** Awards VICTORY_BERRY_COUNT random berries for winning a battle. */
export function awardVictoryBerries(engine: GameStateEngine = gameStateEngine): Promise<Item[]> {
  return awardBerries(VICTORY_BERRY_COUNT, engine);
}

/** Awards CATCH_BERRY_COUNT random berry/berries for successfully catching a wild Pokemon. */
export function awardCatchBerries(engine: GameStateEngine = gameStateEngine): Promise<Item[]> {
  return awardBerries(CATCH_BERRY_COUNT, engine);
}
