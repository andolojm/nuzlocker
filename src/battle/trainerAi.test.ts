import type { BattleRequest, MoveOption } from "./battleSimulator";
import { chooseTrainerMove } from "./trainerAi";

function buildMoveOption(name: string, disabled = false): MoveOption {
  return { choice: `move ${name}`, name, disabled };
}

function buildRequest(overrides: Partial<BattleRequest> = {}): BattleRequest {
  return {
    forceSwitch: false,
    moves: [],
    switches: [],
    canAttemptCatch: false,
    ...overrides,
  };
}

const noJitter = () => 0.5; // lands exactly on the un-jittered score

describe("chooseTrainerMove", () => {
  it("picks the super-effective STAB move over a resisted one", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Flamethrower"), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Fire"] },
      defender: { types: ["Grass"] },
      rng: noJitter,
    });

    expect(choice).toBe("move Flamethrower");
  });

  it("avoids an immune move when a usable alternative exists", () => {
    const request = buildRequest({
      // Normal-type move into a Ghost-type defender is a 0x immunity.
      moves: [buildMoveOption("Tackle"), buildMoveOption("Shadow Ball")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Normal"] },
      defender: { types: ["Ghost"] },
      rng: noJitter,
    });

    expect(choice).toBe("move Shadow Ball");
  });

  it("falls back to the only usable move even if it's immune", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Normal"] },
      defender: { types: ["Ghost"] },
      rng: noJitter,
    });

    expect(choice).toBe("move Tackle");
  });

  it("weighs a status move against a weak, neutral attack", () => {
    const request = buildRequest({
      // Growl (Normal, status) vs Tackle (Normal, 40 power) into a neutral defender.
      moves: [buildMoveOption("Tackle"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Normal"] },
      defender: { types: ["Water"] },
      rng: noJitter,
    });

    // Tackle: 40 * 1(effectiveness) * 1.5(STAB) * 1(accuracy) = 60, beats Growl's flat 45 baseline.
    expect(choice).toBe("move Tackle");
  });

  it("skips disabled moves", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Flamethrower", true), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Fire"] },
      defender: { types: ["Grass"] },
      rng: noJitter,
    });

    expect(choice).toBe("move Tackle");
  });

  it("switches on a forced switch, ignoring moves entirely", () => {
    const request = buildRequest({
      forceSwitch: true,
      switches: [{ choice: "switch 2", name: "Caterpie" }],
      moves: [buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Normal"] },
      defender: { types: ["Water"] },
    });

    expect(choice).toBe("switch 2");
  });

  it("falls back to the first switch when no move is usable", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Tackle", true)],
      switches: [{ choice: "switch 3", name: "Caterpie" }],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Normal"] },
      defender: { types: ["Water"] },
    });

    expect(choice).toBe("switch 3");
  });

  it("falls back to move 1 when there is nothing else to do", () => {
    const request = buildRequest({ moves: [buildMoveOption("Tackle", true)] });

    const choice = chooseTrainerMove({
      request,
      attacker: { types: ["Normal"] },
      defender: { types: ["Water"] },
    });

    expect(choice).toBe("move 1");
  });
});
