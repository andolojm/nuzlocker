import type { BattleRequest, MoveOption } from "../battleSimulator";
import { tacticalTrainerAi } from "./tactical";
import type { Combatant, FieldConditions, StatTable } from "./types";
import { NO_HAZARDS } from "./types";

const chooseTrainerMove = tacticalTrainerAi.chooseMove;

function buildMoveOption(name: string, overrides: Partial<MoveOption> = {}): MoveOption {
  return { choice: `move ${name}`, name, disabled: false, ...overrides };
}

function buildRequest(overrides: Partial<BattleRequest> = {}): BattleRequest {
  return { forceSwitch: false, moves: [], switches: [], canAttemptCatch: false, trapped: false, ...overrides };
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

describe("tacticalTrainerAi", () => {
  describe("basic move selection", () => {
    it("picks the super-effective STAB move over a resisted one", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Flamethrower"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ types: ["Fire"] }),
        defender: buildCombatant({ types: ["Grass"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Flamethrower");
    });

    it("avoids an immune move when a usable alternative exists", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Tackle"), buildMoveOption("Shadow Ball")] }),
        attacker: buildCombatant({ types: ["Normal"] }),
        defender: buildCombatant({ types: ["Ghost"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Shadow Ball");
    });

    it("switches when forced", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ forceSwitch: true, switches: [{ choice: "switch 2", name: "Pidgey" }] }),
        attacker: buildCombatant(),
        defender: buildCombatant(),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("switch 2");
    });
  });

  describe("status moves that would do nothing", () => {
    it("does not use Thunder Wave on a Ground-type", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Thunder Wave"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ types: ["Ground"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not use Toxic on a Steel-type", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Toxic"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ types: ["Steel"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not use Will-O-Wisp on a Fire-type", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Will-O-Wisp"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ types: ["Fire"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not use a powder move on a Grass-type", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Sleep Powder"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ types: ["Grass"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not paralyze through a Limber ability", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Thunder Wave"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ ability: "Limber" }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not re-use a stat drop that has already bottomed out", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Growl"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ boosts: { atk: -6 }, knownMoves: ["Tackle"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not lower Attack on a purely special attacker when it can attack instead", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Growl"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ knownMoves: ["Water Gun", "Psychic"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("still uses Thunder Wave on a target it can actually paralyze", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Thunder Wave"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        // Slower than the defender, so the paralysis speed swing is worth the turn.
        defender: buildCombatant({ types: ["Water"], boosts: { spe: 2 } }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Thunder Wave");
    });
  });

  describe("setup discipline", () => {
    it("sets up from neutral when the board is safe", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ types: ["Steel"], baseStats: { ...EVEN_STATS, def: 200, spd: 200 } }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 20, spa: 20 } }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Swords Dance");
    });

    it("stops setting up past +2 when the board is not clearly safe", () => {
      const attacker = buildCombatant({ boosts: { atk: 2 }, currentHp: 60 });
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")] }),
        attacker,
        defender: buildCombatant(),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("never sets up past +4, even on a completely safe board", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ boosts: { atk: 4 }, baseStats: { ...EVEN_STATS, def: 250, spd: 250 } }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 5, spa: 5 } }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not set up when it is about to be knocked out", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ currentHp: 8 }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 200 }, knownMoves: ["Earthquake"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not boost Speed it does not need", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Agility"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ baseStats: { ...EVEN_STATS, spe: 200 } }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, spe: 20 } }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });
  });

  describe("turn economy", () => {
    it("takes a guaranteed knockout over any status move", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Spore"), buildMoveOption("Earthquake")] }),
        attacker: buildCombatant({ types: ["Ground"], baseStats: { ...EVEN_STATS, atk: 200, spe: 200 } }),
        defender: buildCombatant({ types: ["Electric"], currentHp: 10 }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Earthquake");
    });

    it("prefers a reliable attack over a low-accuracy sleep move", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Hypnosis"), buildMoveOption("Flamethrower")] }),
        attacker: buildCombatant({ types: ["Fire"], baseStats: { ...EVEN_STATS, spa: 200 } }),
        defender: buildCombatant({ types: ["Grass"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Flamethrower");
    });

    it("discounts a recharge move against a comparable single-turn attack", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Hyper Beam"), buildMoveOption("Body Slam")] }),
        attacker: buildCombatant({ types: ["Normal"] }),
        defender: buildCombatant({ types: ["Rock"], maxHp: 400, currentHp: 400 }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Body Slam");
    });

    it("does not heal at full HP", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Recover"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant(),
        defender: buildCombatant(),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("heals when badly hurt and the incoming damage is survivable", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Recover"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ currentHp: 40 }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 20, spa: 20 }, knownMoves: ["Tackle"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Recover");
    });

    it("falls back to the only usable move even when it would fail", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Toxic")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ types: ["Steel"] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Toxic");
    });
  });

  describe("moves that cost HP", () => {
    it("does not use Substitute when it has any real attack, even a weak one", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({
          moves: [buildMoveOption("Substitute"), buildMoveOption("Tackle"), buildMoveOption("Quick Attack")],
        }),
        attacker: buildCombatant(),
        defender: buildCombatant({ types: ["Rock", "Steel"], maxHp: 400, currentHp: 400 }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Quick Attack");
    });

    it("does not use Substitute below the quarter of max HP it costs", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Substitute"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ currentHp: 30 }),
        defender: buildCombatant(),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not Substitute itself to death over repeated turns", () => {
      const attacker = buildCombatant();
      const request = buildRequest({ moves: [buildMoveOption("Substitute"), buildMoveOption("Tackle")] });
      const defender = buildCombatant({ types: ["Rock", "Steel"], maxHp: 400, currentHp: 400 });

      // Replay the same decision, charging Substitute its HP each time it is picked.
      let substitutes = 0;
      for (let turn = 0; turn < 8; turn++) {
        const choice = chooseTrainerMove({ request, attacker, defender, field: buildField(), rng: noJitter });
        if (choice !== "move Substitute") break;
        substitutes++;
        attacker.currentHp -= Math.floor(attacker.maxHp / 4);
      }

      expect(substitutes).toBe(0);
      expect(attacker.currentHp).toBe(attacker.maxHp);
    });

    it("does not use Belly Drum without the HP to pay for it", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Belly Drum"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ currentHp: 70 }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 20, spa: 20 } }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });
  });

  describe("accuracy the Dex number doesn't tell you", () => {
    it("uses Thunder over Thunderbolt in rain, where it cannot miss", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Thunderbolt"), buildMoveOption("Thunder")] }),
        attacker: buildCombatant({ types: ["Electric"] }),
        defender: buildCombatant(),
        field: buildField({ weather: "RainDance" }),
        rng: noJitter,
      });

      expect(choice).toBe("move Thunder");
    });

    it("falls back to Thunderbolt in sun, where Thunder is down to 50%", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Thunder"), buildMoveOption("Thunderbolt")] }),
        attacker: buildCombatant({ types: ["Electric"] }),
        defender: buildCombatant(),
        field: buildField({ weather: "SunnyDay" }),
        rng: noJitter,
      });

      expect(choice).toBe("move Thunderbolt");
    });

    it("does not use an OHKO move on a higher-level target", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Fissure"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ level: 40 }),
        defender: buildCombatant({ level: 50 }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("credits Compound Eyes for making a shaky sleep move reliable", () => {
      const request = buildRequest({ moves: [buildMoveOption("Hypnosis"), buildMoveOption("Tackle")] });
      // 25 Def puts Tackle around 40%, which clears Hypnosis at its listed 60% accuracy but not at
      // the 78% Compound Eyes takes it to — so the ability alone decides this.
      const defender = buildCombatant({ baseStats: { ...EVEN_STATS, def: 25 } });

      const withoutAbility = chooseTrainerMove({
        request,
        attacker: buildCombatant(),
        defender,
        field: buildField(),
        rng: noJitter,
      });
      const withAbility = chooseTrainerMove({
        request,
        attacker: buildCombatant({ ability: "Compound Eyes" }),
        defender,
        field: buildField(),
        rng: noJitter,
      });

      expect(withoutAbility).toBe("move Tackle");
      expect(withAbility).toBe("move Hypnosis");
    });
  });

  describe("state-dependent base power", () => {
    it("picks Gyro Ball over a stronger-on-paper move when badly outsped", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Gyro Ball"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ types: ["Steel"], baseStats: { ...EVEN_STATS, spe: 5 } }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, spe: 200 } }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Gyro Ball");
    });

    it("drops Gyro Ball once it is the faster Pokemon", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Gyro Ball"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ types: ["Steel"], baseStats: { ...EVEN_STATS, spe: 200 } }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, spe: 5 } }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("values Eruption at full HP and abandons it at low HP", () => {
      const moves = [buildMoveOption("Eruption"), buildMoveOption("Flamethrower")];
      const healthy = chooseTrainerMove({
        request: buildRequest({ moves }),
        attacker: buildCombatant({ types: ["Fire"] }),
        defender: buildCombatant(),
        field: buildField(),
        rng: noJitter,
      });
      const nearlyFainted = chooseTrainerMove({
        request: buildRequest({ moves }),
        attacker: buildCombatant({ types: ["Fire"], currentHp: 20 }),
        defender: buildCombatant(),
        field: buildField(),
        rng: noJitter,
      });

      expect(healthy).toBe("move Eruption");
      expect(nearlyFainted).toBe("move Flamethrower");
    });

    it("reaches for Hex only once the target is statused", () => {
      const moves = [buildMoveOption("Hex"), buildMoveOption("Shadow Ball")];
      // Psychic, not the fixture's default Normal, which is flatly immune to both moves.
      const healthyTarget = chooseTrainerMove({
        request: buildRequest({ moves }),
        attacker: buildCombatant({ types: ["Ghost"] }),
        defender: buildCombatant({ types: ["Psychic"], status: null }),
        field: buildField(),
        rng: noJitter,
      });
      const poisonedTarget = chooseTrainerMove({
        request: buildRequest({ moves }),
        attacker: buildCombatant({ types: ["Ghost"] }),
        defender: buildCombatant({ types: ["Psychic"], status: "psn" }),
        field: buildField(),
        rng: noJitter,
      });

      expect(healthyTarget).toBe("move Shadow Ball");
      expect(poisonedTarget).toBe("move Hex");
    });
  });

  describe("residual damage in the turn budget", () => {
    it("stops setting up once burn and sandstorm shorten the matchup", () => {
      const request = buildRequest({ moves: [buildMoveOption("Swords Dance"), buildMoveOption("Tackle")] });
      // A weak foe leaves plenty of turns on a clean field, so setup is the right call there.
      const defender = buildCombatant({ baseStats: { ...EVEN_STATS, atk: 30, spa: 30 } });

      const cleanField = chooseTrainerMove({
        request,
        attacker: buildCombatant({ currentHp: 40 }),
        defender,
        field: buildField(),
        rng: noJitter,
      });
      const chipped = chooseTrainerMove({
        request,
        attacker: buildCombatant({ currentHp: 40, status: "brn" }),
        defender,
        field: buildField({ weather: "Sandstorm" }),
        rng: noJitter,
      });

      expect(cleanField).toBe("move Swords Dance");
      expect(chipped).toBe("move Tackle");
    });
  });

  describe("hazards against the party that is left", () => {
    it("sets Stealth Rock when the player still has a bench to punish", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Stealth Rock"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 30 } }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, def: 200 } }),
        defenderPartyRemaining: 5,
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Stealth Rock");
    });

    it("does not set Stealth Rock against the player's last Pokemon", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Stealth Rock"), buildMoveOption("Tackle")] }),
        attacker: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 30 } }),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, def: 200 } }),
        defenderPartyRemaining: 1,
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });
  });

  describe("switching", () => {
    const FIRE_BENCH = {
      choice: "switch 2",
      moves: ["Flamethrower"],
      combatant: buildCombatant({ types: ["Fire"], ability: "Flash Fire" }),
    };
    const FRAIL_BENCH = {
      choice: "switch 3",
      moves: ["Tackle"],
      combatant: buildCombatant({ types: ["Normal"], currentHp: 15 }),
    };

    it("sends in the replacement that wins the matchup, not the first in party order", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({
          forceSwitch: true,
          switches: [
            { choice: "switch 3", name: "Frail" },
            { choice: "switch 2", name: "Fire" },
          ],
        }),
        attacker: buildCombatant(),
        // A Grass-type: the Fire-type teammate walls it and burns it down.
        defender: buildCombatant({ types: ["Grass"], knownMoves: ["Energy Ball"] }),
        bench: [FRAIL_BENCH, FIRE_BENCH],
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("switch 2");
    });

    it("falls back to the first switch option when no bench detail is supplied", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ forceSwitch: true, switches: [{ choice: "switch 4", name: "Pidgey" }] }),
        attacker: buildCombatant(),
        defender: buildCombatant(),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("switch 4");
    });

    it("pivots out of a matchup it is about to lose", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({
          moves: [buildMoveOption("Tackle")],
          switches: [{ choice: "switch 2", name: "Fire" }],
        }),
        // Barely alive, and its Normal attack does nothing much back.
        attacker: buildCombatant({ currentHp: 20, baseStats: { ...EVEN_STATS, atk: 20 } }),
        defender: buildCombatant({ types: ["Grass"], knownMoves: ["Energy Ball"] }),
        bench: [FIRE_BENCH],
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("switch 2");
    });

    it("stays in when it is winning, even with a good switch available", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({
          moves: [buildMoveOption("Flamethrower")],
          switches: [{ choice: "switch 2", name: "Fire" }],
        }),
        attacker: buildCombatant({ types: ["Fire"] }),
        defender: buildCombatant({ types: ["Grass"], knownMoves: ["Vine Whip"] }),
        bench: [FIRE_BENCH],
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Flamethrower");
    });

    it("does not pivot into a teammate that entry hazards would knock out", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({
          moves: [buildMoveOption("Tackle")],
          switches: [{ choice: "switch 3", name: "Frail" }],
        }),
        attacker: buildCombatant({ currentHp: 20, baseStats: { ...EVEN_STATS, atk: 20 } }),
        defender: buildCombatant({ types: ["Grass"], knownMoves: ["Energy Ball"] }),
        bench: [FRAIL_BENCH],
        field: buildField({ attackerHazards: { ...NO_HAZARDS, stealthRock: true, spikes: 3 } }),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });

    it("does not pivot while trapped", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({
          moves: [buildMoveOption("Tackle")],
          switches: [{ choice: "switch 2", name: "Fire" }],
          trapped: true,
        }),
        attacker: buildCombatant({ currentHp: 20, baseStats: { ...EVEN_STATS, atk: 20 } }),
        defender: buildCombatant({ types: ["Grass"], knownMoves: ["Energy Ball"] }),
        bench: [FIRE_BENCH],
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Tackle");
    });
  });

  describe("reading an unrevealed attacker", () => {
    it("lowers Attack on a Pokemon whose base stats say it is physical, before it reveals anything", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Growl"), buildMoveOption("Confide")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 150, spa: 30 }, knownMoves: [] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Growl");
    });

    it("lowers Sp. Atk on a Pokemon whose base stats say it is special", () => {
      const choice = chooseTrainerMove({
        request: buildRequest({ moves: [buildMoveOption("Growl"), buildMoveOption("Confide")] }),
        attacker: buildCombatant(),
        defender: buildCombatant({ baseStats: { ...EVEN_STATS, atk: 30, spa: 150 }, knownMoves: [] }),
        field: buildField(),
        rng: noJitter,
      });

      expect(choice).toBe("move Confide");
    });
  });
});
