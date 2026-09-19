/**
 * @jest-environment jsdom
 */
import { HIGH_SCORES_STORAGE_KEY, highScoresSortedByScore, loadHighScores, saveHighScore } from "./highScores";

describe("highScores", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty list when nothing has been saved", () => {
    expect(loadHighScores()).toEqual([]);
  });

  it("persists a saved entry to localStorage", () => {
    saveHighScore({ timestamp: 1, score: 100, survivors: ["Pikachu"] });

    expect(loadHighScores()).toEqual([{ timestamp: 1, score: 100, survivors: ["Pikachu"] }]);
    const persisted = JSON.parse(localStorage.getItem(HIGH_SCORES_STORAGE_KEY)!);
    expect(persisted).toEqual([{ timestamp: 1, score: 100, survivors: ["Pikachu"] }]);
  });

  it("keeps every previously saved entry when a new one is added", () => {
    saveHighScore({ timestamp: 1, score: 100, survivors: ["Pikachu"] });
    saveHighScore({ timestamp: 2, score: 200, survivors: ["Charizard"] });

    expect(loadHighScores()).toHaveLength(2);
  });

  it("falls back to an empty list when localStorage contains invalid JSON", () => {
    localStorage.setItem(HIGH_SCORES_STORAGE_KEY, "{not valid json");
    expect(loadHighScores()).toEqual([]);
  });

  it("sorts saved entries by score, highest first", () => {
    saveHighScore({ timestamp: 1, score: 100, survivors: [] });
    saveHighScore({ timestamp: 2, score: 500, survivors: [] });
    saveHighScore({ timestamp: 3, score: 250, survivors: [] });

    expect(highScoresSortedByScore().map((entry) => entry.score)).toEqual([500, 250, 100]);
  });
});
