/**
 * @jest-environment jsdom
 */
import { isHeldItem } from "./heldItems";
import itemsData from "../vendor/pokemon-data/items.json";
import {
  DEFAULT_OPPONENT_HELD_ITEM_IDS,
  OPPONENT_HELD_ITEMS_STORAGE_KEY,
  getOpponentHeldItemIds,
  isOpponentHeldItemEnabled,
  setOpponentHeldItemIds,
} from "./opponentHeldItems";
import { PikaLocal } from "./pikaLocal";
import type { Item } from "./pikaserve";

const items = itemsData as unknown as Item[];

/**
 * The allowlist is read from storage once at module load, so the cases covering that read re-import
 * this one small module with storage already seeded. PikaLocal is deliberately left out of the
 * isolated registry — it would reload every vendored data file with it.
 */
async function reload() {
  let module!: typeof import("./opponentHeldItems");
  await jest.isolateModulesAsync(async () => {
    module = await import("./opponentHeldItems");
  });
  return module;
}

describe("opponent held items", () => {
  beforeEach(() => {
    localStorage.clear();
    setOpponentHeldItemIds(DEFAULT_OPPONENT_HELD_ITEM_IDS);
    localStorage.clear();
  });

  it("starts from the curated allowlist, and every default is a real held item", async () => {
    const defaults = items.filter((item) => DEFAULT_OPPONENT_HELD_ITEM_IDS.includes(item.id));

    expect(defaults).toHaveLength(DEFAULT_OPPONENT_HELD_ITEM_IDS.length);
    expect(defaults.filter((item) => !isHeldItem(item))).toEqual([]);
    expect((await reload()).getOpponentHeldItemIds()).toEqual(new Set(DEFAULT_OPPONENT_HELD_ITEM_IDS));
  });

  it("persists a replaced allowlist and reads it back on reload", async () => {
    setOpponentHeldItemIds([234, 270]);

    expect(JSON.parse(localStorage.getItem(OPPONENT_HELD_ITEMS_STORAGE_KEY)!)).toEqual([234, 270]);
    expect(getOpponentHeldItemIds()).toEqual(new Set([234, 270]));
    expect(isOpponentHeldItemEnabled({ id: 234 })).toBe(true);
    expect(isOpponentHeldItemEnabled({ id: 275 })).toBe(false);
    expect((await reload()).getOpponentHeldItemIds()).toEqual(new Set([234, 270]));
  });

  it("keeps an empty allowlist rather than falling back to the defaults", async () => {
    setOpponentHeldItemIds([]);

    expect((await reload()).getOpponentHeldItemIds()).toEqual(new Set());
  });

  it("falls back to the defaults when storage holds junk", async () => {
    localStorage.setItem(OPPONENT_HELD_ITEMS_STORAGE_KEY, "not json");

    expect((await reload()).getOpponentHeldItemIds()).toEqual(new Set(DEFAULT_OPPONENT_HELD_ITEM_IDS));
  });

  describe("getRandomOpponentHeldItem", () => {
    it("only ever draws an enabled item", async () => {
      setOpponentHeldItemIds([234, 270]);

      const first = await PikaLocal.getRandomOpponentHeldItem(() => 0);
      const last = await PikaLocal.getRandomOpponentHeldItem(() => 0.999999);

      expect([first?.id, last?.id].sort()).toEqual([234, 270]);
    });

    it("returns undefined when nothing is enabled, so opponents hold nothing", async () => {
      setOpponentHeldItemIds([]);

      expect(await PikaLocal.getRandomOpponentHeldItem()).toBeUndefined();
    });
  });
});
