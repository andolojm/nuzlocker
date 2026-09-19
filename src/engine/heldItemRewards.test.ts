/**
 * @jest-environment jsdom
 */
import { PikaLocal } from "../api/pikaLocal";
import type { Item } from "../api/pikaserve";
import { GameStateEngine } from "./gameStateEngine";
import {
  CATCH_HELD_ITEM_COUNT,
  VICTORY_HELD_ITEM_COUNT,
  awardCatchHeldItems,
  awardVictoryHeldItems,
} from "./heldItemRewards";

function buildItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 234,
    type: "Hold items",
    description: "Restores a little HP every turn.",
    name: { english: "Leftovers" },
    ...overrides,
  };
}

describe("awardVictoryHeldItems / awardCatchHeldItems", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("awardVictoryHeldItems draws VICTORY_HELD_ITEM_COUNT random items into the bag", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest
      .spyOn(PikaLocal, "getRandomHeldItem")
      .mockResolvedValueOnce(buildItem())
      .mockResolvedValueOnce(buildItem({ id: 275, name: { english: "Focus Sash" } }));

    const awarded = await awardVictoryHeldItems(engine);

    expect(randomSpy).toHaveBeenCalledTimes(VICTORY_HELD_ITEM_COUNT);
    expect(engine.current.bag).toEqual(awarded);
    expect(engine.current.bag.map((item) => item.name.english)).toEqual(["Leftovers", "Focus Sash"]);
  });

  it("awardCatchHeldItems draws CATCH_HELD_ITEM_COUNT random item(s)", async () => {
    const engine = new GameStateEngine();
    const randomSpy = jest.spyOn(PikaLocal, "getRandomHeldItem").mockResolvedValue(buildItem());

    const awarded = await awardCatchHeldItems(engine);

    expect(randomSpy).toHaveBeenCalledTimes(CATCH_HELD_ITEM_COUNT);
    expect(engine.current.bag).toEqual(awarded);
  });

  it("appends to whatever the bag already held", async () => {
    const engine = new GameStateEngine();
    engine.addItem(buildItem({ id: 269, name: { english: "Life Orb" } }));
    jest.spyOn(PikaLocal, "getRandomHeldItem").mockResolvedValue(buildItem());

    await awardCatchHeldItems(engine);

    expect(engine.current.bag).toHaveLength(2);
    expect(engine.current.bag[0].name.english).toBe("Life Orb");
  });
});
