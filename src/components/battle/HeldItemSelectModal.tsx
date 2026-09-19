import { useEffect } from "react";
import type { Item } from "../../api/pikaserve";
import type { TeamPokemon } from "../../engine/gameStateEngine";

export interface HeldItemSelectModalProps {
  pokemon: TeamPokemon;
  /** Unassigned items in the bag, offered for this Pokemon to hold. */
  items: Item[];
  /** Called with the chosen item, or null to take away whatever it's holding now. */
  onSelect: (item: Item | null) => void;
  onClose: () => void;
}

/** Stacks on top of TeamChanger, letting the player give one of the bag's items to a Pokemon. */
export function HeldItemSelectModal({ pokemon, items, onSelect, onClose }: HeldItemSelectModalProps) {
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
        className="flex h-[90vh] max-h-[750px] w-80 flex-col overflow-hidden rounded-md bg-white p-4 text-sm text-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Give {pokemon.name.english} an item</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-600">
          {pokemon.heldItem ? (
            <>
              Holding <span className="font-semibold">{pokemon.heldItem.name.english}</span>
            </>
          ) : (
            "Holding nothing"
          )}
        </p>

        {pokemon.heldItem && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="mt-2 rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-bold text-slate-900"
          >
            TAKE ITEM BACK
          </button>
        )}

        {items.length === 0 ? (
          <p className="mt-3 italic text-slate-600">You don't have any items.</p>
        ) : (
          <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {items.map((item, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full rounded-md border-2 border-slate-800 bg-slate-100 px-2 py-1 text-left"
                >
                  <span className="text-xs font-bold">{item.name.english}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-slate-600">{item.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
