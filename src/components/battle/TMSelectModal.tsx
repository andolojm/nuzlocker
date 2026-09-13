import { useEffect, useRef } from "react";
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

const CATEGORIES = ["Physical", "Special", "Status"] as const;

/** Stacks on top of PokemonInfoModal, letting the player pick an owned TM to teach. */
export function TMSelectModal({ pokemon, tms, onSelect, onClose }: TMSelectModalProps) {
  const sectionRefs = useRef<Partial<Record<string, HTMLDivElement>>>({});

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const tmsByCategory = CATEGORIES.map((category) => ({
    category,
    tms: tms.filter((tm) => tm.move.category === category),
  }));

  function scrollToCategory(category: string) {
    sectionRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex h-[90vh] max-h-[750px] w-72 flex-col overflow-hidden rounded-md bg-white p-4 text-sm text-slate-900"
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

        <h3 className="mt-2 font-semibold">
          Stats / IVs <span className="text-xs font-normal italic">(BST {pokemon.bst})</span>
        </h3>
        <PokemonStatsList pokemon={pokemon} />

        {tms.length === 0 ? (
          <p className="mt-3 italic text-slate-600">You don't have any TMs.</p>
        ) : (
          <>
            <div className="mt-3 flex gap-2 border-b border-slate-200 pb-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => scrollToCategory(category)}
                  className="flex-1 rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-bold text-slate-900"
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="mt-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
              {tmsByCategory.map(({ category, tms: categoryTms }) =>
                categoryTms.length === 0 ? null : (
                  <div
                    key={category}
                    ref={(el) => {
                      sectionRefs.current[category] = el ?? undefined;
                    }}
                  >
                    <h4 className="font-semibold">{category}</h4>
                    <ul className="mt-1 space-y-2">
                      {categoryTms.map((tm, index) => (
                        <li key={index}>
                          <MoveTile move={tm.move} attackerTypes={pokemon.type} onClick={() => onSelect(tm)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
