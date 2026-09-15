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
});
