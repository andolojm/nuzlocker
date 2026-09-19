import type { BattleRequest } from "./battleSimulator";
import { catchFailureMessage, isForcedContinuation, parseItemLoss } from "./useBattleController";

function buildRequest(overrides: Partial<BattleRequest> = {}): BattleRequest {
  return {
    forceSwitch: false,
    moves: [
      { choice: "move 1", name: "Tackle", disabled: false },
      { choice: "move 2", name: "Growl", disabled: false },
      { choice: "move 3", name: "Ember", disabled: false },
      { choice: "move 4", name: "Smokescreen", disabled: false },
    ],
    switches: [],
    canAttemptCatch: false,
    trapped: false,
    ...overrides,
  };
}

describe("isForcedContinuation", () => {
  it("is false for a normal turn with the full moveset offered", () => {
    expect(isForcedContinuation(buildRequest())).toBe(false);
  });

  it("is false for a forced switch, even though moves is empty", () => {
    expect(isForcedContinuation(buildRequest({ forceSwitch: true, moves: [] }))).toBe(false);
  });

  it("is true for a locked continuation move, e.g. Fly's second turn", () => {
    const request = buildRequest({ moves: [{ choice: "move 1", name: "Fly", disabled: false }] });
    expect(isForcedContinuation(request)).toBe(true);
  });

  it("is true for a forced recharge turn", () => {
    const request = buildRequest({ moves: [{ choice: "move 1", name: "Recharge", disabled: false }] });
    expect(isForcedContinuation(request)).toBe(true);
  });

  it("is true for Struggle (no valid moves at all)", () => {
    expect(isForcedContinuation(buildRequest({ moves: [] }))).toBe(true);
  });
});

describe("catchFailureMessage", () => {
  it("returns distinct, non-empty text for each shake count 0-3", () => {
    const messages = [0, 1, 2, 3].map(catchFailureMessage);
    expect(new Set(messages).size).toBe(4);
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
  });

  it("falls back to the 0-shake message for an out-of-range value", () => {
    expect(catchFailureMessage(99)).toBe(catchFailureMessage(0));
  });
});

describe("parseItemLoss", () => {
  it("reads the holder and item off an eaten berry", () => {
    expect(parseItemLoss("|-enditem|p1a: Eiscue|Sitrus Berry|[eat]")).toEqual({
      ident: "p1a: Eiscue",
      item: "Sitrus Berry",
    });
  });

  it("blames the Pokemon that lost a plucked berry, not the one that ate it", () => {
    // The player's Pokemon is the `[of]` actor here: its own berry must not be touched.
    const loss = parseItemLoss(
      "|-enditem|p2a: Budew|Sitrus Berry|[from] stealeat|[move] Pluck|[of] p1a: Eiscue",
    );

    expect(loss).toEqual({ ident: "p2a: Budew", item: "Sitrus Berry" });
  });

  it("blames the holder when a berry is burned off or knocked off", () => {
    expect(parseItemLoss("|-enditem|p1a: Eiscue|Tanga Berry|[from] move: Incinerate")?.ident).toBe("p1a: Eiscue");
    expect(
      parseItemLoss("|-enditem|p1a: Eiscue|Sitrus Berry|[from] move: Knock Off|[of] p2a: Budew")?.ident,
    ).toBe("p1a: Eiscue");
  });

  it("reads a spent hold item too, leaving the berry check to the caller", () => {
    expect(parseItemLoss("|-enditem|p1a: Steelix|Steel Gem|[from] gem")).toEqual({
      ident: "p1a: Steelix",
      item: "Steel Gem",
    });
  });

  it("ignores any other line", () => {
    expect(parseItemLoss("|-item|p1a: Eiscue|Air Balloon")).toBeNull();
    expect(parseItemLoss("|move|p1a: Eiscue|Pluck|p2a: Budew")).toBeNull();
    expect(parseItemLoss("|-enditem|p1a: Eiscue")).toBeNull();
  });
});
