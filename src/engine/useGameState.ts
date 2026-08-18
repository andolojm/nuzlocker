import { useSyncExternalStore } from "react";
import { gameStateEngine } from "./gameStateEngine";
import type { GameState } from "./gameStateEngine";

export function useGameState(): GameState {
  return useSyncExternalStore(
    (listener) => gameStateEngine.subscribe(listener),
    () => gameStateEngine.current,
  );
}
