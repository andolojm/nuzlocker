import { getHiddenMoveIds, setHiddenMoveIds } from "./moveVisibility";
import { PikaLocal, PikaLocalNotFoundError } from "./pikaLocal";

describe("PikaLocal", () => {
  describe("pokemon", () => {
    it("getAllPokemon returns the full pokemon database", async () => {
      const pokemon = await PikaLocal.getAllPokemon();

      expect(Array.isArray(pokemon)).toBe(true);
      expect(pokemon.length).toBeGreaterThan(0);
      expect(pokemon[0]).toHaveProperty("id");
      expect(pokemon[0]).toHaveProperty("name.english");
      expect(pokemon[0]).toHaveProperty("base.HP");
    });

    it("getRandomPokemon returns a single pokemon", async () => {
      const pokemon = await PikaLocal.getRandomPokemon();

      expect(typeof pokemon.id).toBe("number");
      expect(typeof pokemon.name.english).toBe("string");
      expect(Array.isArray(pokemon.type)).toBe(true);
      expect(typeof pokemon.base.HP).toBe("number");
    });

    it("getRandomPokemon restricts to the given bst range, inclusive", async () => {
      for (let i = 0; i < 20; i++) {
        const pokemon = await PikaLocal.getRandomPokemon(300, 320);
        expect(pokemon.bst).toBeGreaterThanOrEqual(300);
        expect(pokemon.bst).toBeLessThanOrEqual(320);
      }
    });

    it("getRandomPokemon supports an open-ended min or max", async () => {
      const pokemon = await PikaLocal.getRandomPokemon(700, undefined);
      expect(pokemon.bst).toBeGreaterThanOrEqual(700);

      const other = await PikaLocal.getRandomPokemon(undefined, 180);
      expect(other.bst).toBeLessThanOrEqual(180);
    });

    it("getRandomPokemon throws when no pokemon fall in the requested bst range", async () => {
      await expect(PikaLocal.getRandomPokemon(10000, 20000)).rejects.toThrow(PikaLocalNotFoundError);
    });

    it("getPokemon looks up by name", async () => {
      const pokemon = await PikaLocal.getPokemon("infernape");

      expect(pokemon.id).toBe(392);
      expect(pokemon.name.english).toBe("Infernape");
      expect(pokemon.type).toContain("Fire");
    });

    it("getPokemon looks up by pokedex id", async () => {
      const pokemon = await PikaLocal.getPokemon(392);

      expect(pokemon.name.english).toBe("Infernape");
    });

    it("throws PikaLocalNotFoundError for an unknown pokemon", async () => {
      await expect(PikaLocal.getPokemon("not-a-real-pokemon")).rejects.toThrow(PikaLocalNotFoundError);
    });

    it("carries the catch rate from vendored pokedex data", async () => {
      const pokemon = await PikaLocal.getPokemon("infernape");

      expect(pokemon.catchRate).toBe(45);
    });

    it("attaches randomized IVs PikaServe doesn't provide", async () => {
      const pokemon = await PikaLocal.getPokemon("infernape");

      for (const iv of Object.values(pokemon.ivs)) {
        expect(iv).toBeGreaterThanOrEqual(0);
        expect(iv).toBeLessThanOrEqual(31);
      }
    });

    it("rolls fresh IVs on every fetch", async () => {
      const [first, second] = await Promise.all([
        PikaLocal.getPokemon("infernape"),
        PikaLocal.getPokemon("infernape"),
      ]);

      expect(first.ivs).not.toEqual(second.ivs);
    });
  });

  describe("moves", () => {
    it("getAllMoves returns the full moves database", async () => {
      const moves = await PikaLocal.getAllMoves();

      expect(Array.isArray(moves)).toBe(true);
      expect(moves.length).toBeGreaterThan(0);
      expect(moves[0]).toHaveProperty("name.english");
      expect(moves[0]).toHaveProperty("type");
    });

    it("getRandomMove returns a single move", async () => {
      const move = await PikaLocal.getRandomMove(50);

      expect(typeof move.name.english).toBe("string");
      expect(typeof move.type).toBe("string");
    });

    it("getRandomMove never returns a move hidden via moveVisibility", async () => {
      const previouslyHidden = getHiddenMoveIds();
      setHiddenMoveIds(["1"]); // Pound
      try {
        for (let i = 0; i < 30; i++) {
          const move = await PikaLocal.getRandomMove(50);
          expect(move.id).not.toBe("1");
        }
      } finally {
        setHiddenMoveIds(previouslyHidden);
      }
    });

    it("getRandomMove caps power at 40 for a level 1 Pokemon", async () => {
      // Self-Destruct/Explosion/Misty Explosion are deliberately exempt from the cap (see movePowerCap.ts).
      const exempt = ["Self-Destruct", "Explosion", "Misty Explosion"];
      for (let i = 0; i < 30; i++) {
        const move = await PikaLocal.getRandomMove(1);
        const power = parseFloat(move.power);
        if (Number.isFinite(power) && !exempt.includes(move.name.english)) {
          expect(power).toBeLessThanOrEqual(40);
        }
      }
    });

    it("getRandomMove allows Explosion/Self-Destruct/Misty Explosion regardless of level", async () => {
      const previouslyHidden = getHiddenMoveIds();
      // Only the three exempt moves are eligible at level 1 with everything else hidden.
      const exempt = ["Self-Destruct", "Explosion", "Misty Explosion"];
      const allMoves = await PikaLocal.getAllMoves();
      const toHide = allMoves.filter((move) => !exempt.includes(move.name.english)).map((move) => move.id);
      setHiddenMoveIds(toHide);
      try {
        const move = await PikaLocal.getRandomMove(1);
        expect(exempt).toContain(move.name.english);
      } finally {
        setHiddenMoveIds(previouslyHidden);
      }
    });

    it("getMove looks up by id", async () => {
      const move = await PikaLocal.getMove(500);

      expect(move.id).toBe("500");
      expect(move.name.english).toBe("Stored Power");
    });

    // Real PikaServe's /moves/{name} route is broken (matches on a field the data doesn't have), so
    // name lookup always fails upstream. This vendored version fixes that instead of preserving it.
    it("getMove looks up by name, fixing PikaServe's broken name-lookup route", async () => {
      const move = await PikaLocal.getMove("Tackle");

      expect(move.name.english).toBe("Tackle");
    });

    it("throws PikaLocalNotFoundError for an unknown move", async () => {
      await expect(PikaLocal.getMove("not-a-real-move")).rejects.toThrow(PikaLocalNotFoundError);
    });
  });

  describe("items", () => {
    it("getAllItems returns the full items database", async () => {
      const items = await PikaLocal.getAllItems();

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toHaveProperty("name.english");
      expect(items[0]).toHaveProperty("type");
    });

    it("getRandomItem returns a single item", async () => {
      const item = await PikaLocal.getRandomItem();

      expect(typeof item.name.english).toBe("string");
      expect(typeof item.type).toBe("string");
    });

    it("getItem looks up by name", async () => {
      const item = await PikaLocal.getItem("Potion");

      expect(item.id).toBe(17);
      expect(item.name.english).toBe("Potion");
    });

    it("getItem looks up by id", async () => {
      const item = await PikaLocal.getItem(420);

      expect(item.id).toBe(420);
      expect(item.name.english).toBe("HM01");
    });
  });

  describe("TMs", () => {
    it("getAllTMs returns exactly one TM per move", async () => {
      const [tms, moves] = await Promise.all([PikaLocal.getAllTMs(), PikaLocal.getAllMoves()]);

      expect(tms).toHaveLength(moves.length);
      for (const tm of tms) {
        expect(typeof tm.id).toBe("number");
        expect(typeof tm.move.name.english).toBe("string");
      }
    });

    it("a TM's id is its move's own id", async () => {
      const move = await PikaLocal.getMove("Tackle");

      const tm = await PikaLocal.getTM(Number(move.id));

      expect(tm.move.name.english).toBe("Tackle");
    });

    it("getRandomTM returns a single TM", async () => {
      const tm = await PikaLocal.getRandomTM();

      expect(typeof tm.id).toBe("number");
      expect(typeof tm.move.name.english).toBe("string");
    });

    it("getRandomTM picks by index using the injected RNG", async () => {
      const tms = await PikaLocal.getAllTMs();

      const first = await PikaLocal.getRandomTM(() => 0);
      const last = await PikaLocal.getRandomTM(() => 0.999999);

      expect(first).toEqual(tms[0]);
      expect(last).toEqual(tms[tms.length - 1]);
    });

    it("getTM throws PikaLocalNotFoundError for an unknown id", async () => {
      await expect(PikaLocal.getTM(-1)).rejects.toThrow(PikaLocalNotFoundError);
    });
  });

  describe("types", () => {
    it("getAllTypes returns the full types database", async () => {
      const types = await PikaLocal.getAllTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      expect(types[0]).toHaveProperty("english");
      expect(types[0]).toHaveProperty("effective");
    });

    it("getRandomType returns a single type", async () => {
      const type = await PikaLocal.getRandomType();

      expect(typeof type.english).toBe("string");
      expect(Array.isArray(type.effective)).toBe(true);
    });

    it("getType looks up by name", async () => {
      const type = await PikaLocal.getType("fairy");

      expect(type.english).toBe("Fairy");
      expect(type.effective).toContain("Dragon");
      expect(type.ineffective).toContain("Steel");
    });

    it("getType looks up by id", async () => {
      const type = await PikaLocal.getType(15);

      expect(type.english).toBe("Ice");
    });

    it("throws PikaLocalNotFoundError for an unknown type", async () => {
      await expect(PikaLocal.getType("not-a-real-type")).rejects.toThrow(PikaLocalNotFoundError);
    });
  });

  describe("abilities", () => {
    it("getAllAbilities returns the full ability database", async () => {
      const abilities = await PikaLocal.getAllAbilities();

      expect(abilities.length).toBeGreaterThan(250);
      expect(abilities[0]).toHaveProperty("name");
      expect(abilities[0]).toHaveProperty("description");
      expect(abilities[0]).toHaveProperty("hidden");
    });

    it("getAbility looks up by name (whitespace-insensitive) and by id", async () => {
      const byName = await PikaLocal.getAbility("compound eyes");
      expect(byName.name).toBe("Compound Eyes");

      const byId = await PikaLocal.getAbility(byName.id);
      expect(byId.name).toBe("Compound Eyes");
    });

    it("throws PikaLocalNotFoundError for an unknown ability", async () => {
      await expect(PikaLocal.getAbility("not-a-real-ability")).rejects.toThrow(PikaLocalNotFoundError);
    });

    it("getRandomAbility never returns a hidden ability", async () => {
      const all = await PikaLocal.getAllAbilities();
      const hidden = all.filter((ability) => ability.hidden);
      expect(hidden.length).toBeGreaterThan(0); // guard: the exclusion list isn't empty

      // Sweep the whole [0,1) index space; every pick must be assignable.
      for (let i = 0; i < 1000; i++) {
        const picked = await PikaLocal.getRandomAbility(() => i / 1000);
        expect(picked.hidden).toBe(false);
      }
    });
  });
});
