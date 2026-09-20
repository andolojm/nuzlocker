import { StageType } from "./stage";
import type { Stage } from "./stage";

describe("StageType", () => {
  it("exposes the battle and catch stage types with stable string values", () => {
    expect(StageType.Battle).toBe("battle");
    expect(StageType.Catch).toBe("catch");
  });
});

describe("Stage", () => {
  it("carries the level cap and cap for its stage type", () => {
    const stage: Stage = {
      type: StageType.Battle,
      level: 10,
      cap: 13,
    };

    expect(stage.type).toBe(StageType.Battle);
    expect(stage.level).toBe(10);
    expect(stage.cap).toBe(13);
  });
});
