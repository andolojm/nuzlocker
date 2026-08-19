/**
 * @jest-environment jsdom
 */
import type { Item, Move, Pokemon } from "../api/pikaserve";
import { StageType } from "./stage";
import {
  AlivePokemon,
  BattleReplayLog,
  GAME_STATE_STORAGE_KEY,
  GameStateEngine,
  MAX_ACTIVE_TEAM_SIZE,
  OwnedTM,
  TeamPokemon,
} from "./gameStateEngine";

function buildMove(overrides: Partial<Move> = {}): Move {
  return {
    id: "33",
    name: { english: "Tackle", japanese: "たいあたり" },
    type: "Normal",
    category: "Physical",
    pp: "35",
    power: "40",
    accuracy: "100%",
    ...overrides,
  };
}

function buildFourMoves(): [Move, Move, Move, Move] {
  return [
    buildMove({ id: "1", name: { english: "Move One" } }),
    buildMove({ id: "2", name: { english: "Move Two" } }),
    buildMove({ id: "3", name: { english: "Move Three" } }),
    buildMove({ id: "4", name: { english: "Move Four" } }),
  ];
}

function buildPokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 392,
    name: { english: "Infernape", japanese: "ゴウカザル" },
    type: ["Fire", "Fighting"],
    base: { HP: 76, Attack: 104, Defense: 71, "Sp. Attack": 104, "Sp. Defense": 71, Speed: 108 },
    species: "Flame Pokémon",
    bst: 534,
    description: "It tosses its enemies around with agility.",
    profile: {
      height: "1.2 m",
      weight: "55 kg",
      egg: ["Field", "Human-Like"],
      ability: [["Blaze", "false"]],
      gender: "87.5:12.5",
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

function buildTeamPokemon(overrides: Partial<Pokemon> = {}): TeamPokemon {
  return { ...buildPokemon(overrides), moves: buildFourMoves(), level: 50 };
}

function buildItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 17,
    type: "Medicine",
    description: "Restores 20 HP.",
    name: { english: "Potion", japanese: "キズぐすり" },
    ...overrides,
  };
}

function buildOwnedTM(overrides: Partial<OwnedTM> = {}): OwnedTM {
  return {
    id: 5,
    move: buildMove({ id: "5", name: { english: "Mega Punch" } }),
    ...overrides,
  };
}

function buildBattleReplayLog(overrides: Partial<BattleReplayLog> = {}): BattleReplayLog {
  return {
    stageIndex: 0,
    stageType: StageType.Battle,
    playerName: "Red",
    playerTeam: [buildTeamPokemon()],
    opponentName: "Trainer",
    opponentTeam: [buildTeamPokemon({ id: 1, name: { english: "Onix" } })],
    battleSeed: [1, 2, 3, 4],
    auxSeed: [5, 6, 7, 8],
    ballBonus: 1,
    choices: [],
    ...overrides,
  };
}

describe("GameStateEngine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with the default initial state when nothing is persisted", () => {
    const engine = new GameStateEngine();

    expect(engine.current).toEqual({
      state: 0,
      pokemon: { alive: [], dead: [] },
      bag: [],
      tms: [],
      battleLog: null,
    });
  });

  describe("bag", () => {
    it("addItem appends an item to the bag and persists", () => {
      const engine = new GameStateEngine();
      const potion = buildItem();

      engine.addItem(potion);

      expect(engine.current.bag).toEqual([potion]);
      const persisted = JSON.parse(localStorage.getItem(GAME_STATE_STORAGE_KEY)!);
      expect(persisted.bag).toEqual([potion]);
    });

    it("removeItem removes an item by id", () => {
      const engine = new GameStateEngine();
      engine.addItem(buildItem({ id: 17 }));
      engine.addItem(buildItem({ id: 420, name: { english: "HM01" } }));

      engine.removeItem(17);

      expect(engine.current.bag.map((item) => item.id)).toEqual([420]);
    });

    it("removeItem throws when the id is not in the bag", () => {
      const engine = new GameStateEngine();

      expect(() => engine.removeItem(999)).toThrow(/not in the bag/);
    });
  });

  describe("pokemon", () => {
    it("addPokemon adds a pokemon to the alive array, inactive by default", () => {
      const engine = new GameStateEngine();
      const infernape = buildTeamPokemon();

      engine.addPokemon(infernape);

      expect(engine.current.pokemon.alive).toEqual([{ ...infernape, active: undefined }]);
      expect(engine.current.pokemon.dead).toEqual([]);
    });

    it("addPokemon respects an explicit active order", () => {
      const engine = new GameStateEngine();
      const infernape = buildTeamPokemon();

      engine.addPokemon(infernape, 1);

      expect(engine.current.pokemon.alive[0].active).toBe(1);
    });

    it("addCaughtPokemon joins the active team when there's a free slot", () => {
      const engine = new GameStateEngine();
      engine.addPokemon(buildTeamPokemon({ id: 1 }), 1);
      engine.addPokemon(buildTeamPokemon({ id: 2 }), 2);

      engine.addCaughtPokemon(buildTeamPokemon({ id: 3 }));

      const caught = engine.current.pokemon.alive[2];
      expect(caught.active).toBe(3);
    });

    it("addCaughtPokemon joins inactive once the active team is already full", () => {
      const engine = new GameStateEngine();
      for (let i = 0; i < MAX_ACTIVE_TEAM_SIZE; i++) {
        engine.addPokemon(buildTeamPokemon({ id: i }), i + 1);
      }

      engine.addCaughtPokemon(buildTeamPokemon({ id: 99 }));

      const caught = engine.current.pokemon.alive[MAX_ACTIVE_TEAM_SIZE];
      expect(caught.active).toBeUndefined();
    });

    it("addCaughtPokemon ignores dead/inactive party members when counting free slots", () => {
      const engine = new GameStateEngine();
      engine.addPokemon(buildTeamPokemon({ id: 1 }), 1);
      engine.addPokemon(buildTeamPokemon({ id: 2 })); // inactive

      engine.addCaughtPokemon(buildTeamPokemon({ id: 3 }));

      const caught = engine.current.pokemon.alive[2];
      expect(caught.active).toBe(2);
    });

    it("markPokemonDead moves a pokemon from alive to dead, stripping active", () => {
      const engine = new GameStateEngine();
      engine.addPokemon(buildTeamPokemon());
      const [alivePokemon] = engine.current.pokemon.alive as AlivePokemon[];

      engine.markPokemonDead(alivePokemon);

      expect(engine.current.pokemon.alive).toEqual([]);
      expect(engine.current.pokemon.dead).toHaveLength(1);
      expect(engine.current.pokemon.dead[0]).not.toHaveProperty("active");
      expect(engine.current.pokemon.dead[0].name.english).toBe("Infernape");
    });

    it("markPokemonDead throws when the pokemon is not in the alive party", () => {
      const engine = new GameStateEngine();
      const notOnTeam: AlivePokemon = { ...buildTeamPokemon(), active: undefined };

      expect(() => engine.markPokemonDead(notOnTeam)).toThrow(/not in the alive party/);
    });

    it("clearPokemon empties both the alive and dead arrays", () => {
      const engine = new GameStateEngine();
      engine.addPokemon(buildTeamPokemon({ name: { english: "Infernape" } }));
      engine.addPokemon(buildTeamPokemon({ name: { english: "Onix" } }));
      engine.markPokemonDead(engine.current.pokemon.alive[0]);

      engine.clearPokemon();

      expect(engine.current.pokemon.alive).toEqual([]);
      expect(engine.current.pokemon.dead).toEqual([]);
    });
  });

  describe("tms", () => {
    it("addTM appends a TM to the owned list", () => {
      const engine = new GameStateEngine();
      const tm = buildOwnedTM();

      engine.addTM(tm);

      expect(engine.current.tms).toEqual([tm]);
    });

    describe("teachMove", () => {
      it("replaces the move at moveIndex and removes the TM from the owned list, in one commit", () => {
        const engine = new GameStateEngine();
        engine.addPokemon(buildTeamPokemon());
        const tm = buildOwnedTM();
        engine.addTM(tm);
        const [infernape] = engine.current.pokemon.alive;

        engine.teachMove(infernape, 1, tm);

        const [updated] = engine.current.pokemon.alive;
        expect(updated.moves[1]).toEqual(tm.move);
        expect(updated.moves[0]).toEqual(infernape.moves[0]);
        expect(updated.moves[2]).toEqual(infernape.moves[2]);
        expect(updated.moves[3]).toEqual(infernape.moves[3]);
        expect(engine.current.tms).toEqual([]);
      });

      it("preserves everything else about the pokemon (e.g. active order)", () => {
        const engine = new GameStateEngine();
        engine.addPokemon(buildTeamPokemon(), 1);
        const tm = buildOwnedTM();
        engine.addTM(tm);
        const [infernape] = engine.current.pokemon.alive;

        engine.teachMove(infernape, 0, tm);

        expect(engine.current.pokemon.alive[0].active).toBe(1);
      });

      it("throws when the pokemon is not in the alive party", () => {
        const engine = new GameStateEngine();
        const tm = buildOwnedTM();
        engine.addTM(tm);
        const notOnTeam: AlivePokemon = { ...buildTeamPokemon(), active: undefined };

        expect(() => engine.teachMove(notOnTeam, 0, tm)).toThrow(/not in the alive party/);
      });

      it("throws when the TM is not in the owned list", () => {
        const engine = new GameStateEngine();
        engine.addPokemon(buildTeamPokemon());
        const [infernape] = engine.current.pokemon.alive;
        const notOwned = buildOwnedTM();

        expect(() => engine.teachMove(infernape, 0, notOwned)).toThrow(/not in the tms list/);
      });

      it("throws for an out-of-range move index", () => {
        const engine = new GameStateEngine();
        engine.addPokemon(buildTeamPokemon());
        const tm = buildOwnedTM();
        engine.addTM(tm);
        const [infernape] = engine.current.pokemon.alive;

        expect(() => engine.teachMove(infernape, 4, tm)).toThrow(/Move index must be 0-3/);
      });

      it("does not consume the TM or change moves when it throws", () => {
        const engine = new GameStateEngine();
        engine.addPokemon(buildTeamPokemon());
        const tm = buildOwnedTM();
        engine.addTM(tm);
        const [infernape] = engine.current.pokemon.alive;

        expect(() => engine.teachMove(infernape, 4, tm)).toThrow();

        expect(engine.current.tms).toEqual([tm]);
        expect(engine.current.pokemon.alive[0].moves).toEqual(infernape.moves);
      });
    });
  });

  describe("setActiveTeam", () => {
    it("assigns 1-based order to the given pokemon, in the order provided", () => {
      const engine = new GameStateEngine();
      engine.addPokemon(buildTeamPokemon({ name: { english: "Infernape" } }));
      engine.addPokemon(buildTeamPokemon({ name: { english: "Onix" } }));
      const [infernape, onix] = engine.current.pokemon.alive;

      engine.setActiveTeam([onix, infernape]);

      const alive = engine.current.pokemon.alive;
      expect(alive.find((p) => p.name.english === "Onix")?.active).toBe(1);
      expect(alive.find((p) => p.name.english === "Infernape")?.active).toBe(2);
    });

    it("clears active to undefined for alive pokemon left off the new team", () => {
      const engine = new GameStateEngine();
      engine.addPokemon(buildTeamPokemon({ name: { english: "Infernape" } }));
      engine.addPokemon(buildTeamPokemon({ name: { english: "Onix" } }));
      const [infernape, onix] = engine.current.pokemon.alive;
      engine.setActiveTeam([infernape, onix]);

      // setActiveTeam returns new object references for anyone whose active order changed,
      // so re-fetch onix's current reference before using it in a second call.
      const onixAfterFirstCall = engine.current.pokemon.alive.find((p) => p.name.english === "Onix")!;
      engine.setActiveTeam([onixAfterFirstCall]);

      const alive = engine.current.pokemon.alive;
      expect(alive.find((p) => p.name.english === "Onix")?.active).toBe(1);
      expect(alive.find((p) => p.name.english === "Infernape")?.active).toBeUndefined();
    });

    it("throws when given more than 6 pokemon", () => {
      const engine = new GameStateEngine();
      for (let i = 0; i < 7; i++) {
        engine.addPokemon(buildTeamPokemon({ id: i, name: { english: `Mon${i}` } }));
      }

      expect(() => engine.setActiveTeam(engine.current.pokemon.alive)).toThrow(/at most 6/);
    });

    it("throws when a given pokemon is not in the alive party", () => {
      const engine = new GameStateEngine();
      const notOnTeam: AlivePokemon = { ...buildTeamPokemon(), active: undefined };

      expect(() => engine.setActiveTeam([notOnTeam])).toThrow(/not in the alive party/);
    });
  });

  describe("progressState", () => {
    it("increments state by one", () => {
      const engine = new GameStateEngine();

      engine.progressState();
      engine.progressState();

      expect(engine.current.state).toBe(2);
    });
  });

  describe("regressState", () => {
    it("decrements state by one", () => {
      const engine = new GameStateEngine();
      engine.progressState();
      engine.progressState();

      engine.regressState();

      expect(engine.current.state).toBe(1);
    });

    it("clamps at zero instead of going negative", () => {
      const engine = new GameStateEngine();

      engine.regressState();

      expect(engine.current.state).toBe(0);
    });
  });

  describe("battle log", () => {
    it("starts, records choices onto, and clears a battle log", () => {
      const engine = new GameStateEngine();
      const log = buildBattleReplayLog();

      engine.startBattleLog(log);
      expect(engine.current.battleLog).toEqual(log);

      engine.recordBattleChoice("move 1");
      engine.recordBattleChoice("switch 2");
      expect(engine.current.battleLog?.choices).toEqual(["move 1", "switch 2"]);

      engine.clearBattleLog();
      expect(engine.current.battleLog).toBeNull();
    });

    it("recordBattleChoice is a no-op when there's no battle log", () => {
      const engine = new GameStateEngine();

      engine.recordBattleChoice("move 1");

      expect(engine.current.battleLog).toBeNull();
    });

    it("round-trips through exportState/importState", () => {
      const engine = new GameStateEngine();
      engine.startBattleLog(buildBattleReplayLog());
      engine.recordBattleChoice("move 1");

      const other = new GameStateEngine();
      other.importState(engine.exportState());

      expect(other.current.battleLog).toEqual(engine.current.battleLog);
    });
  });

  describe("subscribe", () => {
    it("notifies listeners after every mutation", () => {
      const engine = new GameStateEngine();
      const listener = jest.fn();
      engine.subscribe(listener);

      engine.progressState();
      engine.addItem(buildItem());

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("stops notifying once unsubscribed", () => {
      const engine = new GameStateEngine();
      const listener = jest.fn();
      const unsubscribe = engine.subscribe(listener);

      unsubscribe();
      engine.progressState();

      expect(listener).not.toHaveBeenCalled();
    });

    it("returns a new object reference on every mutation, so reference-equality checks (e.g. React) detect the change", () => {
      const engine = new GameStateEngine();
      const before = engine.current;

      engine.progressState();

      expect(engine.current).not.toBe(before);
    });
  });

  describe("exportState / importState", () => {
    it("exports JSON that round-trips back to an equal state via importState", () => {
      const source = new GameStateEngine();
      source.progressState();
      source.addPokemon(buildTeamPokemon(), 1);
      source.addItem(buildItem());

      const target = new GameStateEngine();
      target.importState(source.exportState());

      expect(target.current).toEqual(source.current);
    });

    it("notifies subscribers when importing", () => {
      const engine = new GameStateEngine();
      const exported = engine.exportState();
      const listener = jest.fn();
      engine.subscribe(listener);

      engine.importState(exported);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("persists the imported state to localStorage", () => {
      const source = new GameStateEngine();
      source.progressState();
      const exported = source.exportState();

      const target = new GameStateEngine();
      target.importState(exported);

      const persisted = JSON.parse(localStorage.getItem(GAME_STATE_STORAGE_KEY)!);
      expect(persisted.state).toBe(1);
    });

    it("throws on invalid JSON, without mutating the current state", () => {
      const engine = new GameStateEngine();
      engine.progressState();

      expect(() => engine.importState("{not valid json")).toThrow(/not valid JSON/);
      expect(engine.current.state).toBe(1);
    });

    it("throws when the JSON is well-formed but not a game state", () => {
      const engine = new GameStateEngine();

      expect(() => engine.importState(JSON.stringify({ hello: "world" }))).toThrow(/doesn't look like/);
    });

    it("backfills a missing tms field for state exported before TMs existed", () => {
      const engine = new GameStateEngine();
      const preTmState = { state: 3, pokemon: { alive: [], dead: [] }, bag: [] };

      engine.importState(JSON.stringify(preTmState));

      expect(engine.current.tms).toEqual([]);
    });
  });

  describe("persistence", () => {
    it("persists every mutation to localStorage under the game state key", () => {
      const engine = new GameStateEngine();

      engine.progressState();
      engine.addItem(buildItem());
      engine.addPokemon(buildTeamPokemon());

      const persisted = JSON.parse(localStorage.getItem(GAME_STATE_STORAGE_KEY)!);
      expect(persisted.state).toBe(1);
      expect(persisted.bag).toHaveLength(1);
      expect(persisted.pokemon.alive).toHaveLength(1);
    });

    it("a new engine instance loads state persisted by a previous instance", () => {
      const first = new GameStateEngine();
      first.progressState();
      first.addPokemon(buildTeamPokemon(), 1);
      first.addItem(buildItem());

      const second = new GameStateEngine();

      expect(second.current).toEqual(first.current);
    });

    it("backfills a missing tms field when loading state saved before TMs existed", () => {
      const preTmState = { state: 2, pokemon: { alive: [], dead: [] }, bag: [] };
      localStorage.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(preTmState));

      const engine = new GameStateEngine();

      expect(engine.current).toEqual({ ...preTmState, tms: [], battleLog: null });
    });

    it("falls back to the initial state when localStorage contains invalid JSON", () => {
      localStorage.setItem(GAME_STATE_STORAGE_KEY, "{not valid json");

      const engine = new GameStateEngine();

      expect(engine.current).toEqual({
        state: 0,
        pokemon: { alive: [], dead: [] },
        bag: [],
        tms: [],
        battleLog: null,
      });
    });
  });
});
