import type { BattleRequest } from "./battleSimulator";
import { catchFailureMessage, isForcedContinuation } from "./useBattleController";

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
