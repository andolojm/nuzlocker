import { BattleStreams, Dex, Streams, Teams, toID } from "@pkmn/sim";
import type { PokemonSet } from "@pkmn/sim";
import { attemptCatch, statusCatchBonus } from "../encounter/catchPokemon";
import type { CatchAttemptResult } from "../encounter/catchPokemon";
import type { TeamPokemon } from "../engine/gameStateEngine";
import { StageType } from "../engine/stage";
import { battleNickname } from "./battleNickname";
import { parseStatusField, rawIdentName } from "./formatBattleLine";
import type { StatusCode } from "./formatBattleLine";

export type PlayerSlot = "p1" | "p2";

export interface BattleParticipant {
  name: string;
  team: TeamPokemon[];
}

export interface MoveOption {
  choice: string;
  name: string;
  disabled: boolean;
}

export interface SwitchOption {
  choice: string;
  name: string;
}

export interface BattleRequest {
  forceSwitch: boolean;
  moves: MoveOption[];
  switches: SwitchOption[];
  /** True only for the catching side of a StageType.Catch battle. */
  canAttemptCatch: boolean;
}

/** Return this sentinel from a ChoiceProvider to attempt a catch, only when request.canAttemptCatch is true. */
export const ATTEMPT_CATCH = "attempt-catch";

export type ChoiceProvider = (request: BattleRequest) => string | Promise<string>;

export interface FaintEvent {
  player: PlayerSlot;
  pokemon: string;
}

export interface BattleResult {
  winner: PlayerSlot | "tie" | null;
  log: string[];
  fainted: FaintEvent[];
  /** Set when a catch attempt succeeded and the battle was exited early. */
  caught?: TeamPokemon;
}

export const DEFAULT_FORMAT_ID = "gen9customgame";

/**
 * A @pkmn/sim-local addition (see DECLINE_ACTION.md in the @pkmn/sim repo) that lets a side submit
 * a genuine no-op turn — no move, no switch, no PP spent — for an active Pokemon. Used on a failed
 * catch attempt so the turn passes without forcing a real switch. Opt-in per format, zero effect
 * otherwise, so it's safe to always include.
 */
const DECLINE_ACTION_RULE = "Decline Action Mod";

/** Sent as the choice for a failed catch attempt now that Decline Action Mod is always enabled. */
const DECLINE_CHOICE = "decline";

export class SpeciesNotFoundError extends Error {
  constructor(name: string) {
    super(`Could not find a Pokémon Showdown species matching "${name}"`);
    this.name = "SpeciesNotFoundError";
  }
}

export class MoveNotFoundError extends Error {
  constructor(name: string) {
    super(`Could not find a Pokémon Showdown move matching "${name}"`);
    this.name = "MoveNotFoundError";
  }
}

// Every team member is treated as 0 EVs when converted to a Showdown team, since TeamPokemon
// has no per-Pokemon EV field yet. Exported for tests; UI code should NOT import this — this
// module pulls in @pkmn/sim, which must stay out of the browser bundle (duplicate the value
// instead, as PokemonInfoModal.tsx does).
export const NEUTRAL_EVS = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

function toShowdownIVs(ivs: TeamPokemon["ivs"]): PokemonSet["ivs"] {
  return {
    hp: ivs.HP,
    atk: ivs.Attack,
    def: ivs.Defense,
    spa: ivs["Sp. Attack"],
    spd: ivs["Sp. Defense"],
    spe: ivs.Speed,
  };
}

function toPokemonSet(pokemon: TeamPokemon, nickname: string): PokemonSet {
  const species = Dex.species.get(pokemon.name.english);
  if (!species.exists) throw new SpeciesNotFoundError(pokemon.name.english);

  const moves = pokemon.moves.map((move) => {
    const dexMove = Dex.moves.get(move.name.english);
    if (!dexMove.exists) throw new MoveNotFoundError(move.name.english);
    return dexMove.id;
  });

  return {
    name: nickname,
    species: species.name,
    item: "",
    ability: toID(species.abilities[0]),
    moves,
    nature: "Serious",
    gender: species.gender || "N",
    evs: { ...NEUTRAL_EVS },
    ivs: toShowdownIVs(pokemon.ivs),
    level: pokemon.level,
  };
}

export function buildShowdownTeam(pokemon: TeamPokemon[]): PokemonSet[] {
  if (pokemon.length === 0) {
    throw new Error("A battle participant needs at least one Pokemon");
  }
  return pokemon.map((p, index) => toPokemonSet(p, battleNickname(pokemon, index)));
}

interface RawMoveRequestData {
  move: string;
  disabled?: string | boolean;
}

interface RawSwitchRequestData {
  ident: string;
  active: boolean;
  details: string;
  condition: string;
}

interface RawChoiceRequest {
  teamPreview?: true;
  wait?: true;
  forceSwitch?: boolean[];
  active?: { moves: RawMoveRequestData[] }[];
  side: { pokemon: RawSwitchRequestData[] };
}

function toBattleRequest(raw: RawChoiceRequest, canAttemptCatch: boolean): BattleRequest {
  const moves: MoveOption[] = (raw.active?.[0]?.moves ?? []).map((move, index) => ({
    choice: `move ${index + 1}`,
    name: move.move,
    disabled: Boolean(move.disabled),
  }));

  const switches: SwitchOption[] = raw.side.pokemon
    .map((switchPokemon, index) => ({ switchPokemon, index }))
    .filter(({ switchPokemon }) => !switchPokemon.active && !switchPokemon.condition.endsWith("fnt"))
    .map(({ switchPokemon, index }) => ({
      choice: `switch ${index + 1}`,
      // Deliberately derived from ident (nickname), not details (species): a padded Catch-stage
      // team can have multiple same-species teammates (filler Magikarp), disambiguated only by
      // their battleNickname-assigned nickname, which only ident carries.
      name: rawIdentName(switchPokemon.ident),
    }));

  return {
    forceSwitch: Boolean(raw.forceSwitch?.some(Boolean)),
    moves,
    switches,
    canAttemptCatch,
  };
}

/** p2's HP, as reported to p1's own stream (public battle info), parsed from switch/damage/heal/faint lines. */
function extractFoeHpFraction(line: string): number | null {
  const parts = line.split("|");
  const type = parts[1];
  const ident = parts[2];
  if (!ident || !ident.startsWith("p2a:")) return null;

  if (type === "faint") return 0;
  if (type !== "switch" && type !== "drag" && type !== "-damage" && type !== "-heal" && type !== "-sethp") {
    return null;
  }

  const hpSegment = parts[parts.length - 1];
  const match = /^(\d+)\/(\d+)/.exec(hpSegment);
  return match ? Number(match[1]) / Number(match[2]) : null;
}

/**
 * p2's status, as reported to p1's own stream, parsed from switch/status lines. Returns undefined
 * when the line carries no status info at all (distinct from null, which means "no status" —
 * cured, freshly switched in healthy, or fainted).
 */
function extractFoeStatus(line: string): StatusCode | null | undefined {
  const parts = line.split("|");
  const type = parts[1];
  const ident = parts[2];
  if (!ident || !ident.startsWith("p2a:")) return undefined;

  if (type === "switch" || type === "drag") return parseStatusField(parts[parts.length - 1]);
  if (type === "-status") return (parts[3] as StatusCode) ?? null;
  if (type === "-curestatus" || type === "faint") return null;
  return undefined;
}

interface SimulatorPlayerOptions {
  chooseAction: ChoiceProvider;
  /** The wild Pokemon this player may attempt to catch. Only set for the catching side. */
  catchTarget?: TeamPokemon;
  onCatchAttempt?: (result: CatchAttemptResult) => void;
  /** Injectable RNG for the catch roll itself, distinct from the battle engine's own seed. */
  catchRandom?: () => number;
  /** Catch-rate ball multiplier for this side's catch attempts (Poké Ball = 1). */
  ballBonus?: number;
  /**
   * Since chooseAction may now be asynchronous (awaiting UI input), a throw inside
   * receiveRequest happens inside a detached async call that nothing else awaits — without this,
   * it would become an unhandled rejection instead of failing the battle.
   */
  onError: (error: Error) => void;
}

class SimulatorPlayer extends BattleStreams.BattlePlayer {
  private readonly chooseAction: ChoiceProvider;
  private readonly catchTarget?: TeamPokemon;
  private readonly onCatchAttempt?: (result: CatchAttemptResult) => void;
  private readonly catchRandom?: () => number;
  private readonly ballBonus: number;
  private readonly onError: (error: Error) => void;
  private foeHpFraction = 1;
  private foeStatus: StatusCode | null = null;
  private caught = false;

  constructor(stream: Streams.ObjectReadWriteStream<string>, options: SimulatorPlayerOptions) {
    super(stream);
    this.chooseAction = options.chooseAction;
    this.catchTarget = options.catchTarget;
    this.onCatchAttempt = options.onCatchAttempt;
    this.catchRandom = options.catchRandom;
    this.ballBonus = options.ballBonus ?? 1;
    this.onError = options.onError;
  }

  receiveLine(line: string): void {
    const hpFraction = extractFoeHpFraction(line);
    if (hpFraction !== null) this.foeHpFraction = hpFraction;
    const status = extractFoeStatus(line);
    if (status !== undefined) this.foeStatus = status;
    super.receiveLine(line);
  }

  receiveRequest(request: RawChoiceRequest): void {
    this.handleRequest(request).catch(this.onError);
  }

  private async handleRequest(request: RawChoiceRequest): Promise<void> {
    if (this.caught || request.wait) return;

    if (request.teamPreview) {
      const order = request.side.pokemon.map((_, index) => index + 1).join("");
      this.choose(`team ${order}`);
      return;
    }

    const battleRequest = toBattleRequest(request, Boolean(this.catchTarget));
    const chosen = await this.chooseAction(battleRequest);

    if (chosen !== ATTEMPT_CATCH) {
      this.choose(chosen);
      return;
    }

    if (!this.catchTarget || !this.onCatchAttempt) {
      throw new Error("This battle doesn't support catching");
    }

    const result = attemptCatch(this.catchTarget, {
      currentHpFraction: this.foeHpFraction,
      ballBonus: this.ballBonus,
      statusBonus: statusCatchBonus(this.foeStatus),
      random: this.catchRandom,
    });
    this.onCatchAttempt(result);

    if (result.caught) {
      this.caught = true;
      return;
    }

    this.choose(DECLINE_CHOICE);
  }
}

export type BattleSeed = [number, number, number, number];

export class BattleSimulator {
  private readonly p1: BattleParticipant;
  private readonly p2: BattleParticipant;
  private readonly stageType: StageType;
  private readonly formatId: string;
  private readonly seed?: BattleSeed;
  private readonly catchRandom?: () => number;
  private readonly onLog?: (line: string) => void;
  private readonly catchListener?: (result: CatchAttemptResult) => void;
  private readonly ballBonus: number;

  constructor(
    p1: BattleParticipant,
    p2: BattleParticipant,
    stageType: StageType,
    formatId: string = DEFAULT_FORMAT_ID,
    seed?: BattleSeed,
    catchRandom?: () => number,
    onLog?: (line: string) => void,
    catchListener?: (result: CatchAttemptResult) => void,
    ballBonus: number = 1,
  ) {
    this.p1 = p1;
    this.p2 = p2;
    this.stageType = stageType;
    this.formatId = formatId;
    this.seed = seed;
    this.catchRandom = catchRandom;
    this.onLog = onLog;
    this.catchListener = catchListener;
    this.ballBonus = ballBonus;
  }

  async run(chooseP1: ChoiceProvider, chooseP2: ChoiceProvider): Promise<BattleResult> {
    const p1Team = buildShowdownTeam(this.p1.team);
    const p2Team = buildShowdownTeam(this.p2.team);
    const catchTarget = this.stageType === StageType.Catch ? this.p2.team[0] : undefined;

    const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

    const log: string[] = [];
    const fainted: FaintEvent[] = [];

    return new Promise<BattleResult>((resolve, reject) => {
      const handleCatchAttempt = (result: CatchAttemptResult) => {
        this.catchListener?.(result);
        if (!result.caught || !catchTarget) return;
        resolve({ winner: null, log, fainted, caught: catchTarget });
        void Promise.resolve(streams.omniscient.destroy()).catch(() => {});
      };

      const player1 = new SimulatorPlayer(streams.p1, {
        chooseAction: chooseP1,
        catchTarget,
        onCatchAttempt: catchTarget ? handleCatchAttempt : undefined,
        catchRandom: this.catchRandom,
        ballBonus: this.ballBonus,
        onError: reject,
      });
      const player2 = new SimulatorPlayer(streams.p2, { chooseAction: chooseP2, onError: reject });

      void (async () => {
        try {
          for await (const chunk of streams.omniscient) {
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("|")) continue;
              log.push(line);
              this.onLog?.(line);

              if (line.startsWith("|faint|")) {
                const pokemon = line.slice("|faint|".length);
                fainted.push({ player: pokemon.startsWith("p1") ? "p1" : "p2", pokemon });
              } else if (line.startsWith("|win|")) {
                const winnerName = line.slice("|win|".length);
                resolve({ winner: winnerName === this.p1.name ? "p1" : "p2", log, fainted });
                return;
              } else if (line === "|tie|") {
                resolve({ winner: "tie", log, fainted });
                return;
              }
            }
          }
          resolve({ winner: null, log, fainted });
        } catch (error) {
          reject(error as Error);
        }
      })();

      void player1.start().catch(reject);
      void player2.start().catch(reject);

      // Battle's constructor resolves customRules by parsing an "@@@"-separated suffix off
      // formatid itself (dex.formats.get) — a top-level customRules field in the spec is ignored.
      const spec = {
        formatid: `${this.formatId}@@@${DECLINE_ACTION_RULE}`,
        ...(this.seed ? { seed: this.seed } : {}),
      };
      const p1spec = { name: this.p1.name, team: Teams.pack(p1Team) };
      const p2spec = { name: this.p2.name, team: Teams.pack(p2Team) };

      void Promise.resolve(
        streams.omniscient.write(
          `>start ${JSON.stringify(spec)}\n>player p1 ${JSON.stringify(p1spec)}\n>player p2 ${JSON.stringify(p2spec)}`,
        ),
      ).catch(reject);
    });
  }
}
