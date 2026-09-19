import { Dex } from "@pkmn/sim";
import itemsData from "../vendor/pokemon-data/items.json";
import { EXCLUDED_HELD_ITEM_IDS, HELD_ITEM_TYPE, isHeldItem } from "./heldItems";
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

    expect([...EXCLUDED_HELD_ITEM_IDS].sort((a, b) => a - b)).toEqual([...unusable].sort((a, b) => a - b));
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
