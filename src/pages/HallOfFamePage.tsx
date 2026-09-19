import { useEffect, useState } from "react";
import { PikaLocal } from "../api/pikaLocal";
import type { Pokemon } from "../api/pikaserve";
import type { HighScoreEntry } from "../engine/highScores";
import { highScoresSortedByScore } from "../engine/highScores";

/** Resolves each survivor name in `scores` to its sprite, for display without ever showing raw text names. */
function useSurvivorSprites(scores: HighScoreEntry[]): Map<string, Pokemon> {
  const [sprites, setSprites] = useState<Map<string, Pokemon>>(new Map());

  useEffect(() => {
    const names = new Set(scores.flatMap((entry) => entry.survivors));
    void Promise.all(
      [...names].map(async (name) => [name, await PikaLocal.getPokemon(name)] as const),
    ).then((entries) => setSprites(new Map(entries)));
    // Deliberately scoped to the loaded scores list, which itself only ever loads once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  return sprites;
}

function HighScoreCard({ entry, sprites }: { entry: HighScoreEntry; sprites: Map<string, Pokemon> }) {
  return (
    <li className="flex items-center gap-4 rounded-xl border-4 border-slate-800 bg-slate-100 p-4 shadow-xl">
      <p className="w-20 shrink-0 text-2xl font-extrabold text-slate-900">{entry.score}</p>

      <ul className="flex flex-1 flex-wrap gap-2">
        {entry.survivors.map((name, index) => {
          const sprite = sprites.get(name);
          return (
            <li key={index} className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-700">
              {sprite && (
                <img
                  src={sprite.image.sprite}
                  alt={name}
                  className="h-11 w-11 object-contain [image-rendering:pixelated]"
                />
              )}
            </li>
          );
        })}
      </ul>

      <p className="shrink-0 text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
    </li>
  );
}

export function HallOfFamePage() {
  const [scores] = useState<HighScoreEntry[]>(() => highScoresSortedByScore());
  const sprites = useSurvivorSprites(scores);

  return (
    <main className="mx-auto max-w-5xl px-1 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Hall of Fame</h1>

      {scores.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No completed runs yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {scores.map((entry, index) => (
            <HighScoreCard key={index} entry={entry} sprites={sprites} />
          ))}
        </ul>
      )}
    </main>
  );
}
