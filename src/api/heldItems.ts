import type { Item } from "./pikaserve";

/** items.json's `type` for the items a Pokemon can carry into battle. */
export const HELD_ITEM_TYPE = "Hold items";

/**
 * Hold items `@pkmn/sim`'s dex has no entry for at all, plus Mega Stones and Z-Crystals, which it
 * knows but which do nothing in gen 9 (no Mega Evolution, no Z-moves). Ids are items.json ids;
 * heldItems.test.ts re-derives this set from the sim's own data, so a data refresh that shifts it
 * fails there rather than quietly handing out duds.
 */
export const UNUSABLE_IN_GEN9_IDS: readonly number[] = [
  216, 218, 223, 224, 228, 229, 231, 319, 320, 575, 633, 634, 635, 637, 642, 645, 656, 657, 658,
  659, 660, 661, 662, 663, 664, 665, 666, 667, 668, 669, 670, 671, 672, 673, 674, 675, 676, 677,
  678, 679, 680, 681, 682, 683, 684, 685, 695, 697, 700, 712, 752, 753, 754, 755, 756, 757, 758,
  759, 760, 761, 762, 763, 764, 765, 767, 768, 769, 770, 807, 808, 809, 810, 811, 812, 813, 814,
  815, 816, 817, 818, 819, 820, 821, 822, 823, 824, 825, 826, 827, 828, 829, 830, 831, 832, 833,
  834, 836, 853, 854, 855, 856, 927, 928, 929, 930, 931, 932, 1255,
];

/**
 * Hold items that work in gen 9 but only for one species, so on anyone else they do nothing:
 * the legendary orbs, Genesect's Drives, Silvally's Memories, and the rest. Items whose effect is
 * universal keep their place even when their description names a species for breeding or evolution
 * purposes (King's Rock, Metal Coat, the Incenses, the Plates) — those work on any holder.
 */
export const SPECIES_LOCKED_IDS: readonly number[] = [
  112, // Griseous Orb (Giratina)
  116, // Douse Drive (Genesect)
  117, // Shock Drive (Genesect)
  118, // Burn Drive (Genesect)
  119, // Chill Drive (Genesect)
  135, // Adamant Orb (Dialga)
  136, // Lustrous Orb (Palkia)
  225, // Soul Dew (Latios/Latias)
  226, // Deep Sea Tooth (Clamperl)
  227, // Deep Sea Scale (Clamperl)
  236, // Light Ball (Pikachu)
  256, // Lucky Punch (Chansey)
  257, // Metal Powder (Ditto)
  258, // Thick Club (Cubone/Marowak)
  259, // Leek (Farfetch'd)
  274, // Quick Powder (Ditto)
  904, 905, 906, 907, 908, 909, 910, 911, 912, // Memories (Silvally)
  913, 914, 915, 916, 917, 918, 919, 920,
];

/**
 * Hold items with no battle effect at all — they exist purely to evolve one species, so holding one
 * into a fight is the same as holding nothing.
 */
export const EVOLUTION_ONLY_IDS: readonly number[] = [
  1109, 1110, 1111, 1112, 1113, 1114, 1115, // Sweets (Milcery)
  1116, // Sweet Apple (Applin)
  1117, // Tart Apple (Applin)
  1253, // Cracked Pot (Sinistea)
  1254, // Chipped Pot (Sinistea)
];

/** Every hold item kept out of the pool the game hands out, for any of the reasons above. */
export const EXCLUDED_HELD_ITEM_IDS: ReadonlySet<number> = new Set([
  ...UNUSABLE_IN_GEN9_IDS,
  ...SPECIES_LOCKED_IDS,
  ...EVOLUTION_ONLY_IDS,
]);

/** Whether `item` is a hold item that does something for whichever Pokemon is carrying it. */
export function isHeldItem(item: Item): boolean {
  return item.type === HELD_ITEM_TYPE && !EXCLUDED_HELD_ITEM_IDS.has(item.id);
}
