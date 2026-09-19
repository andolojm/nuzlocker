import type { Item } from "./pikaserve";

/** items.json's `type` for berries, which a Pokemon holds the same way it holds any other item. */
export const BERRY_TYPE = "Berries";

/** Berries `@pkmn/sim`'s dex has no entry for at all — Go-only variants upstream still lists. */
const UNKNOWN_TO_SIM_IDS: readonly number[] = [
  861, // Silver Razz Berry
  862, // Golden Razz Berry
  863, // Silver Nanab Berry
  864, // Golden Nanab Berry
  865, // Silver Pinap Berry
  866, // Golden Pinap Berry
];

/**
 * Berries the sim knows but that do nothing in a battle: the EV-lowering ones and the cooking or
 * Poké Block berries, which carry no handler beyond being edible. berries.test.ts re-derives this
 * set from the sim's own data, so a refresh that shifts it fails there rather than handing out a
 * berry that never triggers.
 */
const NO_BATTLE_EFFECT_IDS: readonly number[] = [
  164, // Razz Berry
  165, // Bluk Berry
  166, // Nanab Berry
  167, // Wepear Berry
  168, // Pinap Berry
  170, // Kelpsy Berry
  171, // Qualot Berry
  172, // Hondew Berry
  173, // Grepa Berry
  174, // Tamato Berry
  175, // Cornn Berry
  176, // Magost Berry
  177, // Rabuta Berry
  178, // Nomel Berry
  179, // Spelon Berry
  180, // Pamtre Berry
  181, // Watmel Berry
  182, // Durin Berry
  183, // Belue Berry
];

export const EXCLUDED_BERRY_IDS: ReadonlySet<number> = new Set([
  ...UNKNOWN_TO_SIM_IDS,
  ...NO_BATTLE_EFFECT_IDS,
]);

/** Whether `item` is a berry that actually triggers in battle. */
export function isBerry(item: Item): boolean {
  return item.type === BERRY_TYPE && !EXCLUDED_BERRY_IDS.has(item.id);
}
