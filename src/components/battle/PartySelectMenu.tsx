import type { TeamPokemon } from "../../engine/gameStateEngine";
import { PokemonTile } from "./PokemonTile";
import type { PartySlot } from "./partySlot";
import { useGridSelection } from "./useGridSelection";

export interface PartySelectMenuProps {
  party: PartySlot[];
  onSelectPokemon?: (pokemon: TeamPokemon) => void;
  /** Omit to make the menu non-closable, e.g. when a switch is mandatory after a faint. */
  onClose?: () => void;
  /** Whether a Pokemon starts selected. False means none is highlighted until an arrow key is pressed. Defaults to true. */
  startSelected?: boolean;
}

function isSelectable(slot: PartySlot): boolean {
  return slot.status === "available";
}

export function PartySelectMenu({ party, onSelectPokemon, onClose, startSelected = true }: PartySelectMenuProps) {
  const { selected, setSelected } = useGridSelection({
    itemCount: party.length,
    columns: 2,
    isDisabled: (index) => !isSelectable(party[index]),
    onActivate: (index) => {
      const slot = party[index];
      if (slot.status === "available") onSelectPokemon?.(slot.pokemon);
    },
    onClose,
    startSelected,
  });

  return (
    <div role="menu" aria-label="Party" className="grid h-full w-full grid-cols-2 grid-rows-3 gap-1.5">
      {party.map((slot, index) => {
        const disabled = !isSelectable(slot);
        const isChosen = index === selected;

        return (
          <button
            key={index}
            type="button"
            role="menuitemradio"
            aria-checked={isChosen}
            disabled={disabled}
            tabIndex={-1}
            onClick={() => {
              setSelected(index);
              if (slot.status === "available") onSelectPokemon?.(slot.pokemon);
            }}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-left ${
              disabled
                ? "cursor-not-allowed bg-slate-800 text-slate-400"
                : isChosen
                  ? "bg-white text-slate-900"
                  : "bg-slate-700 text-slate-200"
            }`}
          >
            {slot.status === "empty" ? (
              <span className="w-full text-center text-xs italic">— empty —</span>
            ) : (
              <PokemonTile pokemon={slot.pokemon} hp={slot.hp} emphasized={isChosen} />
            )}
          </button>
        );
      })}
    </div>
  );
}
