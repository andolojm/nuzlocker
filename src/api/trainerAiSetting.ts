/** Dev-tools-selected trainer AI implementation id, persisted across reloads. */
export const TRAINER_AI_STORAGE_KEY = "nuzlocker:trainer-ai";

function getStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

/** The persisted trainer AI id, or null if none has been chosen yet (caller should fall back to the default). */
export function getSelectedTrainerAiId(): string | null {
  return getStorage()?.getItem(TRAINER_AI_STORAGE_KEY) ?? null;
}

export function setSelectedTrainerAiId(id: string): void {
  getStorage()?.setItem(TRAINER_AI_STORAGE_KEY, id);
}
