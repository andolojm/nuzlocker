import type { Item } from "./pikaserve";
import { isTMItem, parseTMMoveNames } from "./pikaserve";

describe("parseTMMoveNames", () => {
  it("parses a single-move description", () => {
    expect(parseTMMoveNames("Teaches the move Cut.")).toEqual(["Cut"]);
  });

  it("parses a multi-move description into separate names", () => {
    expect(parseTMMoveNames("Teaches the move Mega Punch/Dynamic Punch/Focus Punch.")).toEqual([
      "Mega Punch",
      "Dynamic Punch",
      "Focus Punch",
    ]);
  });
});

function buildMachineItem(overrides: Partial<Item> = {}): Item {
  return { id: 1, type: "Machines", description: "Teaches the move Cut.", name: { english: "TM01" }, ...overrides };
}

describe("isTMItem", () => {
  it("accepts a Machines item with a well-formed \"Teaches the move\" description", () => {
    expect(isTMItem(buildMachineItem())).toBe(true);
  });

  it("rejects a non-Machines item", () => {
    expect(isTMItem(buildMachineItem({ type: "Pokeballs" }))).toBe(false);
  });

  // Gen 8 TRs share item type "Machines" but most describe the move's in-battle effect instead of
  // naming it (e.g. "The user drops onto the target..."), which parseTMMoveNames can't resolve to a
  // real move — see tmRewards.ts's resolveTM. A few TRs (TR00, TR51, TR81, TR84 in the vendored
  // data) happen to have a well-formed description and are correctly still accepted.
  it("rejects a Machines item whose description doesn't name a move", () => {
    const tr = buildMachineItem({
      name: { english: "TR01" },
      description: "The user drops onto the target with its full body weight.",
    });
    expect(isTMItem(tr)).toBe(false);
  });
});
