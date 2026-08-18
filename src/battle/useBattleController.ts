import { PRNG } from "@pkmn/sim";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Move } from "../api/pikaserve";
import type { PartySlot } from "../components/battle/partySlot";
import type { CatchAttemptResult } from "../encounter/catchPokemon";
import { MAX_ACTIVE_TEAM_SIZE, gameStateEngine } from "../engine/gameStateEngine";
import type { BattleReplayLog, BattleSeed, OwnedTM, TeamPokemon } from "../engine/gameStateEngine";
import type { StageType } from "../engine/stage";
import { awardCatchTM, awardVictoryTMs } from "../engine/tmRewards";
import { battleNickname } from "./battleNickname";
import type { BattleParticipant, BattleRequest, ChoiceProvider } from "./battleSimulator";
import { ATTEMPT_CATCH, BattleSimulator } from "./battleSimulator";
import { formatBattleLine, rawIdentName } from "./formatBattleLine";
import { chooseTrainerMove } from "./trainerAi";

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

export type BattlePhase = "battle" | "results" | "forced-switch" | "victory" | "defeat" | "caught";

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
  playerParty: PartySlot[];
  turnEvents: string[];
  submitMove: (move: Move) => void;
  submitSwitch: (pokemon: TeamPokemon) => void;
  /** Attempts to catch the wild Pokemon. No-op unless the pending request allows it. */
  submitCatch: () => void;
  /** Dismisses the results/victory/defeat/caught screen and moves on to whatever's next. */
  advance: () => void;
  /** TM(s) awarded for the current victory/catch, if any. Empty outside those phases. */
  awardedTMs: OwnedTM[];
}

interface Snapshot {
  playerHp: HpValue[];
  playerActiveIndex: number;
  opponentHp: HpValue[];
  opponentActiveIndex: number;
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
 * `player`/`opponent`/`stageType`/`resume` are only read on the first render — this hook is meant
 * to be used in a component that's remounted (via a `key`) for each new battle.
 *
 * When `resume` is given, the battle is replayed deterministically up to the point it was saved
 * (same seeds, same recorded player choices — the AI's choices re-derive identically since it's a
 * pure function of seeded rng + board state) before handing control back to the live UI.
 */
export function useBattleController(
  player: BattleParticipant,
  opponent: BattleParticipant,
  stageType: StageType,
  resume?: BattleReplayLog,
): UseBattleControllerResult {
  const startedRef = useRef(false);

  const playerHpRef = useRef<HpValue[]>(player.team.map(fullHp));
  const playerActiveIndexRef = useRef(0);
  const opponentHpRef = useRef<HpValue[]>(opponent.team.map(fullHp));
  const opponentActiveIndexRef = useRef(0);
  const deadReportedRef = useRef(new Set<number>());
  const logBufferRef = useRef<string[]>([]);
  const isFirstDecisionRef = useRef(!resume || resume.choices.length === 0);
  const replayIndexRef = useRef(0);
  const pendingRequestRef = useRef<BattleRequest | null>(null);
  const resolveChoiceRef = useRef<((choice: string) => void) | null>(null);
  const outcomeRef = useRef<"p1" | "p2" | "tie" | null>(null);
  /** Synthetic (non-protocol) lines from a failed catch attempt, prepended to the next results flush. */
  const pendingCatchMessagesRef = useRef<string[]>([]);

  const [phase, setPhase] = useState<BattlePhase>("battle");
  const [turnEvents, setTurnEvents] = useState<string[]>([]);
  const [awardedTMs, setAwardedTMs] = useState<OwnedTM[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    playerHp: playerHpRef.current,
    playerActiveIndex: 0,
    opponentHp: opponentHpRef.current,
    opponentActiveIndex: 0,
  }));

  const takeSnapshot = useCallback(
    (): Snapshot => ({
      playerHp: [...playerHpRef.current],
      playerActiveIndex: playerActiveIndexRef.current,
      opponentHp: [...opponentHpRef.current],
      opponentActiveIndex: opponentActiveIndexRef.current,
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
        choices: [],
      });
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
        const hp = parseHpField(parts[4] ?? "", team[index].base.HP);
        if (isPlayer) {
          playerActiveIndexRef.current = index;
          playerHpRef.current[index] = hp;
        } else {
          opponentActiveIndexRef.current = index;
          opponentHpRef.current[index] = hp;
        }
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

      if (type === "faint") {
        const ident = parts[2];
        const isPlayer = ident.startsWith("p1");
        const team = isPlayer ? player.team : opponent.team;
        const index = isPlayer ? playerActiveIndexRef.current : opponentActiveIndexRef.current;
        (isPlayer ? playerHpRef : opponentHpRef).current[index] = { current: 0, max: team[index].base.HP };

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

        setSnapshot(takeSnapshot());
        if (events.length > 0) {
          setTurnEvents(events);
          setPhase("results");
        } else {
          setPhase(request.forceSwitch ? "forced-switch" : "battle");
        }
      });
    };

    const chooseP2: ChoiceProvider = (request) =>
      chooseTrainerMove({
        request,
        attacker: { types: opponent.team[opponentActiveIndexRef.current].type },
        defender: { types: player.team[playerActiveIndexRef.current].type },
        rng: () => auxPrng.random(),
      });

    async function handleCatchAttempt(result: CatchAttemptResult) {
      if (result.caught) {
        // The wild Pokemon (always the sole member of a Catch stage's opponent team) is caught —
        // the battle ends here without a further chooseP1 call, so we drive the UI transition ourselves.
        gameStateEngine.addCaughtPokemon(opponent.team[0]);
        setAwardedTMs(await awardCatchTM());
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
    );

    void simulator.run(chooseP1, chooseP2).then(async (result) => {
      // A finished battle has nothing left to resume.
      gameStateEngine.clearBattleLog();
      outcomeRef.current = result.winner;
      pendingRequestRef.current = null;
      resolveChoiceRef.current = null;

      if (result.winner === "p1") {
        setAwardedTMs(await awardVictoryTMs());
      }

      const events = flushEvents();
      setSnapshot(takeSnapshot());

      if (events.length > 0) {
        setTurnEvents(events);
        setPhase("results");
      } else if (result.winner === "p1") {
        setPhase("victory");
      } else if (result.winner) {
        setPhase("defeat");
      }
    });
    // Deliberately runs once: player/opponent/stageType are stable for the lifetime of this
    // hook instance, since the caller remounts it (via a `key`) for every new battle.
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

    if (phase === "victory" || phase === "caught") {
      gameStateEngine.progressState();
      return;
    }

    if (phase === "defeat") {
      gameStateEngine.resetRun();
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
    playerParty: buildPlayerParty(),
    turnEvents,
    submitMove,
    submitSwitch,
    submitCatch,
    advance,
    awardedTMs,
  };
}
