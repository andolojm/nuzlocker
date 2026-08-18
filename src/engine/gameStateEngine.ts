import type { Item, LocalizedName, Move, Pokemon } from "../api/pikaserve";
import type { StageType } from "./stage";

export type FourMoves = [Move, Move, Move, Move];

export interface TeamPokemon extends Pokemon {
  moves: FourMoves;
  level: number;
  /** Species id this Pokemon evolves into, if it evolves at all. */
  evolvesInto?: number;
  /** Level `evolvesInto` kicks in at — parsed off a level-based condition, or rolled once otherwise. */
  evolutionLevel?: number;
}

/** Duplicated from battleSimulator.ts's identical type — engine code shouldn't import that module, since it pulls in @pkmn/sim. */
export type BattleSeed = [number, number, number, number];

/**
 * Enough to replay an in-progress battle: the recorded sequence of the human player's choices,
 * replayed against a fresh BattleSimulator seeded identically. The opponent AI's choices aren't
 * recorded — they're pure functions of (request, seeded rng, board state) and re-derive identically.
 */
export interface BattleReplayLog {
  /** gameState.state at battle start, to sanity-check on resume. */
  stageIndex: number;
  stageType: StageType;
  playerName: string;
  playerTeam: TeamPokemon[];
  opponentName: string;
  opponentTeam: TeamPokemon[];
  /** Drives the Showdown sim's own RNG (accuracy/crit/etc.). */
  battleSeed: BattleSeed;
  /** Drives trainer-AI move-choice jitter and catch rolls. */
  auxSeed: BattleSeed;
  /** One entry per resolved chooseP1 call, in order. */
  choices: string[];
}

export interface AlivePokemon extends TeamPokemon {
  /** Position (1-6) in the active battle team, or undefined if not currently on it. */
  active?: number;
}

/** A TM/HM in the player's possession, already resolved to the one specific move it teaches. */
export interface OwnedTM {
  id: number;
  name: LocalizedName;
  move: Move;
}

export const MAX_ACTIVE_TEAM_SIZE = 6;

export interface GameState {
  state: number;
  pokemon: {
    alive: AlivePokemon[];
    dead: TeamPokemon[];
  };
  bag: Item[];
  tms: OwnedTM[];
  battleLog: BattleReplayLog | null;
}

export const GAME_STATE_STORAGE_KEY = "nuzlocker:game-state";

function createInitialState(): GameState {
  return {
    state: 0,
    pokemon: { alive: [], dead: [] },
    bag: [],
    tms: [],
    battleLog: null,
  };
}

/** Backfills fields added after a state may have been saved/exported, so old data doesn't break. */
function withDefaults(state: GameState): GameState {
  return { ...state, tms: state.tms ?? [], battleLog: state.battleLog ?? null };
}

function getStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function isGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.state !== "number") return false;
  if (!Array.isArray(candidate.bag)) return false;

  const pokemon = candidate.pokemon as Record<string, unknown> | undefined;
  return (
    typeof pokemon === "object" && pokemon !== null && Array.isArray(pokemon.alive) && Array.isArray(pokemon.dead)
  );
}

export class GameStateEngine {
  private gameState: GameState;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.gameState = GameStateEngine.load();
  }

  get current(): GameState {
    return this.gameState;
  }

  /** Registers a listener to be called after every mutation. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(gameState: GameState): void {
    this.gameState = gameState;
    getStorage()?.setItem(GAME_STATE_STORAGE_KEY, JSON.stringify(this.gameState));
    for (const listener of this.listeners) listener();
  }

  private static load(): GameState {
    const raw = getStorage()?.getItem(GAME_STATE_STORAGE_KEY);
    if (!raw) return createInitialState();

    try {
      return withDefaults(JSON.parse(raw) as GameState);
    } catch {
      return createInitialState();
    }
  }

  addItem(item: Item): void {
    this.commit({ ...this.gameState, bag: [...this.gameState.bag, item] });
  }

  removeItem(id: number): void {
    const index = this.gameState.bag.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Item with id ${id} is not in the bag`);
    }

    const bag = [...this.gameState.bag];
    bag.splice(index, 1);
    this.commit({ ...this.gameState, bag });
  }

  addPokemon(pokemon: TeamPokemon, active?: number): void {
    const alivePokemon: AlivePokemon = { ...pokemon, active };
    this.commit({
      ...this.gameState,
      pokemon: { ...this.gameState.pokemon, alive: [...this.gameState.pokemon.alive, alivePokemon] },
    });
  }

  /**
   * Adds a newly caught Pokemon, joining the active team if there's a free slot (fewer than
   * MAX_ACTIVE_TEAM_SIZE currently active), otherwise added inactive like any other addPokemon call.
   */
  addCaughtPokemon(pokemon: TeamPokemon): void {
    const activeCount = this.gameState.pokemon.alive.filter((p) => p.active !== undefined).length;
    const active = activeCount < MAX_ACTIVE_TEAM_SIZE ? activeCount + 1 : undefined;
    this.addPokemon(pokemon, active);
  }

  /** Deletes every Pokemon, alive and dead. */
  clearPokemon(): void {
    this.commit({ ...this.gameState, pokemon: { alive: [], dead: [] } });
  }

  /** Wipes the run back to its starting point: no Pokemon, no items, stage 0. */
  resetRun(): void {
    this.commit(createInitialState());
  }

  /** Sets the active battle team, in order. Everyone else in the alive party is cleared to inactive. */
  setActiveTeam(team: AlivePokemon[]): void {
    if (team.length > MAX_ACTIVE_TEAM_SIZE) {
      throw new Error(`Active team can have at most ${MAX_ACTIVE_TEAM_SIZE} Pokemon, got ${team.length}`);
    }

    for (const pokemon of team) {
      if (this.gameState.pokemon.alive.indexOf(pokemon) === -1) {
        throw new Error(`Pokemon "${pokemon.name.english}" is not in the alive party`);
      }
    }

    const order = new Map(team.map((pokemon, index) => [pokemon, index + 1]));
    const alive = this.gameState.pokemon.alive.map((pokemon) => {
      const active = order.get(pokemon);
      return pokemon.active === active ? pokemon : { ...pokemon, active };
    });

    this.commit({ ...this.gameState, pokemon: { ...this.gameState.pokemon, alive } });
  }

  markPokemonDead(pokemon: AlivePokemon): void {
    const index = this.gameState.pokemon.alive.indexOf(pokemon);
    if (index === -1) {
      throw new Error(`Pokemon "${pokemon.name.english}" is not in the alive party`);
    }

    const { active: _active, ...deadPokemon } = pokemon;
    const alive = [...this.gameState.pokemon.alive];
    alive.splice(index, 1);

    this.commit({
      ...this.gameState,
      pokemon: { alive, dead: [...this.gameState.pokemon.dead, deadPokemon] },
    });
  }

  addTM(tm: OwnedTM): void {
    this.commit({ ...this.gameState, tms: [...this.gameState.tms, tm] });
  }

  /**
   * Teaches `tm`'s move to `pokemon` at `moveIndex`, replacing whatever move was there, and
   * consumes the TM in the same commit. `pokemon` must be the exact live reference currently in
   * the alive party (as with markPokemonDead/setActiveTeam), and `tm` the exact reference in tms.
   */
  teachMove(pokemon: AlivePokemon, moveIndex: number, tm: OwnedTM): void {
    const pokemonIndex = this.gameState.pokemon.alive.indexOf(pokemon);
    if (pokemonIndex === -1) {
      throw new Error(`Pokemon "${pokemon.name.english}" is not in the alive party`);
    }

    const tmIndex = this.gameState.tms.indexOf(tm);
    if (tmIndex === -1) {
      throw new Error(`TM "${tm.name.english}" is not in the tms list`);
    }

    if (moveIndex < 0 || moveIndex > 3) {
      throw new Error(`Move index must be 0-3, got ${moveIndex}`);
    }

    const moves = [...pokemon.moves] as FourMoves;
    moves[moveIndex] = tm.move;

    const alive = [...this.gameState.pokemon.alive];
    alive[pokemonIndex] = { ...pokemon, moves };

    const tms = [...this.gameState.tms];
    tms.splice(tmIndex, 1);

    this.commit({ ...this.gameState, pokemon: { ...this.gameState.pokemon, alive }, tms });
  }

  /**
   * Sets `pokemon`'s level directly. `pokemon` must be the exact live reference currently in the
   * alive party (as with markPokemonDead/setActiveTeam/teachMove). Returns the new reference,
   * since callers holding their own copy of `pokemon` (e.g. local component state) need it to
   * stay in sync with what's now stored here — other engine methods key off exact identity.
   */
  setPokemonLevel(pokemon: AlivePokemon, level: number): AlivePokemon {
    const index = this.gameState.pokemon.alive.indexOf(pokemon);
    if (index === -1) {
      throw new Error(`Pokemon "${pokemon.name.english}" is not in the alive party`);
    }

    const alive = [...this.gameState.pokemon.alive];
    const leveled = { ...pokemon, level };
    alive[index] = leveled;

    this.commit({ ...this.gameState, pokemon: { ...this.gameState.pokemon, alive } });
    return leveled;
  }

  /**
   * Replaces `pokemon` with its evolved form, preserving its active-team slot. `pokemon` must be
   * the exact live reference currently in the alive party (as with setPokemonLevel). Returns the
   * new reference for the same reason setPokemonLevel does.
   */
  evolvePokemon(pokemon: AlivePokemon, evolvedInto: TeamPokemon): AlivePokemon {
    const index = this.gameState.pokemon.alive.indexOf(pokemon);
    if (index === -1) {
      throw new Error(`Pokemon "${pokemon.name.english}" is not in the alive party`);
    }

    const alive = [...this.gameState.pokemon.alive];
    const evolved: AlivePokemon = { ...evolvedInto, active: pokemon.active };
    alive[index] = evolved;

    this.commit({ ...this.gameState, pokemon: { ...this.gameState.pokemon, alive } });
    return evolved;
  }

  progressState(): void {
    this.commit({ ...this.gameState, state: this.gameState.state + 1 });
  }

  regressState(): void {
    this.commit({ ...this.gameState, state: Math.max(0, this.gameState.state - 1) });
  }

  startBattleLog(log: BattleReplayLog): void {
    this.commit({ ...this.gameState, battleLog: log });
  }

  recordBattleChoice(choice: string): void {
    if (!this.gameState.battleLog) return;
    this.commit({
      ...this.gameState,
      battleLog: { ...this.gameState.battleLog, choices: [...this.gameState.battleLog.choices, choice] },
    });
  }

  clearBattleLog(): void {
    this.commit({ ...this.gameState, battleLog: null });
  }

  /** Serializes the current game state to JSON, for sharing/debugging via copy-paste. */
  exportState(): string {
    return JSON.stringify(this.gameState, null, 2);
  }

  /** Replaces the current game state from JSON previously produced by exportState(). Throws on invalid input. */
  importState(json: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("That's not valid JSON.");
    }

    if (!isGameState(parsed)) {
      throw new Error("That doesn't look like a Nuzlocker game state.");
    }

    this.commit(withDefaults(parsed));
  }
}

export const gameStateEngine = new GameStateEngine();
