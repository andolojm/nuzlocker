import { Dex } from "@pkmn/sim";
import itemsData from "../vendor/pokemon-data/items.json";
import {
  EVOLUTION_ONLY_IDS,
  HELD_ITEM_TYPE,
  SPECIES_LOCKED_IDS,
  UNUSABLE_IN_GEN9_IDS,
  isHeldItem,
} from "./heldItems";
import { PikaLocal } from "./pikaLocal";
import type { Item } from "./pikaserve";

const items = itemsData as unknown as Item[];
const holdItems = items.filter((item) => item.type === HELD_ITEM_TYPE);

/** The reason an item is excluded: unknown to the sim, or known but inert in gen 9. */
function isUnusableInGen9(item: Item): boolean {
  const dexItem = Dex.items.get(item.name.english);
  return !dexItem.exists || Boolean(dexItem.megaStone) || Boolean(dexItem.zMove);
}

describe("held item pool", () => {
  it("excludes exactly the hold items the gen 9 sim can't do anything with", () => {
    const unusable = new Set(holdItems.filter(isUnusableInGen9).map((item) => item.id));

    expect([...UNUSABLE_IN_GEN9_IDS].sort((a, b) => a - b)).toEqual([...unusable].sort((a, b) => a - b));
  });

  it("names a real hold item in every curated exclusion", () => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const curated = [...SPECIES_LOCKED_IDS, ...EVOLUTION_ONLY_IDS];

    const notHoldItems = curated.filter((id) => byId.get(id)?.type !== HELD_ITEM_TYPE);
    expect(notHoldItems).toEqual([]);
    expect(new Set(curated).size).toBe(curated.length);
  });

  it("pools no item the sim binds to a single species", async () => {
    const pool = await PikaLocal.getAllHeldItems();

    const speciesBound = pool.filter((item) => Dex.items.get(item.name.english).itemUser);
    expect(speciesBound.map((item) => item.name.english)).toEqual([]);
  });

  it("keeps items whose effect is universal even though their description names a species", async () => {
    const pool = await PikaLocal.getAllHeldItems();
    const names = pool.map((item) => item.name.english);

    // Each of these names a species only for a breeding or evolution side effect.
    expect(names).toEqual(
      expect.arrayContaining(["King's Rock", "Metal Coat", "Razor Claw", "Razor Fang", "Sea Incense", "Flame Plate"]),
    );
  });

  it("only pools items of the hold-item type", async () => {
    const pool = await PikaLocal.getAllHeldItems();

    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((item) => item.type === HELD_ITEM_TYPE)).toBe(true);
  });

  it("pools only items the sim will actually apply in battle", async () => {
    const pool = await PikaLocal.getAllHeldItems();

    expect(pool.filter(isUnusableInGen9)).toEqual([]);
  });

  it("getRandomHeldItem draws from the pool", async () => {
    const pool = await PikaLocal.getAllHeldItems();

    const first = await PikaLocal.getRandomHeldItem(() => 0);
    const last = await PikaLocal.getRandomHeldItem(() => 0.999999);

    expect(first).toBe(pool[0]);
    expect(last).toBe(pool[pool.length - 1]);
  });

  it("rejects non-hold items and excluded ones", () => {
    const masterBall = items.find((item) => item.name.english === "Master Ball");
    const megaStone = holdItems.find((item) => Dex.items.get(item.name.english).megaStone);

    expect(isHeldItem(masterBall!)).toBe(false);
    expect(isHeldItem(megaStone!)).toBe(false);
    expect(isHeldItem(holdItems.find((item) => item.name.english === "Leftovers")!)).toBe(true);
  });
});
