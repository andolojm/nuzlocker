import { StageType } from "./stage";
import type { Stage } from "./stage";

describe("StageType", () => {
  it("exposes the battle and catch stage types with stable string values", () => {
    expect(StageType.Battle).toBe("battle");
    expect(StageType.Catch).toBe("catch");
  });
});

describe("Stage", () => {
  it("pairs a stage type with descriptive text", () => {
    const stage: Stage = {
      type: StageType.Battle,
      description: "A wild trainer blocks your path.",
      level: 10,
      cap: 13,
    };

    expect(stage.type).toBe(StageType.Battle);
    expect(stage.description).toBe("A wild trainer blocks your path.");
  });
});
