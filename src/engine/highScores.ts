/** One completed, victorious run — just enough to list and re-display it later. */
export interface HighScoreEntry {
  timestamp: number;
  score: number;
  /** English names of the Pokemon still alive when the run was won. */
  survivors: string[];
}

export const HIGH_SCORES_STORAGE_KEY = "nuzlocker:high-scores";

function getStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function isHighScoreEntry(value: unknown): value is HighScoreEntry {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.timestamp === "number" &&
    typeof candidate.score === "number" &&
    Array.isArray(candidate.survivors)
  );
}

/** Every saved high score, oldest first (insertion order) — see highScoresSortedByScore for display order. */
export function loadHighScores(): HighScoreEntry[] {
  const raw = getStorage()?.getItem(HIGH_SCORES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isHighScoreEntry) : [];
  } catch {
    return [];
  }
}

/** Appends a newly completed run's score, alongside every previously saved one. */
export function saveHighScore(entry: HighScoreEntry): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(HIGH_SCORES_STORAGE_KEY, JSON.stringify([...loadHighScores(), entry]));
}

/** Every saved high score, highest score first. */
export function highScoresSortedByScore(): HighScoreEntry[] {
  return [...loadHighScores()].sort((a, b) => b.score - a.score);
}
