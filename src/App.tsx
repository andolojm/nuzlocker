import { useState } from "react";
import { DevStageControls } from "./components/DevStageControls";
import { EndOfGameScreen } from "./components/EndOfGameScreen";
import { Navbar } from "./components/Navbar";
import { StageFlow } from "./components/StageFlow";
import { Stepper } from "./components/Stepper";
import type { Move } from "./api/pikaserve";
import { gameStateEngine } from "./engine/gameStateEngine";
import type { TeamPokemon } from "./engine/gameStateEngine";
import { STAGES } from "./engine/stages";
import { useGameState } from "./engine/useGameState";

function mockMove(name: string, type: string, power: string): Move {
  return {
    id: name.toLowerCase(),
    name: { english: name },
    type,
    category: "Physical",
    pp: "20",
    power,
    accuracy: "100%",
  };
}

const mockPlayerPokemon: TeamPokemon = {
  id: 4,
  name: { english: "Charmander" },
  type: ["Fire"],
  base: { HP: 39, Attack: 52, Defense: 43, "Sp. Attack": 60, "Sp. Defense": 50, Speed: 65 },
  species: "Lizard Pokémon",
  bst: 309,
  description: "Obviously prefers hot places.",
  profile: {
    height: "0.6 m",
    weight: "8.5 kg",
    egg: ["Dragon", "Monster"],
    ability: [["Blaze", "false"]],
    gender: "87.5:12.5",
  },
  image: {
    sprite: "https://raw.githubusercontent.com/Purukitto/pokemon-data.json/master/images/pokedex/sprites/004.png",
    thumbnail: "https://raw.githubusercontent.com/Purukitto/pokemon-data.json/master/images/pokedex/thumbnails/004.png",
    hires: "https://raw.githubusercontent.com/Purukitto/pokemon-data.json/master/images/pokedex/hires/004.png",
  },
  catchRate: 45,
  ivs: { HP: 31, Attack: 31, Defense: 31, "Sp. Attack": 31, "Sp. Defense": 31, Speed: 31 },
  moves: [
    mockMove("Scratch", "Normal", "40"),
    mockMove("Growl", "Normal", "—"),
    mockMove("Ember", "Fire", "40"),
    mockMove("Smokescreen", "Normal", "—"),
  ],
  level: 12,
};

const mockAvailablePokemon: TeamPokemon = {
  id: 1,
  name: { english: "Bulbasaur" },
  type: ["Grass", "Poison"],
  base: { HP: 45, Attack: 49, Defense: 49, "Sp. Attack": 65, "Sp. Defense": 65, Speed: 45 },
  species: "Seed Pokémon",
  bst: 318,
  description: "A strange seed was planted on its back at birth.",
  profile: {
    height: "0.7 m",
    weight: "6.9 kg",
    egg: ["Monster", "Grass"],
    ability: [["Overgrow", "false"]],
    gender: "87.5:12.5",
  },
  image: {
    sprite: "https://raw.githubusercontent.com/Purukitto/pokemon-data.json/master/images/pokedex/sprites/001.png",
    thumbnail: "https://raw.githubusercontent.com/Purukitto/pokemon-data.json/master/images/pokedex/thumbnails/001.png",
    hires: "https://raw.githubusercontent.com/Purukitto/pokemon-data.json/master/images/pokedex/hires/001.png",
  },
  catchRate: 45,
  ivs: { HP: 31, Attack: 31, Defense: 31, "Sp. Attack": 31, "Sp. Defense": 31, Speed: 31 },
  moves: [
    mockMove("Tackle", "Normal", "40"),
    mockMove("Growl", "Normal", "—"),
    mockMove("Vine Whip", "Grass", "45"),
    mockMove("Leech Seed", "Grass", "—"),
  ],
  level: 11,
};

// Dev seed: the real alive roster starts empty since there's no catching UI yet.
// Runs once at module load rather than in a React effect, since StrictMode double-invokes
// mount effects in dev and this has no cleanup to guard against seeding twice.
if (gameStateEngine.current.pokemon.alive.length === 0) {
  gameStateEngine.addPokemon(mockPlayerPokemon);
  gameStateEngine.addPokemon(mockAvailablePokemon);
}

function App() {
  const gameState = useGameState();
  const [resetToken, setResetToken] = useState(0);
  const gameComplete = gameState.state >= STAGES.length;
  const currentStage = STAGES[gameState.state] ?? STAGES[STAGES.length - 1];

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Play</h1>
        <div className="mt-8">
          <Stepper stages={STAGES} progress={gameState.state} />
        </div>
        <div className="mt-8">
          {gameComplete ? (
            <EndOfGameScreen alivePokemon={gameState.pokemon.alive} deadPokemon={gameState.pokemon.dead} />
          ) : (
            <StageFlow
              key={`${gameState.state}-${resetToken}`}
              alivePokemon={gameState.pokemon.alive}
              stage={currentStage}
            />
          )}
        </div>
        <DevStageControls onReset={() => setResetToken((token) => token + 1)} />
      </main>
    </div>
  );
}

export default App;
