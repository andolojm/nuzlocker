import { useEffect, useMemo, useState } from "react";
import { PikaLocal } from "../api/pikaLocal";
import { getHiddenMoveIds, setHiddenMoveIds } from "../api/moveVisibility";
import type { Move } from "../api/pikaserve";
import { moveDescription } from "../battle/moveDescription";
import { TypeChip } from "./battle/TypeChip";
import { bulbapediaMoveUrl } from "../util/externalLinks";

export interface MoveVisibilityEditorProps {
  onClose: () => void;
}

/** Handles the vendored data's trailing "*" footnote marker (e.g. "60*"); non-numeric power
 * (variable-damage moves like Seismic Toss) sorts to the bottom. */
function parsePower(power: string): number {
  const value = parseFloat(power);
  return Number.isFinite(value) ? value : -1;
}

/**
 * Dev tool: lets a curator uncheck non-status moves to exclude them from random selection at
 * Pokemon generation and level-up (see api/moveVisibility.ts and PikaLocal.getRandomMove).
 */
export function MoveVisibilityEditor({ onClose }: MoveVisibilityEditorProps) {
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void PikaLocal.getAllMoves().then((allMoves) => {
      if (cancelled) return;
      const hidden = getHiddenMoveIds();
      setMoves(allMoves);
      setVisibleIds(new Set(allMoves.filter((move) => !hidden.has(move.id)).map((move) => move.id)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!moves) return [];
    return [...moves]
      .filter((move) => move.category !== "Status")
      .sort((a, b) => parsePower(b.power) - parsePower(a.power) || a.name.english.localeCompare(b.name.english))
      .map((move) => ({ move, description: moveDescription(move) }));
  }, [moves]);

  function toggle(id: string) {
    setVisibleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (!moves) return;
    setHiddenMoveIds(moves.filter((move) => !visibleIds.has(move.id)).map((move) => move.id));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b-2 border-slate-800 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-900">Hidden Moves</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!moves}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
      <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        Uncheck a move to exclude it from random Pokémon generation and level-up move rolls. Sorted by power.
      </p>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {!moves ? (
          <p className="text-sm text-slate-500">Loading moves…</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {rows.map(({ move, description }) => (
              <li key={move.id} className="flex items-start gap-3 py-2">
                <input
                  type="checkbox"
                  checked={visibleIds.has(move.id)}
                  onChange={() => toggle(move.id)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={bulbapediaMoveUrl(move.name.english)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-blue-600 underline"
                    >
                      {move.name.english}
                    </a>
                    <TypeChip type={move.type} />
                    <span className="text-xs font-semibold text-slate-500">{move.category}</span>
                    <span className="text-xs font-semibold text-slate-500">Power: {move.power}</span>
                    <span className="text-xs font-semibold text-slate-500">Accuracy: {move.accuracy}</span>
                  </div>
                  {description && <p className="mt-0.5 text-xs text-slate-600">{description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
