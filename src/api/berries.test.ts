import { Dex } from "@pkmn/sim";
import { BERRY_TYPE, EXCLUDED_BERRY_IDS, isBerry } from "./berries";
import { PikaLocal } from "./pikaLocal";
import itemsData from "../vendor/pokemon-data/items.json";
import type { Item } from "./pikaserve";

const items = itemsData as unknown as Item[];
const allBerries = items.filter((item) => item.type === BERRY_TYPE);

/** A berry does nothing in a battle unless the sim gives it at least one real handler. */
function hasNoBattleEffect(berry: Item): boolean {
  const dexItem = Dex.items.get(berry.name.english);
  if (!dexItem.exists) return true;
  const entries = dexItem as unknown as Record<string, unknown>;
  return !Object.keys(entries).some((key) => key.startsWith("on") && typeof entries[key] === "function");
}

describe("berry pool", () => {
  it("excludes exactly the berries that would never trigger in a battle", () => {
    const inert = allBerries.filter(hasNoBattleEffect).map((berry) => berry.id);

    expect([...EXCLUDED_BERRY_IDS].sort((a, b) => a - b)).toEqual(inert.sort((a, b) => a - b));
  });

  it("pools only berries, and only ones that do something", async () => {
    const pool = await PikaLocal.getAllBerries();

    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((berry) => berry.type === BERRY_TYPE)).toBe(true);
    expect(pool.filter(hasNoBattleEffect)).toEqual([]);
  });

  it("getRandomBerry draws from the pool", async () => {
    const pool = await PikaLocal.getAllBerries();

    expect(await PikaLocal.getRandomBerry(() => 0)).toBe(pool[0]);
    expect(await PikaLocal.getRandomBerry(() => 0.999999)).toBe(pool[pool.length - 1]);
  });

  it("recognises a berry but not a hold item", () => {
    const sitrus = allBerries.find((berry) => berry.name.english === "Sitrus Berry")!;
    const razz = allBerries.find((berry) => berry.name.english === "Razz Berry")!;
    const leftovers = items.find((item) => item.name.english === "Leftovers")!;

    expect(isBerry(sitrus)).toBe(true);
    expect(isBerry(razz)).toBe(false);
    expect(isBerry(leftovers)).toBe(false);
  });
});
