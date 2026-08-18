import { formatBattleLine, normalizeApostrophe, stripIdent } from "./formatBattleLine";

const ctx = { opponentName: "Bug Catcher Wade" };

describe("normalizeApostrophe", () => {
  it("converts a typographic apostrophe to a plain ASCII one", () => {
    expect(normalizeApostrophe("Sirfetch’d")).toBe("Sirfetch'd");
  });

  it("leaves an already-plain apostrophe untouched", () => {
    expect(normalizeApostrophe("Sirfetch'd")).toBe("Sirfetch'd");
  });
});

describe("stripIdent", () => {
  it("normalizes a typographic apostrophe in the extracted name", () => {
    // Showdown reports Sirfetch'd/Farfetch'd idents with U+2019, not the plain ASCII apostrophe
    // our own data uses — without normalizing here, a strict `===` against our data never matches.
    expect(stripIdent("p1a: Sirfetch’d")).toBe("Sirfetch'd");
  });
});

describe("formatBattleLine", () => {
  it("returns null for a non-protocol line", () => {
    expect(formatBattleLine("not a protocol line", ctx)).toBeNull();
  });

  it("returns null for a [silent] line regardless of type", () => {
    expect(formatBattleLine("|-heal|p1a: Bulbasaur|100/100|[silent]", ctx)).toBeNull();
  });

  it("formats move usage", () => {
    expect(formatBattleLine("|move|p1a: Charmander|Ember|p2a: Squirtle", ctx)).toBe("Charmander used Ember!");
  });

  it("returns null for plain damage with no [from] tag (HP bar handles it)", () => {
    expect(formatBattleLine("|-damage|p2a: Squirtle|64/80", ctx)).toBeNull();
  });

  it("formats poison damage", () => {
    expect(formatBattleLine("|-damage|p1a: Bulbasaur|75/100 psn|[from] psn", ctx)).toBe(
      "Bulbasaur is hurt by poison!",
    );
  });

  it("formats burn damage", () => {
    expect(formatBattleLine("|-damage|p1a: Bulbasaur|75/100 brn|[from] brn", ctx)).toBe(
      "Bulbasaur is hurt by its burn!",
    );
  });

  it("formats Leech Seed damage", () => {
    expect(formatBattleLine("|-damage|p2a: Squirtle|60/80|[from] Leech Seed|[of] p1a: Bulbasaur", ctx)).toBe(
      "Squirtle's health is sapped by Leech Seed!",
    );
  });

  it("formats item-caused damage", () => {
    expect(formatBattleLine("|-damage|p1a: Charmander|50/100|[from] item: Life Orb", ctx)).toBe(
      "Charmander is hurt by its Life Orb!",
    );
  });

  it("returns null for plain heal with no [from] tag", () => {
    expect(formatBattleLine("|-heal|p1a: Bulbasaur|100/100", ctx)).toBeNull();
  });

  it("formats item-caused healing", () => {
    expect(formatBattleLine("|-heal|p1a: Bulbasaur|90/100|[from] item: Leftovers", ctx)).toBe(
      "Bulbasaur restored a little HP using its Leftovers!",
    );
  });

  it("formats drain healing", () => {
    expect(formatBattleLine("|-heal|p1a: Bulbasaur|90/100|[from] drain|[of] p2a: Squirtle", ctx)).toBe(
      "Bulbasaur had its energy drained!",
    );
  });

  it("formats a miss", () => {
    expect(formatBattleLine("|-miss|p1a: Charmander|p2a: Squirtle", ctx)).toBe("Charmander's attack missed!");
  });

  it("formats a failure", () => {
    expect(formatBattleLine("|-fail|p2a: Squirtle", ctx)).toBe("But it failed!");
  });

  it("formats immunity", () => {
    expect(formatBattleLine("|-immune|p2a: Squirtle", ctx)).toBe("It doesn't affect Squirtle...");
  });

  it("formats a status being inflicted", () => {
    expect(formatBattleLine("|-status|p2a: Squirtle|brn", ctx)).toBe("Squirtle was burned!");
  });

  it("formats a status being cured", () => {
    expect(formatBattleLine("|-curestatus|p1a: Bulbasaur|par", ctx)).toBe("Bulbasaur's paralysis was cured.");
  });

  it("formats a single-stage boost", () => {
    expect(formatBattleLine("|-boost|p1a: Bulbasaur|atk|1", ctx)).toBe("Bulbasaur's Attack rose!");
  });

  it("formats a two-stage unboost", () => {
    expect(formatBattleLine("|-unboost|p2a: Squirtle|def|2", ctx)).toBe("Squirtle's Defense fell harshly!");
  });

  it("formats the player's own switch-in", () => {
    expect(formatBattleLine("|switch|p1a: Charmander|Charmander, L12|39/39", ctx)).toBe("Go, Charmander!");
  });

  it("formats the opponent's switch-in using the trainer name", () => {
    expect(formatBattleLine("|switch|p2a: Caterpie|Caterpie, L10|45/45", ctx)).toBe(
      "Bug Catcher Wade sent out Caterpie!",
    );
  });

  it("formats a forced drag-out", () => {
    expect(formatBattleLine("|drag|p2a: Caterpie|Caterpie, L10|45/45", ctx)).toBe("Caterpie was dragged out!");
  });

  it("formats a faint", () => {
    expect(formatBattleLine("|faint|p2a: Squirtle", ctx)).toBe("Squirtle fainted!");
  });

  it("formats an ability activation", () => {
    expect(formatBattleLine("|-ability|p1a: Charmander|Blaze", ctx)).toBe("Charmander's Blaze activated!");
  });

  it("formats an item reveal", () => {
    expect(formatBattleLine("|-item|p2a: Squirtle|Oran Berry", ctx)).toBe("Squirtle is holding Oran Berry!");
  });

  it("formats an item being consumed", () => {
    expect(formatBattleLine("|-enditem|p2a: Squirtle|Oran Berry", ctx)).toBe("Squirtle used its Oran Berry!");
  });

  it("formats weather starting", () => {
    expect(formatBattleLine("|-weather|Sandstorm", ctx)).toBe("A sandstorm kicked up!");
  });

  it("suppresses weather upkeep reminders", () => {
    expect(formatBattleLine("|-weather|Sandstorm|[upkeep]", ctx)).toBeNull();
  });

  it("formats a hazard being set", () => {
    expect(formatBattleLine("|-sidestart|p2: Bug Catcher Wade|Spikes", ctx)).toBe(
      "Spikes started on the opposing team's side!",
    );
  });

  it("formats a hazard wearing off", () => {
    expect(formatBattleLine("|-sideend|p1: Red|Spikes", ctx)).toBe("Spikes wore off your team's side!");
  });

  it("formats a Pokemon flinching", () => {
    expect(formatBattleLine("|cant|p2a: Squirtle|flinch", ctx)).toBe("Squirtle flinched and couldn't move!");
  });

  it("formats a forced recharge turn", () => {
    expect(formatBattleLine("|cant|p1a: Snorlax|recharge", ctx)).toBe("Snorlax must recharge!");
  });

  it("formats the charge turn of a known two-turn move", () => {
    expect(formatBattleLine("|-prepare|p1a: Charizard|Fly", ctx)).toBe("Charizard flew up high!");
  });

  it("falls back to generic charge text for an unlisted two-turn move", () => {
    expect(formatBattleLine("|-prepare|p1a: Deoxys|Some New Move", ctx)).toBe("Deoxys is charging its power!");
  });

  it("formats a critical hit", () => {
    expect(formatBattleLine("|-crit|p2a: Squirtle", ctx)).toBe("A critical hit!");
  });

  it("formats a super effective hit", () => {
    expect(formatBattleLine("|-supereffective|p2a: Squirtle", ctx)).toBe("It's super effective!");
  });

  it("formats a resisted hit", () => {
    expect(formatBattleLine("|-resisted|p2a: Squirtle", ctx)).toBe("It's not very effective...");
  });

  it("returns null for an unrecognized protocol command", () => {
    expect(formatBattleLine("|turn|3", ctx)).toBeNull();
  });
});
