import { useRef, useState } from "react";
import { gameStateEngine } from "../engine/gameStateEngine";
import { injectTestTeam } from "../engine/injectTestTeam";

export interface DevStageControlsProps {
  /** Called after the game state is replaced out from under React (inject/import/reset), so the caller can force the stage to remount. */
  onReset?: () => void;
}

export function DevStageControls({ onReset }: DevStageControlsProps) {
  const [injecting, setInjecting] = useState(false);
  const [status, _setStatus] = useState<string | null>(null);
  const timer = useRef(null)
  const setStatus = (status?: string) => {
    _setStatus(status)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => _setStatus(null), 5000)
  } 

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
      setStatus(error instanceof Error ? error.message : "Couldn't import from clipboard — see console.");
    }
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dev tools</h2>
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
    </div>
  );
}
