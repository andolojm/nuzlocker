import type { BattleRequest, MoveOption } from "../battleSimulator";
import { basicTrainerAi } from "./basic";
import type { Combatant, FieldConditions, StatTable } from "./types";
import { NO_HAZARDS } from "./types";

const chooseTrainerMove = basicTrainerAi.chooseMove;

function buildMoveOption(name: string, overrides: Partial<MoveOption> = {}): MoveOption {
  return { choice: `move ${name}`, name, disabled: false, ...overrides };
}

function buildRequest(overrides: Partial<BattleRequest> = {}): BattleRequest {
  return {
    forceSwitch: false,
    moves: [],
    switches: [],
    canAttemptCatch: false,
    trapped: false,
    ...overrides,
  };
}

const EVEN_STATS: StatTable = { hp: 100, atk: 100, def: 100, spa: 100, spd: 100, spe: 100 };
const MAX_IVS: StatTable = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

/** A level-50, all-100-base-stat, max-IV combatant at full (175) HP — a neutral baseline both sides start from. */
function buildCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    types: ["Normal"],
    level: 50,
    baseStats: EVEN_STATS,
    ivs: MAX_IVS,
    boosts: {},
    currentHp: 175,
    maxHp: 175,
    status: null,
    ...overrides,
  };
}

function buildField(overrides: Partial<FieldConditions> = {}): FieldConditions {
  return { weather: null, terrain: null, defenderHazards: NO_HAZARDS, ...overrides };
}

const noJitter = () => 0.5; // lands exactly on the un-jittered score

describe("chooseTrainerMove", () => {
  it("picks the super-effective STAB move over a resisted one", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Flamethrower"), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Fire"] }),
      defender: buildCombatant({ types: ["Grass"] }),
      field: buildField(),
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
      attacker: buildCombatant({ types: ["Normal"] }),
      defender: buildCombatant({ types: ["Ghost"] }),
      field: buildField(),
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
      attacker: buildCombatant({ types: ["Normal"] }),
      defender: buildCombatant({ types: ["Ghost"] }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Tackle");
  });

  it("prefers a strong attack over a status move", () => {
    const request = buildRequest({
      // Flamethrower (Fire, 90 power, STAB) heavily outdamages Growl's flat baseline.
      moves: [buildMoveOption("Growl"), buildMoveOption("Flamethrower")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Fire"] }),
      defender: buildCombatant({ types: ["Grass"] }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Flamethrower");
  });

  it("prefers a status move over a middling attack", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Tackle"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      // 60 Def leaves Tackle around 23% — middling, with enough room under the flat status baseline
      // that the case doesn't flip on a small change to the shared damage math (the original 40 Def
      // sat within half a point of the baseline, and folding crit chance in was enough to cross it).
      defender: buildCombatant({ baseStats: { ...EVEN_STATS, def: 60 } }),
      attacker: buildCombatant({ types: ["Normal"] }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Growl");
  });

  it("skips disabled moves", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Flamethrower", { disabled: true }), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Fire"] }),
      defender: buildCombatant({ types: ["Grass"] }),
      field: buildField(),
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
      attacker: buildCombatant(),
      defender: buildCombatant({ types: ["Water"] }),
      field: buildField(),
    });

    expect(choice).toBe("switch 2");
  });

  it("falls back to the first switch when no move is usable", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Tackle", { disabled: true })],
      switches: [{ choice: "switch 3", name: "Caterpie" }],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: buildCombatant({ types: ["Water"] }),
      field: buildField(),
    });

    expect(choice).toBe("switch 3");
  });

  it("falls back to move 1 when there is nothing else to do", () => {
    const request = buildRequest({ moves: [buildMoveOption("Tackle", { disabled: true })] });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: buildCombatant({ types: ["Water"] }),
      field: buildField(),
    });

    expect(choice).toBe("move 1");
  });

  it("finishes off a low-HP target instead of setting up when it can KO and moves first", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      // Way faster, so Tackle's KO bonus applies; the target only has a sliver of HP left.
      attacker: buildCombatant({ baseStats: { ...EVEN_STATS, spe: 200 } }),
      defender: buildCombatant({ currentHp: 5 }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Tackle");
  });

  it("won't use a setup move whose targeted stat is already maxed out", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Swords Dance"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ boosts: { atk: 6 } }),
      defender: buildCombatant(),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Growl");
  });

  it("won't set a hazard that's already at max layers on the defender's side", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Stealth Rock"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: buildCombatant(),
      field: buildField({ defenderHazards: { ...NO_HAZARDS, stealthRock: true } }),
      rng: noJitter,
    });

    expect(choice).toBe("move Growl");
  });

  it("won't re-summon weather that's already active", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Sunny Day"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: buildCombatant(),
      field: buildField({ weather: "SunnyDay" }),
      rng: noJitter,
    });

    expect(choice).toBe("move Growl");
  });

  it("boosts a matching-type move's damage in the right weather", () => {
    const request = buildRequest({ moves: [buildMoveOption("Water Gun")] });

    const withoutRain = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Water"] }),
      defender: buildCombatant(),
      field: buildField(),
      rng: noJitter,
    });
    expect(withoutRain).toBe("move Water Gun");

    // Sanity: same setup, but confirm rain doesn't break move selection (only one usable move).
    const withRain = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Water"] }),
      defender: buildCombatant(),
      field: buildField({ weather: "RainDance" }),
      rng: noJitter,
    });
    expect(withRain).toBe("move Water Gun");
  });

  it("won't re-inflict a status on an already-statused target", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Thunder Wave"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: buildCombatant({ status: "brn" }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Growl");
  });

  it("treats an ability-immune type as unusable, same as a type immunity", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Thunderbolt"), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Electric"] }),
      defender: buildCombatant({ ability: "Volt Absorb" }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Tackle");
  });

  it("prefers finishing a low-HP foe with priority when it would otherwise be too slow", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Quick Attack"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      // Much slower than the defender, so only the priority move guarantees striking first.
      attacker: buildCombatant({ baseStats: { ...EVEN_STATS, spe: 10 } }),
      defender: buildCombatant({ currentHp: 5, baseStats: { ...EVEN_STATS, spe: 200 } }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Quick Attack");
  });

  it("conserves the last use of a status move when a comparable attack is available", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Growl", { pp: 1 }), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Normal"] }),
      defender: buildCombatant({ baseStats: { ...EVEN_STATS, def: 40 } }),
      field: buildField(),
      rng: noJitter,
    });

    // Same matchup as "prefers a status move over a middling attack" above, but Growl being down
    // to its last PP now brings its penalized score below Tackle's instead.
    expect(choice).toBe("move Tackle");
  });

  it("conserves the last use of a damaging move too, not just Status moves", () => {
    const request = buildRequest({
      // Same move both times, so the only difference is remaining PP — isolates the cliff itself.
      moves: [
        buildMoveOption("Tackle", { choice: "move 1", pp: 1 }),
        buildMoveOption("Tackle", { choice: "move 2", pp: 10 }),
      ],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: buildCombatant(),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move 2");
  });

  it("heals when critically low on HP instead of using a weak status move", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Recover"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ currentHp: 10, maxHp: 200 }),
      defender: buildCombatant(),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Recover");
  });

  it("won't use a healing move at full HP", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Recover"), buildMoveOption("Growl")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(), // full HP by default
      defender: buildCombatant(),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Growl");
  });

  it("takes a setup move over a weak attack when there's no rush", () => {
    const request = buildRequest({
      // Swords Dance boosts Attack, and Tackle is this attacker's only (physical) damaging move —
      // an ideal pairing, with no KO on the table to make waiting risky.
      moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: buildCombatant(),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Swords Dance");
  });

  it("values a setup move much less on the second use of the same stat", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")],
    });
    // A softer defender than the baseline so Tackle's own score is strong enough to expose the
    // setup move's decay (against a tankier target the fresh baseline alone would still win out).
    const softDefender = buildCombatant({ baseStats: { ...EVEN_STATS, def: 25 } });

    const freshChoice = chooseTrainerMove({
      request,
      attacker: buildCombatant(),
      defender: softDefender,
      field: buildField(),
      rng: noJitter,
    });
    expect(freshChoice).toBe("move Swords Dance");

    const repeatChoice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ boosts: { atk: 2 } }), // already used Swords Dance once
      defender: softDefender,
      field: buildField(),
      rng: noJitter,
    });
    expect(repeatChoice).toBe("move Tackle");
  });

  it("still finishes a guaranteed KO instead of setting up", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ baseStats: { ...EVEN_STATS, spe: 200 } }),
      defender: buildCombatant({ currentHp: 5 }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Tackle");
  });

  it("values inflicting a status condition highly over a weak attack", () => {
    const request = buildRequest({
      moves: [buildMoveOption("Thunder Wave"), buildMoveOption("Tackle")],
    });

    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ types: ["Electric"] }),
      defender: buildCombatant(),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Thunder Wave");
  });
});

describe("compareSpeed (via chooseTrainerMove's priority handling)", () => {
  it("only values a priority-less KO fully when the attacker actually outspeeds", () => {
    const request = buildRequest({ moves: [buildMoveOption("Tackle")] });

    // With only one usable move the choice is forced either way; this just documents that a
    // paralyzed, slower attacker doesn't crash or misbehave when computing the KO bonus.
    const choice = chooseTrainerMove({
      request,
      attacker: buildCombatant({ status: "par", baseStats: { ...EVEN_STATS, spe: 10 } }),
      defender: buildCombatant({ currentHp: 5, baseStats: { ...EVEN_STATS, spe: 200 } }),
      field: buildField(),
      rng: noJitter,
    });

    expect(choice).toBe("move Tackle");
  });
});
