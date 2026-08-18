import type { AlivePokemon, TeamPokemon } from "../engine/gameStateEngine";
import { PokemonTile } from "./battle/PokemonTile";

export interface EndOfGameScreenProps {
  alivePokemon: AlivePokemon[];
  deadPokemon: TeamPokemon[];
}

interface PokemonBoxProps {
  title: string;
  pokemon: TeamPokemon[];
  emptyText: string;
}

function PokemonBox({ title, pokemon, emptyText }: PokemonBoxProps) {
  return (
    <div className="rounded-xl border-4 border-slate-800 bg-slate-100 p-4 shadow-xl">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      {pokemon.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {pokemon.map((member, index) => (
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
  );
}

/** Shown once the run has cleared every stage. Two-by-two overview grid, plus a result box (top right) for future content. */
export function EndOfGameScreen({ alivePokemon, deadPokemon }: EndOfGameScreenProps) {
  const activeParty = alivePokemon
    .filter((pokemon) => pokemon.active !== undefined)
    .sort((a, b) => (a.active ?? 0) - (b.active ?? 0));
  const inactiveParty = alivePokemon.filter((pokemon) => pokemon.active === undefined);

  return (
    <div className="grid grid-cols-2 gap-4">
      <PokemonBox title="Party" pokemon={activeParty} emptyText="No Pokémon in the active party." />

      <div className="flex items-center justify-center rounded-xl border-4 border-slate-800 bg-slate-100 p-4 shadow-xl">
        <p className="text-3xl font-extrabold tracking-wide text-slate-900">Win!</p>
      </div>

      <PokemonBox title="Inactive" pokemon={inactiveParty} emptyText="No inactive Pokémon." />

      <PokemonBox title="Dead" pokemon={deadPokemon} emptyText="No losses this run." />
    </div>
  );
}
