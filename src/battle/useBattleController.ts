import { PRNG } from "@pkmn/sim";
import { useCallback, useEffect, useRef, useState } from "react";
import { BERRY_TYPE } from "../api/berries";
import type { Item, Move } from "../api/pikaserve";
import { getSelectedTrainerAiId } from "../api/trainerAiSetting";
import type { PartySlot } from "../components/battle/partySlot";
import type { CatchAttemptResult } from "../encounter/catchPokemon";
import { MAX_ACTIVE_TEAM_SIZE, gameStateEngine } from "../engine/gameStateEngine";
import type { BattleReplayLog, BattleSeed, OwnedTM, TeamPokemon } from "../engine/gameStateEngine";
import type { StageType } from "../engine/stage";
import { awardCatchBerries, awardVictoryBerries } from "../engine/berryRewards";
import { awardCatchHeldItems, awardVictoryHeldItems } from "../engine/heldItemRewards";
import { awardCatchTM, awardVictoryTMs } from "../engine/tmRewards";
import { battleNickname } from "./battleNickname";
import type { BattleParticipant, BattleRequest, ChoiceProvider } from "./battleSimulator";
import { ATTEMPT_CATCH, ATTEMPT_RUN, BattleSimulator } from "./battleSimulator";
import { formatBattleLine, parseStatusField, rawIdentName } from "./formatBattleLine";
import type { StatusCode } from "./formatBattleLine";
import type { Boosts, Combatant, FieldConditions, HazardState } from "./trainerAi";
import { NO_HAZARDS, clampBoost, getTrainerAiImplementation, toStatTable } from "./trainerAi";

export type { Boosts };

/** Mirrors @pkmn/sim's internal Gen5RNG.generateSeed(), which isn't itself exported. */
function generateBattleSeed(): BattleSeed {
  return [
    Math.trunc(Math.random() * 2 ** 16),
    Math.trunc(Math.random() * 2 ** 16),
    Math.trunc(Math.random() * 2 ** 16),
    Math.trunc(Math.random() * 2 ** 16),
  ];
}

/** Persists `choice` to the ongoing battle's replay log, then resolves the pending decision. */
function resolveAndRecord(resolve: (choice: string) => void, choice: string): void {
  gameStateEngine.recordBattleChoice(choice);
  resolve(choice);
}

export type BattlePhase =
  | "battle"
  | "results"
  | "forced-switch"
  | "victory"
  | "defeat"
  | "defeat-summary"
  | "caught"
  | "ran";

const BOOST_STATS = ["atk", "def", "spa", "spd", "spe", "accuracy", "evasion"];

/** Flavor text for a failed catch attempt, indexed by CatchAttemptResult.shakes (0-3). */
const CATCH_FAIL_MESSAGES = [
  "Oh no! The wild Pokémon broke free!",
  "Aw! It appeared to be caught!",
  "Aargh! Almost had it!",
  "Gah! It was so close, too!",
];

export function catchFailureMessage(shakes: number): string {
  return CATCH_FAIL_MESSAGES[shakes] ?? CATCH_FAIL_MESSAGES[0];
}

export interface HpValue {
  current: number;
  max: number;
}

/**
 * For a `|-enditem|` line, which Pokemon lost the item and what it was — null for any other line.
 * The subject is always the Pokemon the item left, never one that took it: plucking the opponent's
 * berry reports `|-enditem|p2a: Foe|Oran Berry|[from] stealeat|[of] p1a: Mine`, so reading the
 * subject (rather than the actor) leaves the plucker's own berry alone.
 */
export function parseItemLoss(line: string): { ident: string; item: string } | null {
  const parts = line.split("|");
  if (parts[1] !== "-enditem" || !parts[2] || !parts[3]) return null;
  return { ident: parts[2], item: parts[3] };
}

/**
 * True when the engine offers no real choice this turn: a locked continuation move (e.g. Fly's
 * second turn, Outrage), a forced recharge (Hyper Beam, Giga Impact), or Struggle (no PP left
 * anywhere). In all of these, Showdown collapses `active[0].moves` to at most one entry instead
 * of the Pokemon's full 4-move list, so this doubles as a general "auto-continue" signal.
 */
export function isForcedContinuation(request: BattleRequest): boolean {
  return !request.forceSwitch && request.moves.length <= 1;
}

export interface UseBattleControllerResult {
  phase: BattlePhase;
  playerPokemon: TeamPokemon;
  opponentPokemon: TeamPokemon;
  playerHp: HpValue;
  opponentHp: HpValue;
  playerStatus: StatusCode | null;
  opponentStatus: StatusCode | null;
  /** Whether the active player/opponent Pokemon is currently blocked from voluntarily switching (e.g. Fire Spin). */
  playerTrapped: boolean;
  opponentTrapped: boolean;
  /** Display names of moves the active opponent Pokemon has been seen using so far this battle. */
  opponentRevealedMoves: string[];
  /** Stat stage changes on the active player/opponent Pokemon, keyed by short stat name. */
  playerBoosts: Boosts;
  opponentBoosts: Boosts;
  playerParty: PartySlot[];
  /** Whether each Pokemon in the opponent's party (in team order) has fainted. */
  opponentPartyFainted: boolean[];
  turnEvents: string[];
  /** Every turn's recap so far, each prefixed with a `Turn N: <player> (lvX) \ <opponent> (lvY)` header line. */
  battleLog: string[];
  submitMove: (move: Move) => void;
  submitSwitch: (pokemon: TeamPokemon) => void;
  /** Attempts to catch the wild Pokemon. No-op unless the pending request allows it. */
  submitCatch: () => void;
  /** Flees the wild encounter, ending the battle with no reward. No-op unless the pending request allows it. */
  submitRun: () => void;
  /** Dismisses the results/victory/defeat/caught/ran screen and moves on to whatever's next. */
  advance: () => void;
  /** TM(s) awarded for the current victory/catch, if any. Empty outside those phases. */
  awardedTMs: OwnedTM[];
  /** Held item(s) awarded for the current victory/catch, if any. Empty outside those phases. */
  awardedItems: Item[];
  /** Berries awarded for the current victory/catch, if any. Empty outside those phases. */
  awardedBerries: Item[];
}

interface Snapshot {
  playerHp: HpValue[];
  playerActiveIndex: number;
  opponentHp: HpValue[];
  opponentActiveIndex: number;
  playerStatus: (StatusCode | null)[];
  opponentStatus: (StatusCode | null)[];
  /** Display names of moves the opponent's active Pokemon have been seen using, in first-seen order. */
  opponentRevealedMoves: string[][];
  playerBoosts: Boosts[];
  opponentBoosts: Boosts[];
  /** Whether the active player/opponent Pokemon is currently blocked from voluntarily switching (e.g. Fire Spin). */
  playerTrapped: boolean;
  opponentTrapped: boolean;
}

function fullHp(pokemon: TeamPokemon): HpValue {
  return { current: pokemon.base.HP, max: pokemon.base.HP };
}

function parseHpField(hpField: string, maxFallback: number): HpValue {
  const match = /^(\d+)\/(\d+)/.exec(hpField);
  if (match) return { current: Number(match[1]), max: Number(match[2]) };
  return { current: 0, max: maxFallback };
}

/**
 * Runs a BattleSimulator battle, exposing React state driven by the protocol log so a UI can
 * present it turn-by-turn: choose -> results -> (forced switch ->) choose again -> ... -> outcome.
 *
 * `player`/`opponent`/`stageType`/`ballBonus`/`resume` are only read on the first render — this
 * hook is meant to be used in a component that's remounted (via a `key`) for each new battle.
 *
 * When `resume` is given, the battle is replayed deterministically up to the point it was saved
 * (same seeds, same recorded player choices — the AI's choices re-derive identically since it's a
 * pure function of seeded rng + board state) before handing control back to the live UI.
 */
export function useBattleController(
  player: BattleParticipant,
  opponent: BattleParticipant,
  stageType: StageType,
  ballBonus: number,
  resume?: BattleReplayLog,
): UseBattleControllerResult {
  const startedRef = useRef(false);

  const playerHpRef = useRef<HpValue[]>(player.team.map(fullHp));
  const playerActiveIndexRef = useRef(0);
  const opponentHpRef = useRef<HpValue[]>(opponent.team.map(fullHp));
  const opponentActiveIndexRef = useRef(0);
  const playerStatusRef = useRef<(StatusCode | null)[]>(player.team.map(() => null));
  const opponentStatusRef = useRef<(StatusCode | null)[]>(opponent.team.map(() => null));
  const deadReportedRef = useRef(new Set<number>());
  const opponentRevealedMovesRef = useRef<string[][]>(opponent.team.map(() => []));
  /** Display names of moves the player's active Pokemon have been seen using, in first-seen order — this (not the full moveset) is what the trainer AI is allowed to know about the player's Pokemon. */
  const playerRevealedMovesRef = useRef<string[][]>(player.team.map(() => []));
  /** The player's active Pokemon's ability, once revealed in battle (e.g. an -ability activation) — undefined until then. */
  const playerRevealedAbilityRef = useRef<(string | undefined)[]>(player.team.map(() => undefined));
  const playerBoostsRef = useRef<Boosts[]>(player.team.map(() => ({})));
  const opponentBoostsRef = useRef<Boosts[]>(opponent.team.map(() => ({})));
  /** Whether the player's active Pokemon is blocked from voluntarily switching — read straight off
   * the sim's own request (set in chooseP1 below), so it covers every trap source, silent
   * abilities (Shadow Tag, Arena Trap) included, and always matches what the switch menu offers. */
  const playerTrappedRef = useRef(false);
  /**
   * Whether the opponent's active Pokemon is trapped — inferred from the battle log (see
   * applyLogLine's `-activate`/`-damage`/`-end` handling below) rather than its own request,
   * since that request is delivered on a separate stream than the player's and isn't guaranteed
   * to have been processed yet by the time the player's turn snapshot is taken. Log lines are
   * safe to rely on here because they're always fully flushed before either side's next request,
   * the same guarantee opponentHp/opponentStatus above already depend on. This only catches
   * moves that announce themselves (Fire Spin, Mean Look, ...) — same as what the player would
   * actually see in a real battle — not silent trapping abilities on the opponent's side.
   */
  const opponentTrappedRef = useRef(false);
  const weatherRef = useRef<string | null>(null);
  const terrainRef = useRef<string | null>(null);
  /** Entry hazards on the player's side of the field — only ever set by the opposing trainer's own hazard moves. */
  const playerHazardsRef = useRef<HazardState>(NO_HAZARDS);
  const logBufferRef = useRef<string[]>([]);
  const turnNumberRef = useRef(1);
  /** Which Pokemon were active at the *start* of the turn currently being buffered, for the next battle log header. */
  const turnHeaderRef = useRef({ playerIndex: 0, opponentIndex: 0 });
  const isFirstDecisionRef = useRef(!resume || resume.choices.length === 0);
  const replayIndexRef = useRef(0);
  const pendingRequestRef = useRef<BattleRequest | null>(null);
  const resolveChoiceRef = useRef<((choice: string) => void) | null>(null);
  const outcomeRef = useRef<"p1" | "p2" | "tie" | null>(null);
  /** Synthetic (non-protocol) lines from a failed catch attempt, prepended to the next results flush. */
  const pendingCatchMessagesRef = useRef<string[]>([]);

  const [phase, setPhase] = useState<BattlePhase>("battle");
  const [turnEvents, setTurnEvents] = useState<string[]>([]);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [awardedTMs, setAwardedTMs] = useState<OwnedTM[]>([]);
  const [awardedItems, setAwardedItems] = useState<Item[]>([]);
  const [awardedBerries, setAwardedBerries] = useState<Item[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    playerHp: playerHpRef.current,
    playerActiveIndex: 0,
    opponentHp: opponentHpRef.current,
    opponentActiveIndex: 0,
    playerStatus: playerStatusRef.current,
    opponentStatus: opponentStatusRef.current,
    opponentRevealedMoves: opponentRevealedMovesRef.current,
    playerBoosts: playerBoostsRef.current,
    opponentBoosts: opponentBoostsRef.current,
    playerTrapped: playerTrappedRef.current,
    opponentTrapped: opponentTrappedRef.current,
  }));

  const takeSnapshot = useCallback(
    (): Snapshot => ({
      playerHp: [...playerHpRef.current],
      playerActiveIndex: playerActiveIndexRef.current,
      opponentHp: [...opponentHpRef.current],
      opponentActiveIndex: opponentActiveIndexRef.current,
      playerStatus: [...playerStatusRef.current],
      opponentStatus: [...opponentStatusRef.current],
      opponentRevealedMoves: opponentRevealedMovesRef.current.map((moves) => [...moves]),
      playerBoosts: playerBoostsRef.current.map((boosts) => ({ ...boosts })),
      opponentBoosts: opponentBoostsRef.current.map((boosts) => ({ ...boosts })),
      playerTrapped: playerTrappedRef.current,
      opponentTrapped: opponentTrappedRef.current,
    }),
    [],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const battleSeed: BattleSeed = resume?.battleSeed ?? generateBattleSeed();
    const auxSeed: BattleSeed = resume?.auxSeed ?? generateBattleSeed();
    const auxPrng = new PRNG(PRNG.convertSeed(auxSeed));
    const replayChoices = resume?.choices ?? [];

    if (!resume) {
      gameStateEngine.startBattleLog({
        stageIndex: gameStateEngine.current.state,
        stageType,
        playerName: player.name,
        playerTeam: player.team,
        opponentName: opponent.name,
        opponentTeam: opponent.team,
        battleSeed,
        auxSeed,
        ballBonus,
        choices: [],
      });
    }

    /** Resolves a Showdown ident (e.g. "p2a: Squirtle") to its side and team-array index, matching
     * on battleNickname for the same reason applyLogLine's switch/drag handling does. */
    function resolveIdent(ident: string): { isPlayer: boolean; index: number } | null {
      const isPlayer = ident.startsWith("p1");
      const team = isPlayer ? player.team : opponent.team;
      const nickname = rawIdentName(ident);
      const index = team.findIndex((_, i) => battleNickname(team, i) === nickname);
      return index === -1 ? null : { isPlayer, index };
    }

    // Reflects the current active Pokemon/HP off the omniscient log, and buffers the raw line
    // for translation into display text at the next decision point. Matches on battleNickname
    // rather than species name, since a padded Catch-stage team can have multiple same-species
    // teammates (filler Magikarp) that only their disambiguating nickname tells apart.
    function applyLogLine(line: string) {
      if (!line.startsWith("|")) return;
      logBufferRef.current.push(line);
      const parts = line.split("|");
      const type = parts[1];

      if (type === "switch" || type === "drag") {
        const ident = parts[2];
        const isPlayer = ident.startsWith("p1");
        const team = isPlayer ? player.team : opponent.team;
        const nickname = rawIdentName(ident);
        const index = team.findIndex((_, i) => battleNickname(team, i) === nickname);
        if (index === -1) return;
        const hpField = parts[4] ?? "";
        const hp = parseHpField(hpField, team[index].base.HP);
        const status = parseStatusField(hpField);
        // A newly-active Pokemon always enters with no stat stages, Baton Pass being the one
        // exception — it reports its own explicit -copyboost line right after this switch.
        if (isPlayer) {
          playerActiveIndexRef.current = index;
          playerHpRef.current[index] = hp;
          playerStatusRef.current[index] = status;
          playerBoostsRef.current[index] = {};
        } else {
          opponentActiveIndexRef.current = index;
          opponentHpRef.current[index] = hp;
          opponentStatusRef.current[index] = status;
          opponentBoostsRef.current[index] = {};
          opponentTrappedRef.current = false;
        }
        return;
      }

      if (type === "-activate" && parts[3] === "trapped") {
        // Mean Look/Block/Spider Web's `trapped` volatile (distinct from `partiallytrapped`
        // below): no residual damage or -end line ever announces it, so this -activate line is
        // the only signal. Scoped to the opponent — the player's own trapped state is read
        // straight off the sim's request (see chooseP1), which also catches silent
        // ability-based trapping (Shadow Tag, Arena Trap) this log line can't.
        if (!parts[2]?.startsWith("p1")) opponentTrappedRef.current = true;
        return;
      }

      if ((type === "-damage" || type === "-end") && parts[parts.length - 1] === "[partiallytrapped]") {
        // Fire Spin/Wrap/Bind/etc.: -damage carries the tag on each residual tick (trap started
        // or still active), -end when it wears off or the trapper leaves.
        const ident = parts[2];
        if (!ident?.startsWith("p1")) opponentTrappedRef.current = type === "-damage";
        // Fall through to the generic -damage handling below for the HP update itself.
      }

      if (type === "move") {
        const ident = parts[2] ?? "";
        const moveName = parts[3];
        if (moveName) {
          const isPlayerMove = ident.startsWith("p1");
          const revealed = (isPlayerMove ? playerRevealedMovesRef : opponentRevealedMovesRef).current[
            isPlayerMove ? playerActiveIndexRef.current : opponentActiveIndexRef.current
          ];
          if (revealed && !revealed.includes(moveName)) revealed.push(moveName);
        }
        return;
      }

      if (type === "-ability") {
        const ident = parts[2] ?? "";
        if (ident.startsWith("p1")) playerRevealedAbilityRef.current[playerActiveIndexRef.current] = parts[3];
        return;
      }

      if (type === "-weather") {
        weatherRef.current = parts[2] === "none" ? null : parts[2];
        return;
      }

      if (type === "-fieldstart" || type === "-fieldend") {
        const condition = (parts[3] ?? "").replace(/^move: /, "");
        if (condition.endsWith("Terrain")) terrainRef.current = type === "-fieldstart" ? condition : null;
        return;
      }

      if (type === "-sidestart" || type === "-sideend") {
        const ident = parts[2] ?? "";
        if (!ident.startsWith("p1")) return;
        const condition = (parts[3] ?? "").replace(/^move: /, "");
        const isStart = type === "-sidestart";
        const current = playerHazardsRef.current;
        if (condition === "Stealth Rock") {
          playerHazardsRef.current = { ...current, stealthRock: isStart };
        } else if (condition === "Spikes") {
          playerHazardsRef.current = { ...current, spikes: isStart ? Math.min(current.spikes + 1, 3) : 0 };
        } else if (condition === "Toxic Spikes") {
          playerHazardsRef.current = { ...current, toxicSpikes: isStart ? Math.min(current.toxicSpikes + 1, 2) : 0 };
        } else if (condition === "Sticky Web") {
          playerHazardsRef.current = { ...current, stickyWeb: isStart };
        }
        return;
      }

      if (type === "-status" || type === "-curestatus") {
        const ident = parts[2];
        const isPlayer = ident.startsWith("p1");
        const index = isPlayer ? playerActiveIndexRef.current : opponentActiveIndexRef.current;
        const status = type === "-status" ? ((parts[3] as StatusCode) ?? null) : null;
        (isPlayer ? playerStatusRef : opponentStatusRef).current[index] = status;
        return;
      }

      if (type === "-boost" || type === "-unboost" || type === "-setboost") {
        const resolved = resolveIdent(parts[2]);
        if (!resolved) return;
        const stat = parts[3];
        const amount = Number(parts[4]) || 0;
        const boosts = (resolved.isPlayer ? playerBoostsRef : opponentBoostsRef).current[resolved.index];
        if (type === "-setboost") {
          boosts[stat] = clampBoost(amount);
        } else {
          const delta = type === "-boost" ? amount : -amount;
          boosts[stat] = clampBoost((boosts[stat] ?? 0) + delta);
        }
        return;
      }

      if (type === "-swapboost" || type === "-copyboost") {
        const source = resolveIdent(parts[2]);
        const target = resolveIdent(parts[3]);
        if (!source || !target) return;
        const stats = parts[4] ? parts[4].split(",") : BOOST_STATS;
        const sourceBoosts = (source.isPlayer ? playerBoostsRef : opponentBoostsRef).current[source.index];
        const targetBoosts = (target.isPlayer ? playerBoostsRef : opponentBoostsRef).current[target.index];
        for (const stat of stats) {
          const sourceValue = sourceBoosts[stat] ?? 0;
          if (type === "-copyboost") {
            targetBoosts[stat] = sourceValue;
          } else {
            targetBoosts[stat] = targetBoosts[stat] ?? 0;
            [sourceBoosts[stat], targetBoosts[stat]] = [targetBoosts[stat], sourceValue];
          }
        }
        return;
      }

      if (type === "-invertboost") {
        const resolved = resolveIdent(parts[2]);
        if (!resolved) return;
        const boosts = (resolved.isPlayer ? playerBoostsRef : opponentBoostsRef).current[resolved.index];
        for (const stat of Object.keys(boosts)) boosts[stat] = -boosts[stat];
        return;
      }

      if (type === "-clearboost") {
        const resolved = resolveIdent(parts[2]);
        if (!resolved) return;
        (resolved.isPlayer ? playerBoostsRef : opponentBoostsRef).current[resolved.index] = {};
        return;
      }

      if (type === "-clearpositiveboost" || type === "-clearnegativeboost") {
        const resolved = resolveIdent(parts[2]);
        if (!resolved) return;
        const boosts = (resolved.isPlayer ? playerBoostsRef : opponentBoostsRef).current[resolved.index];
        const clearPositive = type === "-clearpositiveboost";
        for (const stat of Object.keys(boosts)) {
          if (clearPositive ? boosts[stat] > 0 : boosts[stat] < 0) delete boosts[stat];
        }
        return;
      }

      if (type === "-clearallboost") {
        playerBoostsRef.current[playerActiveIndexRef.current] = {};
        opponentBoostsRef.current[opponentActiveIndexRef.current] = {};
        return;
      }

      if (type === "-damage" || type === "-heal" || type === "-sethp") {
        const ident = parts[2];
        const isPlayer = ident.startsWith("p1");
        const team = isPlayer ? player.team : opponent.team;
        const index = isPlayer ? playerActiveIndexRef.current : opponentActiveIndexRef.current;
        const hp = parseHpField(parts[3] ?? "", team[index].base.HP);
        (isPlayer ? playerHpRef : opponentHpRef).current[index] = hp;
        return;
      }

      // A berry is gone for good once it leaves: eaten, burned off by Incinerate, knocked off.
      // Every other held item survives the battle, so only berries are cleared here. See
      // parseItemLoss for why this can't consume the berry of a Pokemon that plucked someone else's.
      if (type === "-enditem") {
        const loss = parseItemLoss(line);
        const resolved = loss && resolveIdent(loss.ident);
        if (!loss || !resolved?.isPlayer) return;

        const teamPokemon = player.team[resolved.index];
        const live = gameStateEngine.current.pokemon.alive.find((p) => p.id === teamPokemon.id);
        if (live?.heldItem?.type === BERRY_TYPE && live.heldItem.name.english === loss.item) {
          gameStateEngine.consumeHeldItem(live);
        }
        return;
      }

      if (type === "faint") {
        const ident = parts[2];
        const isPlayer = ident.startsWith("p1");
        const team = isPlayer ? player.team : opponent.team;
        const index = isPlayer ? playerActiveIndexRef.current : opponentActiveIndexRef.current;
        (isPlayer ? playerHpRef : opponentHpRef).current[index] = { current: 0, max: team[index].base.HP };
        (isPlayer ? playerStatusRef : opponentStatusRef).current[index] = null;
        if (!isPlayer) opponentTrappedRef.current = false;

        if (isPlayer && !deadReportedRef.current.has(index)) {
          deadReportedRef.current.add(index);
          const fainted = gameStateEngine.current.pokemon.alive.find((p) => p.id === team[index].id);
          if (fainted) gameStateEngine.markPokemonDead(fainted);
        }
      }
    }

    function flushEvents(): string[] {
      const events = logBufferRef.current
        .map((line) => formatBattleLine(line, { opponentName: opponent.name }))
        .filter((line): line is string => Boolean(line));
      logBufferRef.current = [];

      if (pendingCatchMessagesRef.current.length > 0) {
        events.unshift(...pendingCatchMessagesRef.current);
        pendingCatchMessagesRef.current = [];
      }

      return events;
    }

    /** Appends `events` to the persistent battle log behind a `Turn N: <player> \ <opponent>` header,
     * then advances the header to reflect whoever's active now, ready for the turn after this one. */
    function recordTurn(events: string[]) {
      if (events.length > 0) {
        const { playerIndex, opponentIndex } = turnHeaderRef.current;
        const playerMon = player.team[playerIndex];
        const opponentMon = opponent.team[opponentIndex];
        const header = `Turn ${turnNumberRef.current}: ${battleNickname(player.team, playerIndex)} (lv${playerMon.level}) \\ ${battleNickname(opponent.team, opponentIndex)} (lv${opponentMon.level})`;
        turnNumberRef.current += 1;
        setBattleLog((log) => [...log, header, ...events]);
      }
      turnHeaderRef.current = { playerIndex: playerActiveIndexRef.current, opponentIndex: opponentActiveIndexRef.current };
    }

    const chooseP1: ChoiceProvider = (request) => {
      // Silently fast-forward through the recorded prefix on resume: applyLogLine (wired below as
      // onLog) still rebuilds HP/active-index/party state as a side effect of the stream, so no UI
      // state is touched here — the player only sees things once we run out of recorded choices.
      if (replayIndexRef.current < replayChoices.length) {
        return Promise.resolve(replayChoices[replayIndexRef.current++]);
      }

      return new Promise<string>((resolve) => {
        // The very first decision has no "previous turn" to recap, so the battle screen
        // appears immediately instead of a results screen.
        const events = isFirstDecisionRef.current ? [] : flushEvents();
        logBufferRef.current = [];
        isFirstDecisionRef.current = false;

        pendingRequestRef.current = request;
        resolveChoiceRef.current = resolve;
        playerTrappedRef.current = request.trapped;

        setSnapshot(takeSnapshot());
        recordTurn(events);
        if (events.length > 0) {
          setTurnEvents(events);
          setPhase("results");
        } else {
          setPhase(request.forceSwitch ? "forced-switch" : "battle");
        }
      });
    };

    const chooseP2: ChoiceProvider = (request) => {
      const attackerIndex = opponentActiveIndexRef.current;
      const defenderIndex = playerActiveIndexRef.current;
      const attackerPokemon = opponent.team[attackerIndex];
      const defenderPokemon = player.team[defenderIndex];
      const attackerHp = opponentHpRef.current[attackerIndex];
      const defenderHp = playerHpRef.current[defenderIndex];

      const attacker: Combatant = {
        types: attackerPokemon.type,
        level: attackerPokemon.level,
        baseStats: toStatTable(attackerPokemon.base),
        ivs: toStatTable(attackerPokemon.ivs),
        boosts: opponentBoostsRef.current[attackerIndex],
        currentHp: attackerHp.current,
        maxHp: attackerHp.max,
        status: opponentStatusRef.current[attackerIndex],
        ability: attackerPokemon.ability,
      };

      const defender: Combatant = {
        types: defenderPokemon.type,
        level: defenderPokemon.level,
        baseStats: toStatTable(defenderPokemon.base),
        // No `ivs` here: the trainer AI doesn't get to know the player's exact IVs, only the
        // min..max range its own stat math derives from base stats + level.
        boosts: playerBoostsRef.current[defenderIndex],
        currentHp: defenderHp.current,
        maxHp: defenderHp.max,
        status: playerStatusRef.current[defenderIndex],
        ability: playerRevealedAbilityRef.current[defenderIndex],
        knownMoves: playerRevealedMovesRef.current[defenderIndex],
      };

      const field: FieldConditions = {
        weather: weatherRef.current,
        terrain: terrainRef.current,
        defenderHazards: playerHazardsRef.current,
      };

      const trainerAi = getTrainerAiImplementation(getSelectedTrainerAiId());
      return trainerAi.chooseMove({ request, attacker, defender, field, rng: () => auxPrng.random() });
    };

    async function handleCatchAttempt(result: CatchAttemptResult) {
      if (result.caught) {
        // The wild Pokemon (always the sole member of a Catch stage's opponent team) is caught —
        // the battle ends here without a further chooseP1 call, so we drive the UI transition ourselves.
        gameStateEngine.addCaughtPokemon(opponent.team[0]);
        setAwardedTMs(await awardCatchTM());
        setAwardedItems(await awardCatchHeldItems());
        setAwardedBerries(await awardCatchBerries());
        setPhase("caught");
        return;
      }
      pendingCatchMessagesRef.current.push("You threw a Poké Ball!", catchFailureMessage(result.shakes));
    }

    const simulator = new BattleSimulator(
      player,
      opponent,
      stageType,
      undefined,
      battleSeed,
      () => auxPrng.random(),
      applyLogLine,
      handleCatchAttempt,
      ballBonus,
    );

    void simulator.run(chooseP1, chooseP2).then(async (result) => {
      // A finished battle has nothing left to resume.
      gameStateEngine.clearBattleLog();
      outcomeRef.current = result.winner;
      pendingRequestRef.current = null;
      resolveChoiceRef.current = null;

      if (result.ranAway) {
        setPhase("ran");
        return;
      }

      if (result.winner === "p1") {
        setAwardedTMs(await awardVictoryTMs());
        setAwardedItems(await awardVictoryHeldItems());
        setAwardedBerries(await awardVictoryBerries());
      }

      const events = flushEvents();
      setSnapshot(takeSnapshot());
      recordTurn(events);

      if (events.length > 0) {
        setTurnEvents(events);
        setPhase("results");
      } else if (result.winner === "p1") {
        setPhase("victory");
      } else if (result.winner) {
        setPhase("defeat");
      }
    });
    // Deliberately runs once: player/opponent/stageType/ballBonus are stable for the lifetime of
    // this hook instance, since the caller remounts it (via a `key`) for every new battle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeSnapshot]);

  const submitMove = useCallback(
    (move: Move) => {
      const request = pendingRequestRef.current;
      const resolve = resolveChoiceRef.current;
      if (!request || !resolve) return;

      const activePokemon = player.team[playerActiveIndexRef.current];
      const moveIndex = activePokemon.moves.findIndex((candidate) => candidate === move);
      const option = moveIndex === -1 ? undefined : request.moves[moveIndex];
      if (!option || option.disabled) return;

      pendingRequestRef.current = null;
      resolveChoiceRef.current = null;
      resolveAndRecord(resolve, option.choice);
    },
    [player],
  );

  const submitSwitch = useCallback((pokemon: TeamPokemon) => {
    const request = pendingRequestRef.current;
    const resolve = resolveChoiceRef.current;
    if (!request || !resolve) return;

    // Matched by battleNickname rather than position: Showdown's request.side.pokemon order isn't
    // pinned to the original team array (it shifts with which Pokemon is currently active), so an
    // index computed from player.team doesn't reliably line up with request.switches' own indexing.
    // Plain species name isn't enough on its own either — a padded Catch-stage team can have
    // multiple same-species teammates (filler Magikarp), so match on their disambiguated nickname.
    const teamIndex = player.team.indexOf(pokemon);
    if (teamIndex === -1) return;
    const nickname = battleNickname(player.team, teamIndex);
    const option = request.switches.find((s) => s.name === nickname);
    if (!option) return;

    pendingRequestRef.current = null;
    resolveChoiceRef.current = null;
    resolveAndRecord(resolve, option.choice);
  }, [player]);

  const submitCatch = useCallback(() => {
    const request = pendingRequestRef.current;
    const resolve = resolveChoiceRef.current;
    if (!request?.canAttemptCatch || !resolve) return;

    pendingRequestRef.current = null;
    resolveChoiceRef.current = null;
    resolveAndRecord(resolve, ATTEMPT_CATCH);
  }, []);

  const submitRun = useCallback(() => {
    const request = pendingRequestRef.current;
    const resolve = resolveChoiceRef.current;
    if (!request?.canAttemptCatch || !resolve) return;

    pendingRequestRef.current = null;
    resolveChoiceRef.current = null;
    resolveAndRecord(resolve, ATTEMPT_RUN);
  }, []);

  const advance = useCallback(() => {
    if (phase === "results") {
      const request = pendingRequestRef.current;
      if (!request) {
        if (outcomeRef.current === "p1") setPhase("victory");
        else if (outcomeRef.current) setPhase("defeat");
        return;
      }

      if (isForcedContinuation(request)) {
        // No real choice this turn (locked move, recharge, Struggle) — resolve it immediately
        // instead of showing a move menu with nothing meaningful to pick.
        const resolve = resolveChoiceRef.current;
        pendingRequestRef.current = null;
        resolveChoiceRef.current = null;
        if (resolve) resolveAndRecord(resolve, request.moves[0]?.choice ?? "move 1");
        setPhase("battle");
        return;
      }

      setPhase(request.forceSwitch ? "forced-switch" : "battle");
      return;
    }

    if (phase === "victory" || phase === "caught" || phase === "ran") {
      gameStateEngine.progressState();
      return;
    }

    if (phase === "defeat") {
      // Show the defeat recap (list of this run's fainted Pokemon) before resetting — resetRun()
      // itself is deferred until the player explicitly confirms from that screen, since it clears
      // gameState.pokemon.dead and this component tree unmounts the moment it runs.
      setPhase("defeat-summary");
    }
  }, [phase]);

  function buildPlayerParty(): PartySlot[] {
    const slots: PartySlot[] = player.team.map((pokemon, index) => {
      const hp = snapshot.playerHp[index];
      const status = index === snapshot.playerActiveIndex ? "active" : hp.current <= 0 ? "fainted" : "available";
      return { status, pokemon, hp };
    });
    while (slots.length < MAX_ACTIVE_TEAM_SIZE) slots.push({ status: "empty" });
    return slots;
  }

  return {
    phase,
    playerPokemon: player.team[snapshot.playerActiveIndex],
    opponentPokemon: opponent.team[snapshot.opponentActiveIndex],
    playerHp: snapshot.playerHp[snapshot.playerActiveIndex],
    opponentHp: snapshot.opponentHp[snapshot.opponentActiveIndex],
    playerStatus: snapshot.playerStatus[snapshot.playerActiveIndex] ?? null,
    opponentStatus: snapshot.opponentStatus[snapshot.opponentActiveIndex] ?? null,
    playerTrapped: snapshot.playerTrapped,
    opponentTrapped: snapshot.opponentTrapped,
    opponentRevealedMoves: snapshot.opponentRevealedMoves[snapshot.opponentActiveIndex] ?? [],
    playerBoosts: snapshot.playerBoosts[snapshot.playerActiveIndex] ?? {},
    opponentBoosts: snapshot.opponentBoosts[snapshot.opponentActiveIndex] ?? {},
    playerParty: buildPlayerParty(),
    opponentPartyFainted: snapshot.opponentHp.map((hp) => hp.current <= 0),
    turnEvents,
    battleLog,
    submitMove,
    submitSwitch,
    submitCatch,
    submitRun,
    advance,
    awardedTMs,
    awardedItems,
    awardedBerries,
  };
}
