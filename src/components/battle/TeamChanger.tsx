import { useState } from "react";
import { MAX_ACTIVE_TEAM_SIZE, gameStateEngine } from "../../engine/gameStateEngine";
import type { AlivePokemon } from "../../engine/gameStateEngine";
import { PokemonInfoModal } from "./PokemonInfoModal";
import { PokemonTile } from "./PokemonTile";

export interface TeamChangerProps {
  alivePokemon: AlivePokemon[];
  /** Max level a Pokemon can be leveled up to via the LVL UP button, at the current stage. */
  levelCap: number;
  onSubmit: (team: AlivePokemon[]) => void;
}

function sortByActiveOrder(pokemon: AlivePokemon[]): AlivePokemon[] {
  return [...pokemon].sort((a, b) => (a.active ?? 0) - (b.active ?? 0));
}

export function TeamChanger({ alivePokemon, levelCap, onSubmit }: TeamChangerProps) {
  const [active, setActive] = useState<AlivePokemon[]>(() =>
    sortByActiveOrder(alivePokemon.filter((pokemon) => pokemon.active !== undefined)),
  );
  const [inactive, setInactive] = useState<AlivePokemon[]>(() =>
    alivePokemon.filter((pokemon) => pokemon.active === undefined),
  );
  const [infoPokemon, setInfoPokemon] = useState<AlivePokemon | null>(null);

  function moveToInactive(pokemon: AlivePokemon) {
    setActive((current) => current.filter((p) => p !== pokemon));
    setInactive((current) => [...current, pokemon]);
  }

  function moveToActive(pokemon: AlivePokemon) {
    if (active.length >= MAX_ACTIVE_TEAM_SIZE) return;
    setInactive((current) => current.filter((p) => p !== pokemon));
    setActive((current) => [...current, pokemon]);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setActive((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setActive((current) => {
      if (index === current.length - 1) return current;
      const next = [...current];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function handleLevelUp(pokemon: AlivePokemon) {
    const leveled = gameStateEngine.setPokemonLevel(pokemon, levelCap);
    setActive((current) => current.map((p) => (p === pokemon ? leveled : p)));
    setInactive((current) => current.map((p) => (p === pokemon ? leveled : p)));
  }

  const atCapacity = active.length >= MAX_ACTIVE_TEAM_SIZE;

  return (
    <div className="rounded-xl border-4 border-slate-800 bg-slate-100 p-4 shadow-xl">
      <h2 className="mb-3 text-center text-lg font-bold text-slate-900">Choose Your Team</h2>
      <div className="grid grid-cols-1 gap-4 min-[600px]:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            Active ({active.length}/{MAX_ACTIVE_TEAM_SIZE})
          </h3>
          <ul className="space-y-1.5">
            {active.map((pokemon, index) => (
              <li key={index} className="flex items-stretch justify-center gap-1">
                <button
                  type="button"
                  onClick={() => moveToInactive(pokemon)}
                  className="flex w-48 items-center gap-2 rounded-md bg-slate-700 px-2 py-1 text-left text-slate-200"
                >
                  <PokemonTile pokemon={pokemon} showHp={false} />
                </button>
                <button
                  type="button"
                  onClick={() => setInfoPokemon(pokemon)}
                  className="rounded-md bg-slate-500 px-1.5 py-1 text-[10px] font-bold text-white"
                >
                  INFO
                </button>
                {pokemon.level < levelCap && (
                  <button
                    type="button"
                    onClick={() => handleLevelUp(pokemon)}
                    className="rounded-md bg-slate-500 px-1.5 py-1 text-[10px] font-bold text-white"
                  >
                    LVL UP
                  </button>
                )}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveUp(index)}
                  aria-label={`Move ${pokemon.name.english} up`}
                  className="flex w-8 items-center justify-center rounded-md bg-slate-500 text-lg leading-none text-white disabled:opacity-25"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={index === active.length - 1}
                  onClick={() => moveDown(index)}
                  aria-label={`Move ${pokemon.name.english} down`}
                  className="flex w-8 items-center justify-center rounded-md bg-slate-500 text-lg leading-none text-white disabled:opacity-25"
                >
                  ▼
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Inactive</h3>
          <ul className="space-y-1.5">
            {inactive.map((pokemon, index) => (
              <li key={index} className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={atCapacity}
                  onClick={() => moveToActive(pokemon)}
                  className={`flex w-48 items-center gap-2 rounded-md px-2 py-1 text-left ${
                    atCapacity ? "cursor-not-allowed bg-slate-300 text-slate-400" : "bg-slate-700 text-slate-200"
                  }`}
                >
                  <PokemonTile pokemon={pokemon} showHp={false} />
                </button>
                <button
                  type="button"
                  onClick={() => setInfoPokemon(pokemon)}
                  className="rounded-md bg-slate-500 px-1.5 py-1 text-[10px] font-bold text-white"
                >
                  INFO
                </button>
                {pokemon.level < levelCap && (
                  <button
                    type="button"
                    onClick={() => handleLevelUp(pokemon)}
                    className="rounded-md bg-slate-500 px-1.5 py-1 text-[10px] font-bold text-white"
                  >
                    LVL UP
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={active.length === 0}
          onClick={() => onSubmit(active)}
          className="rounded-md bg-slate-800 px-6 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          SUBMIT
        </button>
      </div>

      {infoPokemon && (
        <PokemonInfoModal pokemon={infoPokemon} onClose={() => setInfoPokemon(null)} allowTeachMove />
      )}
    </div>
  );
}
