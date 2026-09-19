import type { Item } from "./pikaserve";

/** items.json's `type` for the items a Pokemon can carry into battle. */
export const HELD_ITEM_TYPE = "Hold items";

/**
 * Hold items kept out of the pool the game hands out: ones `@pkmn/sim`'s dex has no entry for at
 * all, plus Mega Stones and Z-Crystals, which it knows but which do nothing in gen 9 (no Mega
 * Evolution, no Z-moves) — awarding those would be awarding nothing. Ids are items.json ids;
 * heldItems.test.ts re-derives this set from the sim's own data, so a data refresh that shifts it
 * fails there rather than quietly handing out duds.
 */
export const EXCLUDED_HELD_ITEM_IDS: ReadonlySet<number> = new Set([
  216, 218, 223, 224, 228, 229, 231, 319, 320, 575, 633, 634, 635, 637, 642, 645, 656, 657, 658,
  659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677,
  678, 679, 680, 681, 682, 683, 684, 685, 695, 697, 700, 712, 752, 753, 754, 755, 756, 757, 758,
  759, 760, 761, 762, 763, 764, 765, 767, 768, 769, 770, 807, 808, 809, 810, 811, 812, 813, 814,
  815, 816, 817, 818, 819, 820, 821, 822, 823, 824, 825, 826, 827, 828, 829, 830, 831, 832, 833,
  834, 836, 853, 854, 855, 856, 927, 928, 929, 930, 931, 932, 1255,
]);

/** Whether `item` is a hold item the battle engine can actually do something with. */
export function isHeldItem(item: Item): boolean {
  return item.type === HELD_ITEM_TYPE && !EXCLUDED_HELD_ITEM_IDS.has(item.id);
}
