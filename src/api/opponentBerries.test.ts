/**
 * @jest-environment jsdom
 */
import { isBerry } from "./berries";
import itemsData from "../vendor/pokemon-data/items.json";
import {
  DEFAULT_OPPONENT_BERRY_IDS,
  OPPONENT_BERRIES_STORAGE_KEY,
  getOpponentBerryIds,
  setOpponentBerryIds,
} from "./opponentBerries";
import { setOpponentHeldItemIds } from "./opponentHeldItems";
import { PikaLocal } from "./pikaLocal";
import type { Item } from "./pikaserve";

const items = itemsData as unknown as Item[];

/** See opponentHeldItems.test.ts: only this small module is re-imported, never PikaLocal. */
async function reload() {
  let module!: typeof import("./opponentBerries");
  await jest.isolateModulesAsync(async () => {
    module = await import("./opponentBerries");
  });
  return module;
}

const SITRUS = items.find((item) => item.name.english === "Sitrus Berry")!.id;
const LUM = items.find((item) => item.name.english === "Lum Berry")!.id;
const LEFTOVERS = items.find((item) => item.name.english === "Leftovers")!.id;

describe("opponent berries", () => {
  beforeEach(() => {
    localStorage.clear();
    setOpponentBerryIds(DEFAULT_OPPONENT_BERRY_IDS);
    localStorage.clear();
  });

  it("starts from the whole berry pool", async () => {
    const pool = await PikaLocal.getAllBerries();

    expect(DEFAULT_OPPONENT_BERRY_IDS).toEqual(pool.map((berry) => berry.id));
    expect(items.filter((item) => DEFAULT_OPPONENT_BERRY_IDS.includes(item.id)).every(isBerry)).toBe(true);
    expect((await reload()).getOpponentBerryIds()).toEqual(new Set(DEFAULT_OPPONENT_BERRY_IDS));
  });

  it("persists a replaced allowlist and reads it back on reload", async () => {
    setOpponentBerryIds([SITRUS]);

    expect(JSON.parse(localStorage.getItem(OPPONENT_BERRIES_STORAGE_KEY)!)).toEqual([SITRUS]);
    expect(getOpponentBerryIds()).toEqual(new Set([SITRUS]));
    expect((await reload()).getOpponentBerryIds()).toEqual(new Set([SITRUS]));
  });

  it("keeps an empty allowlist rather than falling back to the defaults", async () => {
    setOpponentBerryIds([]);

    expect((await reload()).getOpponentBerryIds()).toEqual(new Set());
  });

  describe("getRandomOpponentItem", () => {
    beforeEach(() => {
      setOpponentBerryIds([SITRUS, LUM]);
      setOpponentHeldItemIds([LEFTOVERS]);
    });

    it("draws a berry on a low roll and a held item on a high one", async () => {
      const berry = await PikaLocal.getRandomOpponentItem(() => 0.1);
      const heldItem = await PikaLocal.getRandomOpponentItem(() => 0.9);

      expect(berry?.type).toBe("Berries");
      expect(heldItem?.name.english).toBe("Leftovers");
    });

    it("holds nothing rather than falling through when the rolled side is empty", async () => {
      setOpponentBerryIds([]);

      expect(await PikaLocal.getRandomOpponentItem(() => 0.1)).toBeUndefined();
      expect((await PikaLocal.getRandomOpponentItem(() => 0.9))?.name.english).toBe("Leftovers");
    });

    it("splits roughly evenly between berries and held items over many draws", async () => {
      let berries = 0;
      const rolls = 400;
      let seed = 1;
      const random = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };

      for (let i = 0; i < rolls; i++) {
        const drawn = await PikaLocal.getRandomOpponentItem(random);
        if (drawn?.type === "Berries") berries++;
      }

      expect(berries).toBeGreaterThan(rolls * 0.4);
      expect(berries).toBeLessThan(rolls * 0.6);
    });
  });
});
