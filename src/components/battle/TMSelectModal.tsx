import { useEffect } from "react";
import type { OwnedTM, TeamPokemon } from "../../engine/gameStateEngine";
import { MoveTile } from "./MoveTile";
import { PokemonStatsList } from "./PokemonStatsList";

export interface TMSelectModalProps {
  /** Shown for reference — type and Stats/IVs — while picking a TM. */
  pokemon: TeamPokemon;
  tms: OwnedTM[];
  onSelect: (tm: OwnedTM) => void;
  onClose: () => void;
}

/** Stacks on top of PokemonInfoModal, letting the player pick an owned TM to teach. */
export function TMSelectModal({ pokemon, tms, onSelect, onClose }: TMSelectModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[80vh] w-72 overflow-y-auto rounded-md bg-white p-4 text-sm text-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">
            Choose a TM for {pokemon.name.english} ({pokemon.type.join(" / ")})
          </h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="mt-2 font-semibold">Stats / IVs</h3>
        <PokemonStatsList pokemon={pokemon} />

        {tms.length === 0 ? (
          <p className="mt-3 italic text-slate-600">You don't have any TMs.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tms.map((tm, index) => (
              <li key={index}>
                <p className="mb-0.5 text-xs font-semibold text-slate-600">{tm.name.english}</p>
                <MoveTile move={tm.move} onClick={() => onSelect(tm)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
