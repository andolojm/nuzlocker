import { useEffect, useMemo, useRef, useState } from "react";
import type { BattleParticipant } from "../battle/battleSimulator";
import { useBattleController } from "../battle/useBattleController";
import { encounterPokemon } from "../encounter/encounterPokemon";
import { gameStateEngine } from "../engine/gameStateEngine";
import type { AlivePokemon, BattleReplayLog } from "../engine/gameStateEngine";
import { StageType } from "../engine/stage";
import type { Stage } from "../engine/stage";
import { BattleScreen } from "./battle/BattleScreen";
import { TeamChanger } from "./battle/TeamChanger";
import { InitialChoiceScreen } from "./InitialChoiceScreen";

export interface StageFlowProps {
  alivePokemon: AlivePokemon[];
  stage: Stage;
}

/**
 * Owns the per-stage flow: pick your active team first, then battle with it.
 * Rendered with `key={gameState.state}` by the caller so a new stage always starts back at team selection.
 */
export function StageFlow({ alivePokemon, stage }: StageFlowProps) {
  // Frozen at mount so a mid-battle re-render (e.g. a faint updating `alivePokemon`) can't flip
  // this once the battle's own startBattleLog() call makes gameStateEngine.current.battleLog
  // non-null out from under an already-running, non-resumed battle. (Mismatched stageIndex
  // shouldn't happen, since the log is cleared before progressState()/resetRun() run, but fall
  // through to the normal flow rather than getting stuck if it ever does.)
  const [resumeLog] = useState<BattleReplayLog | null>(() => {
    const log = gameStateEngine.current.battleLog;
    return log && log.stageIndex === gameStateEngine.current.state ? log : null;
  });

  if (stage.type === StageType.InitialChoice) {
    return <InitialChoiceScreen />;
  }

  if (resumeLog) {
    return (
      <Battle
        player={{ name: resumeLog.playerName, team: resumeLog.playerTeam }}
        opponent={{ name: resumeLog.opponentName, team: resumeLog.opponentTeam }}
        stageType={resumeLog.stageType}
        resume={resumeLog}
      />
    );
  }

  return <TeamSelection alivePokemon={alivePokemon} stage={stage} />;
}

interface TeamSelectionProps {
  alivePokemon: AlivePokemon[];
  stage: Stage;
}

function TeamSelection({ alivePokemon, stage }: TeamSelectionProps) {
  const [confirmedTeam, setConfirmedTeam] = useState<AlivePokemon[] | null>(null);

  if (!confirmedTeam) {
    return (
      <div>
        <h1 className="mb-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          {stage.type === StageType.Battle ? "Trainer Battle!" : "Wild Pokemon"}
        </h1>
        <TeamChanger
          alivePokemon={alivePokemon}
          levelCap={stage.cap}
          onSubmit={(team) => {
            gameStateEngine.setActiveTeam(team);
            setConfirmedTeam(team);
          }}
        />
      </div>
    );
  }

  return <ResolveOpponent confirmedTeam={confirmedTeam} stage={stage} />;
}

interface ResolveOpponentProps {
  confirmedTeam: AlivePokemon[];
  stage: Stage;
}

/**
 * Seeds the opponent team via encounterPokemon: a single wild Pokemon for a Catch stage, or one
 * random Pokemon per entry in stage.opponentTeam for a Battle stage. Split out so the fetch only
 * ever runs once per stage, and so useBattleController never starts before a real opponent team exists.
 */
function ResolveOpponent({ confirmedTeam, stage }: ResolveOpponentProps) {
  const startedRef = useRef(false);
  const [opponent, setOpponent] = useState<BattleParticipant | null>(null);

  // useBattleController only reads `player` on its first render, so this must stay referentially
  // stable across re-renders (e.g. the ones triggered by gameStateEngine.markPokemonDead on every faint).
  const player: BattleParticipant = useMemo(
    () => ({ name: "Red", team: confirmedTeam }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const stageNumber = gameStateEngine.current.state;
    const caughtPokemon = [...gameStateEngine.current.pokemon.alive, ...gameStateEngine.current.pokemon.dead];

    if (stage.type === StageType.Catch) {
      void encounterPokemon(stageNumber, caughtPokemon, stage.strength, stage.level).then((pokemon) => {
        setOpponent({ name: `Wild ${pokemon.name.english}`, team: [pokemon] });
      });
      return;
    }

    const strengths = stage.opponentTeam ?? [];
    void Promise.all(
      strengths.map((strength) => encounterPokemon(stageNumber, caughtPokemon, strength, stage.level)),
    ).then((team) => {
      setOpponent({ name: "Trainer", team });
    });
    // Deliberately runs once: this component is remounted for every new stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!opponent) {
    return <p className="text-sm font-medium text-slate-600">An opponent is approaching…</p>;
  }

  return <Battle player={player} opponent={opponent} stageType={stage.type} />;
}

interface BattleProps {
  player: BattleParticipant;
  opponent: BattleParticipant;
  stageType: StageType;
  resume?: BattleReplayLog;
}

/** Split out so useBattleController is only ever called once a team is confirmed and an opponent exists. */
function Battle({ player, opponent, stageType, resume }: BattleProps) {
  const controller = useBattleController(player, opponent, stageType, resume);

  return (
    <BattleScreen
      playerPokemon={controller.playerPokemon}
      opponentPokemon={controller.opponentPokemon}
      playerHp={controller.playerHp}
      opponentHp={controller.opponentHp}
      playerStatus={controller.playerStatus}
      opponentStatus={controller.opponentStatus}
      playerParty={controller.playerParty}
      stageType={stageType}
      phase={controller.phase}
      turnEvents={controller.turnEvents}
      onSelectMove={controller.submitMove}
      onSelectSwitch={controller.submitSwitch}
      onAdvance={controller.advance}
      onAction={(action) => {
        if (action === "CATCH") controller.submitCatch();
      }}
      awardedTMs={controller.awardedTMs}
    />
  );
}
