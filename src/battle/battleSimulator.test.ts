import type { Move, Pokemon } from "../api/pikaserve";
import type { TeamPokemon } from "../engine/gameStateEngine";
import { StageType } from "../engine/stage";
import { ATTEMPT_CATCH, BattleSimulator, MoveNotFoundError, SpeciesNotFoundError, buildShowdownTeam } from "./battleSimulator";
import type { BattleRequest } from "./battleSimulator";

function buildMove(overrides: Partial<Move> = {}): Move {
  return {
    id: "33",
    name: { english: "Tackle" },
    type: "Normal",
    category: "Physical",
    pp: "35",
    power: "40",
    accuracy: "100%",
    ...overrides,
  };
}

function buildFourMoves(names: string[]): [Move, Move, Move, Move] {
  const [a, b, c, d] = names;
  return [
    buildMove({ name: { english: a } }),
    buildMove({ name: { english: b ?? "Growl" } }),
    buildMove({ name: { english: c ?? "Leer" } }),
    buildMove({ name: { english: d ?? "Protect" } }),
  ];
}

function buildPokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 95,
    name: { english: "Onix" },
    type: ["Rock", "Ground"],
    base: { HP: 35, Attack: 45, Defense: 160, "Sp. Attack": 30, "Sp. Defense": 45, Speed: 70 },
    species: "Rock Snake Pokémon",
    bst: 385,
    description: "Onix.",
    profile: {
      height: "8.8 m",
      weight: "210 kg",
      egg: ["Mineral"],
      ability: [["Rock Head", "false"]],
      gender: "50:50",
    },
    image: {
      sprite: "https://example.com/sprite.png",
      thumbnail: "https://example.com/thumb.png",
      hires: "https://example.com/hires.png",
    },
    catchRate: 120,
    ivs: { HP: 31, Attack: 31, Defense: 31, "Sp. Attack": 31, "Sp. Defense": 31, Speed: 31 },
    ...overrides,
  };
}

function buildTeamPokemon(overrides: Partial<Pokemon> = {}, moveNames: string[] = ["Tackle"]): TeamPokemon {
  return { ...buildPokemon(overrides), moves: buildFourMoves(moveNames), level: 50 };
}

function buildCaterpie(overrides: Partial<Pokemon> = {}): TeamPokemon {
  return buildTeamPokemon(
    {
      id: 10,
      name: { english: "Caterpie" },
      type: ["Bug"],
      base: { HP: 45, Attack: 30, Defense: 35, "Sp. Attack": 20, "Sp. Defense": 20, Speed: 45 },
      bst: 195,
      profile: {
        height: "0.3 m",
        weight: "2.9 kg",
        egg: ["Bug"],
        ability: [["Shield Dust", "false"]],
        gender: "50:50",
      },
      ...overrides,
    },
    ["Tackle"],
  );
}

const alwaysFirstMove = () => "move 1";

describe("buildShowdownTeam", () => {
  it("maps a TeamPokemon into a Showdown-legal PokemonSet", () => {
    const [set] = buildShowdownTeam([buildTeamPokemon()]);

    expect(set.species).toBe("Onix");
    expect(set.name).toBe("Onix");
    expect(set.level).toBe(50);
    expect(set.ability).toBe("rockhead");
    expect(set.moves).toEqual(["tackle", "growl", "leer", "protect"]);
    expect(set.evs).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(set.ivs).toEqual({ hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 });
  });

  it("maps each TeamPokemon's own per-stat IVs, not a flat default", () => {
    const pokemon = buildTeamPokemon({
      ivs: { HP: 1, Attack: 5, Defense: 10, "Sp. Attack": 15, "Sp. Defense": 20, Speed: 25 },
    });

    const [set] = buildShowdownTeam([pokemon]);

    expect(set.ivs).toEqual({ hp: 1, atk: 5, def: 10, spa: 15, spd: 20, spe: 25 });
  });

  it("throws SpeciesNotFoundError for a species Showdown doesn't recognize", () => {
    const pokemon = buildTeamPokemon({ name: { english: "Not A Real Pokemon" } });

    expect(() => buildShowdownTeam([pokemon])).toThrow(SpeciesNotFoundError);
  });

  it("throws MoveNotFoundError for a move Showdown doesn't recognize", () => {
    const pokemon = buildTeamPokemon({}, ["Not A Real Move"]);

    expect(() => buildShowdownTeam([pokemon])).toThrow(MoveNotFoundError);
  });

  it("throws when given an empty team", () => {
    expect(() => buildShowdownTeam([])).toThrow(/at least one Pokemon/);
  });

  it("disambiguates same-species teammates with a nickname, leaving the first untouched", () => {
    const team = [buildCaterpie(), buildCaterpie(), buildCaterpie()];

    const sets = buildShowdownTeam(team);

    expect(sets.map((set) => set.name)).toEqual(["Caterpie", "Caterpie #2", "Caterpie #3"]);
    expect(sets.every((set) => set.species === "Caterpie")).toBe(true);
  });
});

describe("BattleSimulator", () => {
  it("runs a deterministic battle to completion with a winner and a faint", async () => {
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const caterpie = buildCaterpie();

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [onix] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Battle,
      undefined,
      [1, 2, 3, 4],
    );

    const result = await simulator.run(alwaysFirstMove, alwaysFirstMove);

    expect(result.winner).toBe("p1");
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.fainted).toEqual([{ player: "p2", pokemon: "p2a: Caterpie" }]);
  }, 15000);

  it("normalizes a typographic apostrophe in switch option names to match our data (e.g. Sirfetch'd)", async () => {
    // Showdown reports this species with a typographic apostrophe (U+2019) in raw request data;
    // our own data (and thus what the UI compares switch selections against) uses a plain ASCII one.
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const sirfetchd = buildTeamPokemon({ id: 865, name: { english: "Sirfetch'd" } }, ["Tackle"]);
    const caterpie = buildCaterpie();
    const requests: BattleRequest[] = [];

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [onix, sirfetchd] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Battle,
      undefined,
      [1, 2, 3, 4],
    );

    await simulator.run((request) => {
      requests.push(request);
      return "move 1";
    }, alwaysFirstMove);

    const switchOption = requests[0].switches.find((s) => s.name.includes("Sirfetch"));
    expect(switchOption?.name).toBe("Sirfetch'd");
  }, 15000);

  it("disambiguates switch options for same-species teammates, and the battle concludes cleanly on a full wipe", async () => {
    // Mirrors a padded Catch-stage team: several identical-species fillers behind the lead. Before
    // battleNickname, every switch option after the lead fainted shared the name "Magikarp", so
    // choosing "the next living one" by name always resolved to the same (possibly already-fainted)
    // entry — the battle never reached a legitimate |win| and the request loop stalled.
    const bulbasaur = buildTeamPokemon({ id: 1, name: { english: "Bulbasaur" } }, ["Tackle"]);
    const filler = () => buildTeamPokemon({ id: 129, name: { english: "Magikarp" } }, ["Splash"]);
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const requests: BattleRequest[] = [];

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [bulbasaur, filler(), filler(), filler()] },
      { name: "Bot 2", team: [onix] },
      StageType.Battle,
      undefined,
      [1, 2, 3, 4],
    );

    const result = await simulator.run((request) => {
      requests.push(request);
      if (request.forceSwitch) return request.switches[0]?.choice ?? "move 1";
      return request.moves.find((m) => !m.disabled)?.choice ?? "move 1";
    }, alwaysFirstMove);

    // Every forced-switch request offered distinctly-named options, never a collapsed duplicate.
    for (const request of requests) {
      const names = request.switches.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }

    expect(result.winner).toBe("p2");
    expect(result.fainted).toEqual([
      { player: "p1", pokemon: "p1a: Bulbasaur" },
      { player: "p1", pokemon: "p1a: Magikarp" },
      { player: "p1", pokemon: "p1a: Magikarp #2" },
      { player: "p1", pokemon: "p1a: Magikarp #3" },
    ]);
  }, 15000);

  it("rejects when a participant's team can't be resolved against Showdown's dex", async () => {
    const bogus = buildTeamPokemon({ name: { english: "Not A Real Pokemon" } });
    const onix = buildTeamPokemon();

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [bogus] },
      { name: "Bot 2", team: [onix] },
      StageType.Battle,
    );

    await expect(simulator.run(alwaysFirstMove, alwaysFirstMove)).rejects.toThrow(SpeciesNotFoundError);
  });
});

describe("BattleSimulator catching", () => {
  it("only offers canAttemptCatch to p1, and only during a StageType.Catch battle", async () => {
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const caterpie = buildCaterpie();
    const requestsSeenBy: { p1: BattleRequest[]; p2: BattleRequest[] } = { p1: [], p2: [] };

    const battleSim = new BattleSimulator(
      { name: "Bot 1", team: [onix] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Battle,
      undefined,
      [1, 2, 3, 4],
    );
    await battleSim.run(
      (request) => {
        requestsSeenBy.p1.push(request);
        return "move 1";
      },
      (request) => {
        requestsSeenBy.p2.push(request);
        return "move 1";
      },
    );

    expect(requestsSeenBy.p1.every((request) => request.canAttemptCatch === false)).toBe(true);
    expect(requestsSeenBy.p2.every((request) => request.canAttemptCatch === false)).toBe(true);

    requestsSeenBy.p1 = [];
    requestsSeenBy.p2 = [];

    const catchSim = new BattleSimulator(
      { name: "Bot 1", team: [buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"])] },
      { name: "Bot 2", team: [buildCaterpie()] },
      StageType.Catch,
      undefined,
      [1, 2, 3, 4],
    );
    await catchSim.run(
      (request) => {
        requestsSeenBy.p1.push(request);
        return "move 1";
      },
      (request) => {
        requestsSeenBy.p2.push(request);
        return "move 1";
      },
    );

    expect(requestsSeenBy.p1[0]?.canAttemptCatch).toBe(true);
    expect(requestsSeenBy.p2.every((request) => request.canAttemptCatch === false)).toBe(true);
  }, 15000);

  it("exits the battle early and returns the wild Pokemon when a catch succeeds", async () => {
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const caterpie = buildCaterpie({ catchRate: 255 });

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [onix] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Catch,
      undefined,
      [1, 2, 3, 4],
      () => 0,
    );

    const result = await simulator.run(
      (request) => (request.canAttemptCatch ? ATTEMPT_CATCH : "move 1"),
      alwaysFirstMove,
    );

    expect(result.winner).toBeNull();
    expect(result.caught).toEqual(caterpie);
  }, 15000);

  it("declines the turn instead of forcing a switch when a catch attempt fails", async () => {
    // Single-Pokemon team: pre-decline, this scenario had no switch target to fall back to and
    // threw NoCatchFallbackError. Decline needs no fallback at all, so this now just works.
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const caterpie = buildCaterpie();

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [onix] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Catch,
      undefined,
      [1, 2, 3, 4],
      () => 0.99999,
    );

    // Throws a ball every single turn instead of ever fighting back.
    const result = await simulator.run(
      (request) => (request.canAttemptCatch ? ATTEMPT_CATCH : "move 1"),
      alwaysFirstMove,
    );

    expect(result.caught).toBeUndefined();
    // Only the initial send-out counts as a p1 switch — no forced switch after any failed catch.
    expect(result.log.filter((line) => line.startsWith("|switch|p1a:")).length).toBe(1);
    // Declining spends no move — since every turn was a catch attempt, Onix never actually moved.
    expect(result.log.some((line) => line.startsWith("|move|p1a:"))).toBe(false);
  }, 15000);

  it("notifies catchListener with a successful result when a catch succeeds", async () => {
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const caterpie = buildCaterpie({ catchRate: 255 });
    const attempts: { caught: boolean; shakes: number }[] = [];

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [onix] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Catch,
      undefined,
      [1, 2, 3, 4],
      () => 0,
      undefined,
      (result) => attempts.push(result),
    );

    await simulator.run((request) => (request.canAttemptCatch ? ATTEMPT_CATCH : "move 1"), alwaysFirstMove);

    expect(attempts).toEqual([{ caught: true, shakes: 4 }]);
  }, 15000);

  it("notifies catchListener with a failed result when a catch fails, before the battle continues", async () => {
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const geodude = buildTeamPokemon({ id: 74, name: { english: "Geodude" } }, ["Tackle"]);
    const caterpie = buildCaterpie();
    const attempts: { caught: boolean; shakes: number }[] = [];

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [onix, geodude] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Catch,
      undefined,
      [1, 2, 3, 4],
      () => 0.99999,
      undefined,
      (result) => attempts.push(result),
    );

    let attempted = false;
    await simulator.run((request) => {
      if (request.canAttemptCatch && !attempted) {
        attempted = true;
        return ATTEMPT_CATCH;
      }
      return request.moves[0]?.choice ?? "move 1";
    }, alwaysFirstMove);

    expect(attempts).toEqual([{ caught: false, shakes: 0 }]);
  }, 15000);

  it("raises catch odds when a higher ballBonus is passed to the constructor", async () => {
    // catchRate 45, full HP, roll 35000/65536: fails the first shake at ballBonus 1
    // (threshold 32767) but clears all four at ballBonus 2 (threshold 38835).
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const roll = () => 35000 / 65536;

    const weakBallSim = new BattleSimulator(
      { name: "Bot 1", team: [onix] },
      { name: "Bot 2", team: [buildCaterpie({ catchRate: 45 })] },
      StageType.Catch,
      undefined,
      [1, 2, 3, 4],
      roll,
    );
    const weakBallResult = await weakBallSim.run(
      (request) => (request.canAttemptCatch ? ATTEMPT_CATCH : "move 1"),
      alwaysFirstMove,
    );

    const strongBallSim = new BattleSimulator(
      { name: "Bot 1", team: [buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"])] },
      { name: "Bot 2", team: [buildCaterpie({ catchRate: 45 })] },
      StageType.Catch,
      undefined,
      [1, 2, 3, 4],
      roll,
      undefined,
      undefined,
      2,
    );
    const strongBallResult = await strongBallSim.run(
      (request) => (request.canAttemptCatch ? ATTEMPT_CATCH : "move 1"),
      alwaysFirstMove,
    );

    expect(weakBallResult.caught).toBeUndefined();
    expect(strongBallResult.caught).toBeDefined();
  }, 15000);

  it("rejects if ATTEMPT_CATCH is returned outside a catch-enabled battle", async () => {
    const onix = buildTeamPokemon({ name: { english: "Onix" } }, ["Tackle"]);
    const caterpie = buildCaterpie();

    const simulator = new BattleSimulator(
      { name: "Bot 1", team: [onix] },
      { name: "Bot 2", team: [caterpie] },
      StageType.Battle,
      undefined,
      [1, 2, 3, 4],
    );

    await expect(simulator.run(() => ATTEMPT_CATCH, alwaysFirstMove)).rejects.toThrow(
      "This battle doesn't support catching",
    );
  }, 15000);
});
