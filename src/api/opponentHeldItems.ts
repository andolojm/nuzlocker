import type { Item } from "./pikaserve";

/**
 * Locally-curated set of held items opposing Pokemon are allowed to carry, edited from the dev
 * tools (see components/OpponentHeldItemEditor). Stored as an allowlist rather than the exclusion
 * list moveVisibility.ts keeps, since most of the ~170 usable hold items are too situational to
 * hand an opponent at random and the interesting set is the small one.
 */
export const OPPONENT_HELD_ITEMS_STORAGE_KEY = "nuzlocker:opponent-held-items";

/** Starting allowlist for anyone with no saved preference yet: items that do something useful on
 * any Pokemon, whatever its typing or moveset. */
export const DEFAULT_OPPONENT_HELD_ITEM_IDS: readonly number[] = [
  213, // Bright Powder
  214, // White Herb
  217, // Quick Claw
  219, // Mental Herb
  220, // Choice Band
  221, // King's Rock
  230, // Focus Band
  232, // Scope Lens
  233, // Metal Coat
  234, // Leftovers
  238, // Hard Stone
  244, // Sharp Beak
  250, // Dragon Fang
  253, // Shell Bell
  255, // Lax Incense
  265, // Wide Lens
  266, // Muscle Band
  267, // Wise Glasses
  268, // Expert Belt
  270, // Life Orb
  275, // Focus Sash
  276, // Zoom Lens
  277, // Metronome
  287, // Choice Scarf
  297, // Choice Specs
  326, // Razor Claw
  327, // Razor Fang
  540, // Rocky Helmet
  542, // Red Card
  545, // Absorb Bulb
  547, // Eject Button
  639, // Weakness Policy
  640, // Assault Vest
  648, // Luminous Moss
  649, // Snowball
  650, // Safety Goggles
  880, // Protective Pads
  1119, // Eject Pack
  1121, // Blunder Policy
  1123, // Utility Umbrella
];

function getStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function readEnabledIds(): Set<number> {
  const storage = getStorage();
  if (!storage) return new Set(DEFAULT_OPPONENT_HELD_ITEM_IDS);
  try {
    const raw = storage.getItem(OPPONENT_HELD_ITEMS_STORAGE_KEY);
    if (!raw) return new Set(DEFAULT_OPPONENT_HELD_ITEM_IDS);
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(Number)) : new Set(DEFAULT_OPPONENT_HELD_ITEM_IDS);
  } catch {
    return new Set(DEFAULT_OPPONENT_HELD_ITEM_IDS);
  }
}

let enabledIds = readEnabledIds();

/** Item ids opposing Pokemon may currently be given. An empty set means they hold nothing. */
export function getOpponentHeldItemIds(): Set<number> {
  return new Set(enabledIds);
}

/** Replaces the full allowlist and persists it. */
export function setOpponentHeldItemIds(ids: Iterable<number>): void {
  enabledIds = new Set(ids);
  getStorage()?.setItem(OPPONENT_HELD_ITEMS_STORAGE_KEY, JSON.stringify([...enabledIds]));
}

export function isOpponentHeldItemEnabled(item: Pick<Item, "id">): boolean {
  return enabledIds.has(item.id);
}
