import type { TeamPokemon } from "../engine/gameStateEngine";
import { PokemonTile } from "./battle/PokemonTile";

export interface DefeatScreenProps {
  deadPokemon: TeamPokemon[];
  onConfirm: () => void;
}

/** Shown after a run-ending defeat, before the run is actually reset. */
export function DefeatScreen({ deadPokemon, onConfirm }: DefeatScreenProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border-4 border-slate-800 bg-slate-100 p-6 shadow-xl">
      <p className="text-3xl font-extrabold text-slate-900">Defeat...</p>

      <div className="w-full max-w-sm rounded-xl border-4 border-slate-800 bg-slate-100 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Fallen this run</h3>
        {deadPokemon.length === 0 ? (
          <p className="text-xs text-slate-500">No losses this run.</p>
        ) : (
          <ul className="space-y-1.5">
            {deadPokemon.map((member, index) => (
              <li
                key={index}
                className="flex w-48 items-center gap-2 rounded-md bg-slate-700 px-2 py-1 text-slate-200"
              >
                <PokemonTile pokemon={member} showHp={false} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onConfirm}
        className="rounded-md bg-slate-800 px-4 py-2 text-sm font-bold text-white"
      >
        Start New Run
      </button>
    </div>
  );
}
