import { useRef, useState } from "react";
import { getSelectedTrainerAiId, setSelectedTrainerAiId } from "../api/trainerAiSetting";
import { DEFAULT_TRAINER_AI_ID, TRAINER_AI_IMPLEMENTATIONS } from "../battle/trainerAi";
import { gameStateEngine } from "../engine/gameStateEngine";
import { injectTestTeam } from "../engine/injectTestTeam";
import { MoveVisibilityEditor } from "./MoveVisibilityEditor";
import { preloadAllPokemonImages } from "../util/preloadPokemonImages";

export interface DevStageControlsProps {
  /** Called after the game state is replaced out from under React (inject/import/reset), so the caller can force the stage to remount. */
  onReset?: () => void;
}

export function DevStageControls({ onReset }: DevStageControlsProps) {
  const [injecting, setInjecting] = useState(false);
  const [showMoveEditor, setShowMoveEditor] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [preloadingImages, setPreloadingImages] = useState(false);
  const [trainerAiId, setTrainerAiId] = useState(() => getSelectedTrainerAiId() ?? DEFAULT_TRAINER_AI_ID);
  const [status, _setStatus] = useState<string | null>(null);
  const timer = useRef<number>(null);
  const setStatus = (status?: string) => {
    _setStatus(status ?? null);

    if(timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => _setStatus(null), 5000);
  };

  async function handleInjectTestTeam() {
    setInjecting(true);
    try {
      await injectTestTeam();
      onReset?.();
    } catch (error) {
      console.error("Failed to inject test team", error);
    } finally {
      setInjecting(false);
    }
  }

  async function handlePreloadImages() {
    setPreloadingImages(true);
    try {
      await preloadAllPokemonImages((progress) => {
        setStatus(`Caching Pokemon images… ${progress.loaded}/${progress.total}`);
      });
      setStatus("Cached all Pokemon images for offline use.");
    } catch (error) {
      console.error("Failed to preload Pokemon images", error);
      setStatus("Couldn't cache Pokemon images — see console.");
    } finally {
      setPreloadingImages(false);
    }
  }

  function handleTrainerAiChange(id: string) {
    setTrainerAiId(id);
    setSelectedTrainerAiId(id);
  }

  function handleResetState() {
    gameStateEngine.resetRun();
    setStatus("Reset game state to initial.");
    onReset?.();
  }

  async function handleExportState() {
    try {
      await navigator.clipboard.writeText(gameStateEngine.exportState());
      setStatus("Copied game state to clipboard.");
    } catch (error) {
      console.error("Failed to export game state", error);
      setStatus("Couldn't copy to clipboard — see console.");
    }
  }

  async function handleImportState() {
    try {
      const json = await navigator.clipboard.readText();
      gameStateEngine.importState(json);
      setStatus("Imported game state from clipboard.");
      onReset?.();
    } catch (error) {
      console.error("Failed to import game state", error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Couldn't import from clipboard — see console.",
      );
    }
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="text-xs font-semibold uppercase text-slate-500 hover:text-slate-700"
      >
        Dev tools {expanded ? "▲" : "▼"}
      </button>
      {expanded && (
        <>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => gameStateEngine.regressState()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              BACK
            </button>
            <button
              type="button"
              onClick={() => gameStateEngine.progressState()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              NEXT
            </button>
          </div>
          <button
            type="button"
            disabled={injecting}
            onClick={handleInjectTestTeam}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {injecting ? "INJECTING…" : "INJECT TEST TEAM"}
          </button>
          <button
            type="button"
            onClick={() => setShowMoveEditor(true)}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            HIDDEN MOVES
          </button>
          <button
            type="button"
            disabled={preloadingImages}
            onClick={() => void handlePreloadImages()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {preloadingImages ? "CACHING IMAGES…" : "PRELOAD & CACHE IMAGES"}
          </button>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            TRAINER AI
            <select
              value={trainerAiId}
              onChange={(event) => handleTrainerAiChange(event.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {TRAINER_AI_IMPLEMENTATIONS.map((impl) => (
                <option key={impl.id} value={impl.id}>
                  {impl.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleExportState()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              EXPORT STATE
            </button>
            <button
              type="button"
              onClick={handleResetState}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              RESET STATE
            </button>
            <button
              type="button"
              onClick={() => void handleImportState()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              IMPORT STATE
            </button>
          </div>
          {status && <p className="text-xs text-slate-500">{status}</p>}
        </>
      )}
      {showMoveEditor && <MoveVisibilityEditor onClose={() => setShowMoveEditor(false)} />}
    </div>
  );
}
