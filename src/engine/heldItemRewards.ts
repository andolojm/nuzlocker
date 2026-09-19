import { PikaLocal } from "../api/pikaLocal";
import type { Item } from "../api/pikaserve";
import { gameStateEngine } from "./gameStateEngine";
import type { GameStateEngine } from "./gameStateEngine";

/** Matches VICTORY_TM_COUNT — a win hands out as many held items as it does TMs. */
export const VICTORY_HELD_ITEM_COUNT = 2;
/** Matches CATCH_TM_COUNT. */
export const CATCH_HELD_ITEM_COUNT = 1;

async function awardHeldItems(count: number, engine: GameStateEngine): Promise<Item[]> {
  const items = await Promise.all(Array.from({ length: count }, () => PikaLocal.getRandomHeldItem()));
  for (const item of items) engine.addItem(item);
  return items;
}

/** Awards VICTORY_HELD_ITEM_COUNT random held items for winning a battle. */
export function awardVictoryHeldItems(engine: GameStateEngine = gameStateEngine): Promise<Item[]> {
  return awardHeldItems(VICTORY_HELD_ITEM_COUNT, engine);
}

/** Awards CATCH_HELD_ITEM_COUNT random held item(s) for successfully catching a wild Pokemon. */
export function awardCatchHeldItems(engine: GameStateEngine = gameStateEngine): Promise<Item[]> {
  return awardHeldItems(CATCH_HELD_ITEM_COUNT, engine);
}
