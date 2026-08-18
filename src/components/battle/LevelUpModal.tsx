import type { Move } from "../../api/pikaserve";
import type { FourMoves, TeamPokemon } from "../../engine/gameStateEngine";
import { MoveTile } from "./MoveTile";
import { PokemonStatsList } from "./PokemonStatsList";

export interface LevelUpModalProps {
  /** Already-updated Pokemon — post level-up, and post-evolution if it evolved this click. */
  pokemon: TeamPokemon;
  /** Species name before evolving, set only when this level-up evolved the Pokemon. */
  fromName?: string;
  moveChoice?: {
    current: FourMoves;
    learned: Move;
    /** Called with the index into [...current, learned] of the move to forget. */
    onForget: (index: number) => void;
  };
  /** Dismisses the modal. Unused when moveChoice is set — picking a move to forget closes it instead. */
  onClose: () => void;
}

export function LevelUpModal({ pokemon, fromName, moveChoice, onClose }: LevelUpModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={moveChoice ? undefined : onClose}
    >
      <div
        className="w-80 rounded-md bg-white p-4 text-center text-sm text-slate-900 min-[600px]:text-base"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold">
            {fromName
              ? `Congrats! Your ${fromName} has evolved into ${pokemon.name.english}!`
              : `Your ${pokemon.name.english} grew to level ${pokemon.level}!`}
          </p>
          {!moveChoice && (
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0">
              ✕
            </button>
          )}
        </div>

        <img
          src={pokemon.image.hires}
          alt={pokemon.name.english}
          className="mx-auto my-3 h-32 w-32 object-contain [image-rendering:pixelated]"
        />

        <div className="text-left text-xs min-[600px]:text-sm">
          <h3 className="text-center font-semibold">Stats / IVs</h3>
          <PokemonStatsList pokemon={pokemon} />
        </div>

        {moveChoice ? (
          <div className="mt-3">
            <p className="text-xs font-semibold min-[600px]:text-sm">
              Learned {moveChoice.learned.name.english}! Select a move to forget.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {moveChoice.current.map((move, index) => (
                <MoveTile key={`${move.id}-${index}`} move={move} onClick={() => moveChoice.onForget(index)} />
              ))}
            </div>
            <div className="mt-1.5">
              <MoveTile move={moveChoice.learned} onClick={() => moveChoice.onForget(moveChoice.current.length)} />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 rounded-md bg-slate-800 px-6 py-2 text-sm font-bold text-white"
          >
            ACCEPT
          </button>
        )}
      </div>
    </div>
  );
}
