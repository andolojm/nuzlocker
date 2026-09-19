import itemsData from "../vendor/pokemon-data/items.json";
import { isBerry } from "./berries";
import type { Item } from "./pikaserve";

/**
 * Berries opposing Pokemon are allowed to carry, edited from the dev tools (see
 * components/OpponentBerryEditor). Stored as an allowlist, like opponentHeldItems.
 */
export const OPPONENT_BERRIES_STORAGE_KEY = "nuzlocker:opponent-berries";

/**
 * Every berry that does something in battle. Unlike the hold items, a pooled berry is useful on any
 * Pokemon whatever its typing, so the starting allowlist is the whole pool rather than a hand-picked
 * subset — which also means there's no second list here to keep in step with berries.ts.
 */
export const DEFAULT_OPPONENT_BERRY_IDS: readonly number[] = (itemsData as unknown as Item[])
  .filter(isBerry)
  .map((berry) => berry.id);

function getStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readEnabledIds(): Set<number> {
  const storage = getStorage();
  if (!storage) return new Set(DEFAULT_OPPONENT_BERRY_IDS);
  try {
    const raw = storage.getItem(OPPONENT_BERRIES_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_OPPONENT_BERRY_IDS);
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(Number)) : new Set(DEFAULT_OPPONENT_BERRY_IDS);
  } catch {
    return new Set(DEFAULT_OPPONENT_BERRY_IDS);
  }
}

let enabledIds = readEnabledIds();

/** Berry ids opposing Pokemon may currently be given. An empty set means they're never given one. */
export function getOpponentBerryIds(): Set<number> {
  return new Set(enabledIds);
}

/** Replaces the full allowlist and persists it. */
export function setOpponentBerryIds(ids: Iterable<number>): void {
  enabledIds = new Set(ids);
  getStorage()?.setItem(OPPONENT_BERRIES_STORAGE_KEY, JSON.stringify([...enabledIds]));
}

export function isOpponentBerryEnabled(item: Pick<Item, "id">): boolean {
  return enabledIds.has(item.id);
}
