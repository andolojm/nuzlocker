import { useEffect, useState } from "react";
import type { AlivePokemon, OwnedTM, TeamPokemon } from "../../engine/gameStateEngine";
import { gameStateEngine } from "../../engine/gameStateEngine";
import { useGameState } from "../../engine/useGameState";
import { PokemonStatsList } from "./PokemonStatsList";
import { TMSelectModal } from "./TMSelectModal";

export interface PokemonInfoModalProps {
  pokemon: TeamPokemon;
  onClose: () => void;
  /** When provided, renders a NOPE/SURE footer instead of a plain info view. NOPE calls onClose. */
  onConfirm?: () => void;
  /**
   * Shows a TM button next to each move, letting the player replace it with an owned TM's move.
   * Only meaningful when `pokemon` is a live AlivePokemon reference from gameStateEngine (e.g. as
   * shown from TeamChanger) — mid-battle or pre-catch views shouldn't set this.
   */
  allowTeachMove?: boolean;
  /**
   * Called with the new reference after a TM is taught. Callers holding their own copy of
   * `pokemon` (e.g. TeamChanger's local active/inactive lists) must adopt it — gameStateEngine
   * methods like setActiveTeam key off exact identity, so a stale reference breaks later on.
   */
  onPokemonUpdated?: (updated: AlivePokemon) => void;
}

export function PokemonInfoModal({
  pokemon,
  onClose,
  onConfirm,
  allowTeachMove,
  onPokemonUpdated,
}: PokemonInfoModalProps) {
  const gameState = useGameState();
  const [teachMoveIndex, setTeachMoveIndex] = useState<number | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Re-fetch the live copy so a teach-move immediately reflects here rather than showing the
  // stale prop from whenever this modal was opened. Relies on the same no-duplicate-species
  // invariant used elsewhere (see useBattleController's applyLogLine).
  const displayPokemon: TeamPokemon = allowTeachMove
    ? (gameState.pokemon.alive.find((p) => p.id === pokemon.id) ?? pokemon)
    : pokemon;

  const translations = [
    displayPokemon.name.japanese && `Japanese: ${displayPokemon.name.japanese}`,
    displayPokemon.name.chinese && `Chinese: ${displayPokemon.name.chinese}`,
    displayPokemon.name.french && `French: ${displayPokemon.name.french}`,
  ].filter((line): line is string => Boolean(line));

  function handleSelectTM(tm: OwnedTM) {
    if (teachMoveIndex === null) return;
    const updated = gameStateEngine.teachMove(displayPokemon as AlivePokemon, teachMoveIndex, tm);
    onPokemonUpdated?.(updated);
    setTeachMoveIndex(null);
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div
          className="max-h-[90vh] w-[90vw] max-w-[500px] overflow-y-auto rounded-md bg-white p-4 text-sm text-slate-900 min-[600px]:text-base"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-bold">
              {displayPokemon.name.english} — Lv{displayPokemon.level}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>

          <img
            src={displayPokemon.image.hires}
            alt={displayPokemon.name.english}
            className="mx-auto my-2 h-32 w-32 object-contain [image-rendering:pixelated]"
          />

          <h3 className="font-semibold">Stats / IVs</h3>
          <PokemonStatsList pokemon={displayPokemon} />

          <h3 className="mt-2 font-semibold">Moves</h3>
          <ul>
            {displayPokemon.moves.map((move, index) => (
              <li key={index} className="flex items-center justify-between gap-2">
                <span>
                  {move.name.english} ({move.type})
                </span>
                {allowTeachMove && (
                  <button
                    type="button"
                    onClick={() => setTeachMoveIndex(index)}
                    className="shrink-0 rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white"
                  >
                    TM
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-600 min-[600px]:text-sm">
            {translations.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p className="mt-1 italic">{displayPokemon.description}</p>
          </div>

          {onConfirm && (
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-slate-200 px-6 py-2 text-sm font-bold text-slate-800"
              >
                NOPE
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-md bg-slate-800 px-6 py-2 text-sm font-bold text-white"
              >
                SURE
              </button>
            </div>
          )}
        </div>
      </div>

      {teachMoveIndex !== null && (
        <TMSelectModal
          pokemon={displayPokemon}
          tms={gameState.tms}
          onSelect={handleSelectTM}
          onClose={() => setTeachMoveIndex(null)}
        />
      )}
    </>
  );
}
