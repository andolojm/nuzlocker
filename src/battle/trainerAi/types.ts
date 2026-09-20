import type { BattleRequest } from "../battleSimulator";
import type { StatusCode } from "../formatBattleLine";

export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

export interface StatTable {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/** Stat stage (-6..6) by short stat key (atk, def, spa, spd, spe, accuracy, evasion). Omitted/zero stats are unboosted. */
export type Boosts = Record<string, number>;

export function clampBoost(value: number): number {
  return Math.max(-6, Math.min(6, value));
}

/** Converts a base-stat-shaped object (species base stats, or an IV spread — same field names) to the short-key StatTable this module works with. */
export function toStatTable(stats: {
  HP: number;
  Attack: number;
  Defense: number;
  "Sp. Attack": number;
  "Sp. Defense": number;
  Speed: number;
}): StatTable {
  return {
    hp: stats.HP,
    atk: stats.Attack,
    def: stats.Defense,
    spa: stats["Sp. Attack"],
    spd: stats["Sp. Defense"],
    spe: stats.Speed,
  };
}

export interface Combatant {
  types: string[];
  level: number;
  /**
   * Species name, for the handful of moves whose power reads off the Dex entry rather than off
   * battle state (Low Kick, Heavy Slam). Public information in a real battle, so it is known for
   * both sides; absent only leaves those moves on their generic fallback power.
   */
  species?: string;
  /** Species base stats (no IVs/EVs baked in). */
  baseStats: StatTable;
  /**
   * Individual values, 0-31 per stat. Omit for a Pokemon whose true IVs the trainer AI has no way
   * to know (the human player's active Pokemon) — its real stats are then treated as a min..max
   * range (see `compareSpeed`) instead of an exact value.
   */
  ivs?: StatTable;
  boosts: Boosts;
  currentHp: number;
  maxHp: number;
  status: StatusCode | null;
  /** Own ability is always known; the opponent's is only known once revealed in battle. */
  ability?: string;
  /**
   * Moves this Pokemon is confirmed to know. Only ever populated for the human player's Pokemon,
   * restricted to moves already revealed in this battle — the AI's own moveset is already fully
   * available via `TrainerAiContext.request.moves`, so this field doesn't apply to it.
   */
  knownMoves?: string[];
}

export type SpeedComparison = "win" | "lose" | "range";

export interface HazardState {
  stealthRock: boolean;
  /** Layers, 0-3. */
  spikes: number;
  /** Layers, 0-2. */
  toxicSpikes: number;
  stickyWeb: boolean;
}

export const NO_HAZARDS: HazardState = { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false };

export interface FieldConditions {
  /** Raw Showdown weather id ("RainDance", "SunnyDay", "Sandstorm", "Hail", "Snow"), or null. */
  weather: string | null;
  /** Terrain name as Showdown reports it ("Electric Terrain", etc.), or null. */
  terrain: string | null;
  /** Entry hazards on the defender's side — the side the attacker's own hazard moves would affect. */
  defenderHazards: HazardState;
  /** Entry hazards on the attacker's own side — what its own switch-ins would walk into. Omitted means none are tracked. */
  attackerHazards?: HazardState;
}

/** A benched teammate the AI could switch to, paired with the request choice that brings it in. */
export interface BenchOption {
  /** The `switch N` string to return from `chooseMove` to bring this Pokemon in. */
  choice: string;
  combatant: Combatant;
  /** Move names this teammate knows. Always fully known — this is the AI's own team. */
  moves: string[];
}

/**
 * Everything a trainer AI implementation is given to decide its move with. This is the whole
 * contract new implementations are built against — keep it self-contained (no hidden globals) so
 * an implementation's behavior is fully determined by its inputs and reproducible in tests.
 */
export interface TrainerAiContext {
  request: BattleRequest;
  /** The AI's own active Pokemon. */
  attacker: Combatant;
  /** The player's active Pokemon. */
  defender: Combatant;
  /**
   * The AI's own healthy benched teammates — one per `request.switches` entry, carrying the state
   * needed to judge the matchup each would walk into. Omitted or empty means there is no switch to
   * evaluate and a move has to be picked.
   */
  bench?: BenchOption[];
  /**
   * Healthy Pokemon left on the player's side, the active one included. Drives what a hazard is
   * worth: with nobody left to switch in, setting one is a wasted turn. Omitted means unknown, and
   * hazards fall back to a flat value.
   */
  defenderPartyRemaining?: number;
  field: FieldConditions;
  /** Injectable for deterministic tests; defaults to Math.random. */
  rng?: () => number;
}

/** A selectable trainer AI. `id` is the persisted/storage key; `label` is shown in the dev tools dropdown. */
export interface TrainerAiImplementation {
  id: string;
  label: string;
  /** Picks the opposing trainer's move (or switch) for the given battle request/state. */
  chooseMove(ctx: TrainerAiContext): string;
}
