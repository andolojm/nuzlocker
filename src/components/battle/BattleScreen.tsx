import { useState } from "react";
import type { Move } from "../../api/pikaserve";
import type { StatusCode } from "../../battle/formatBattleLine";
import type { BattlePhase, HpValue } from "../../battle/useBattleController";
import type { OwnedTM, TeamPokemon } from "../../engine/gameStateEngine";
import { StageType } from "../../engine/stage";
import { BattleMenu } from "./BattleMenu";
import type { BattleAction } from "./BattleMenu";
import { MoveSelectMenu } from "./MoveSelectMenu";
import { OutcomeModal } from "./OutcomeModal";
import { PartySelectMenu } from "./PartySelectMenu";
import type { PartySlot } from "./partySlot";
import { PokemonInfoBox } from "./PokemonInfoBox";
import { PokemonInfoModal } from "./PokemonInfoModal";
import { ResultsPanel } from "./ResultsPanel";

export interface BattleScreenProps {
  playerPokemon: TeamPokemon;
  opponentPokemon: TeamPokemon;
  playerHp: HpValue;
  opponentHp: HpValue;
  playerStatus: StatusCode | null;
  opponentStatus: StatusCode | null;
  playerParty: PartySlot[];
  stageType: StageType;
  /** Ball multiplier for the active Catch stage; ignored for Battle stages. */
  ballBonus: number;
  phase: BattlePhase;
  turnEvents: string[];
  onSelectMove: (move: Move) => void;
  onSelectSwitch: (pokemon: TeamPokemon) => void;
  onAdvance: () => void;
  onAction?: (action: BattleAction) => void;
  awardedTMs: OwnedTM[];
}

// Trainer battles don't allow catching or running; only wild encounters do.
const BATTLE_DISABLED_ACTIONS: BattleAction[] = ["CATCH", "RUN"];

type OpenMenu = "none" | "fight" | "pokemon";

export function BattleScreen({
  playerPokemon,
  opponentPokemon,
  playerHp,
  opponentHp,
  playerStatus,
  opponentStatus,
  playerParty,
  stageType,
  ballBonus,
  phase,
  turnEvents,
  onSelectMove,
  onSelectSwitch,
  onAdvance,
  onAction,
  awardedTMs,
}: BattleScreenProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>("none");
  const [submenuOpenedViaKeyboard, setSubmenuOpenedViaKeyboard] = useState(false);
  const [showPlayerInfo, setShowPlayerInfo] = useState(false);
  const disabledActions = stageType === StageType.Battle ? BATTLE_DISABLED_ACTIONS : [];
  const isOutcomePhase = phase === "victory" || phase === "defeat" || phase === "caught" || phase === "ran";

  function handleMainMenuSelect(action: BattleAction, openedViaKeyboard: boolean) {
    if (action === "FIGHT") {
      setOpenMenu("fight");
      setSubmenuOpenedViaKeyboard(openedViaKeyboard);
    } else if (action === "POKÉMON") {
      setOpenMenu("pokemon");
      setSubmenuOpenedViaKeyboard(openedViaKeyboard);
    } else {
      onAction?.(action);
    }
  }

  function handleSelectMove(move: Move) {
    setOpenMenu("none");
    onSelectMove(move);
  }

  function handleSelectSwitch(pokemon: TeamPokemon) {
    setOpenMenu("none");
    onSelectSwitch(pokemon);
  }

  return (
    <div className="relative overflow-hidden rounded-xl border-4 border-slate-800 shadow-xl max-[750px]:-mx-6">
      <div className="relative h-110 bg-transparent">
        <div className="absolute top-4 left-4">
          <PokemonInfoBox
            pokemon={opponentPokemon}
            hp={opponentHp}
            status={opponentStatus}
            statusChipPosition="bottom-right"
          />
        </div>
        <img
          src={opponentPokemon.image.hires}
          alt={opponentPokemon.name.english}
          className="absolute top-6 right-8 h-48 w-48 max-[600px]:right-2 max-[600px]:h-36 max-[600px]:w-36"
        />

        <img
          src={playerPokemon.image.hires}
          alt={playerPokemon.name.english}
          className="absolute bottom-0 left-8 h-64 w-64 max-[600px]:left-2 max-[600px]:h-48 max-[600px]:w-48"
        />
        <div className="absolute right-4 bottom-6">
          <PokemonInfoBox
            pokemon={playerPokemon}
            hp={playerHp}
            status={playerStatus}
            statusChipPosition="top-left"
            onInfoClick={() => setShowPlayerInfo(true)}
          />
        </div>
      </div>

      <div className="flex h-38 bg-slate-900">
        {phase === "results" ? (
          <ResultsPanel events={turnEvents} onAdvance={onAdvance} />
        ) : phase === "forced-switch" ? (
          <PartySelectMenu party={playerParty} onSelectPokemon={handleSelectSwitch} />
        ) : isOutcomePhase ? null : openMenu === "none" ? (
          <div className="flex-1 p-2">
            <BattleMenu
              disabledActions={disabledActions}
              active
              ballBonus={stageType === StageType.Catch ? ballBonus : undefined}
              onSelect={handleMainMenuSelect}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-[2] items-center border-r-2 border-slate-700 px-4 py-2 max-[600px]:px-2">
              {openMenu === "fight" ? (
                <MoveSelectMenu
                  moves={playerPokemon.moves}
                  onSelectMove={handleSelectMove}
                  onClose={() => setOpenMenu("none")}
                  defenderTypes={opponentPokemon.type}
                  attackerTypes={playerPokemon.type}
                  startSelected={submenuOpenedViaKeyboard}
                />
              ) : (
                <PartySelectMenu
                  party={playerParty}
                  onSelectPokemon={handleSelectSwitch}
                  onClose={() => setOpenMenu("none")}
                  startSelected={submenuOpenedViaKeyboard}
                />
              )}
            </div>
            <div className="flex-1 p-2 max-[600px]:hidden">
              <BattleMenu
                disabledActions={disabledActions}
                active={false}
                ballBonus={stageType === StageType.Catch ? ballBonus : undefined}
                onSelect={handleMainMenuSelect}
              />
            </div>
            <div className="hidden shrink-0 py-2 pr-2 pl-2 max-[600px]:flex">
              <button
                type="button"
                aria-label="Back"
                onClick={() => setOpenMenu("none")}
                className="flex h-full w-[35px] items-center justify-center rounded-md bg-slate-500 text-slate-100"
              >
                ←
              </button>
            </div>
          </>
        )}
      </div>

      {isOutcomePhase && <OutcomeModal variant={phase} onAdvance={onAdvance} awardedTMs={awardedTMs} />}
      {showPlayerInfo && <PokemonInfoModal pokemon={playerPokemon} onClose={() => setShowPlayerInfo(false)} />}
    </div>
  );
}
