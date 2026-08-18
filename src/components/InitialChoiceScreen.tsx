import { useEffect, useRef, useState } from "react";
import { encounterPokemon } from "../encounter/encounterPokemon";
import { gameStateEngine } from "../engine/gameStateEngine";
import type { TeamPokemon } from "../engine/gameStateEngine";
import { PokemonInfoModal } from "./battle/PokemonInfoModal";

const STARTER_COUNT = 3;
const MIN_STARTER_STRENGTH = 250;
const MAX_STARTER_STRENGTH = 325;
const STARTER_LEVEL = 6;

function randomStarterStrength(): number {
  return Math.round(MIN_STARTER_STRENGTH + Math.random() * (MAX_STARTER_STRENGTH - MIN_STARTER_STRENGTH));
}

/** The very first stage of a run: pick one of three encountered Pokemon as your starter. */
export function InitialChoiceScreen() {
  const startedRef = useRef(false);
  const [options, setOptions] = useState<TeamPokemon[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const stageNumber = gameStateEngine.current.state;
    const caughtPokemon = [...gameStateEngine.current.pokemon.alive, ...gameStateEngine.current.pokemon.dead];

    void Promise.all(
      Array.from({ length: STARTER_COUNT }, () =>
        encounterPokemon(stageNumber, caughtPokemon, randomStarterStrength(), STARTER_LEVEL),
      ),
    ).then(setOptions);
    // Deliberately runs once: this component is remounted for every new stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm(pokemon: TeamPokemon) {
    gameStateEngine.clearPokemon();
    gameStateEngine.addPokemon(pokemon, 1);
    gameStateEngine.progressState();
  }

  if (!options) {
    return <p className="text-sm font-medium text-slate-600">Wild Pokémon are approaching…</p>;
  }

  return (
    <div className="flex flex-col items-center gap-10 py-8">
      <h2 className="text-lg font-bold text-slate-900">Choose your first Pokémon</h2>
      <div className="flex flex-col items-center gap-10">
        <StarterOption pokemon={options[0]} onClick={() => setSelectedIndex(0)} />
        <div className="flex gap-20">
          <StarterOption pokemon={options[1]} onClick={() => setSelectedIndex(1)} />
          <StarterOption pokemon={options[2]} onClick={() => setSelectedIndex(2)} />
        </div>
      </div>

      {selectedIndex !== null && (
        <PokemonInfoModal
          pokemon={options[selectedIndex]}
          onClose={() => setSelectedIndex(null)}
          onConfirm={() => handleConfirm(options[selectedIndex])}
        />
      )}
    </div>
  );
}

interface StarterOptionProps {
  pokemon: TeamPokemon;
  onClick: () => void;
}

function StarterOption({ pokemon, onClick }: StarterOptionProps) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2">
      <img
        src={pokemon.image.hires}
        alt={pokemon.name.english}
        className="h-16 w-16 object-contain [image-rendering:pixelated] transition-transform hover:scale-110"
      />
      <span className="text-sm font-semibold text-slate-800">{pokemon.name.english}</span>
    </button>
  );
}
