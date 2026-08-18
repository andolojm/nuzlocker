export interface FormatContext {
  /** Display name for the opposing trainer/wild encounter, used for switch-in text. */
  opponentName: string;
}

type StatusCode = "brn" | "par" | "slp" | "frz" | "psn" | "tox";

const STATUS_INFLICTED: Record<StatusCode, string> = {
  brn: "was burned!",
  par: "is paralyzed! It may be unable to move!",
  slp: "fell asleep!",
  frz: "was frozen solid!",
  psn: "was poisoned!",
  tox: "was badly poisoned!",
};

const STATUS_CURED: Record<StatusCode, string> = {
  brn: "burn was healed.",
  par: "paralysis was cured.",
  slp: "woke up.",
  frz: "thawed out.",
  psn: "poison was cured.",
  tox: "poison was cured.",
};

const STAT_NAMES: Record<string, string> = {
  atk: "Attack",
  def: "Defense",
  spa: "Special Attack",
  spd: "Special Defense",
  spe: "Speed",
  accuracy: "accuracy",
  evasion: "evasiveness",
};

const WEATHER_START: Record<string, string> = {
  RainDance: "It started to rain!",
  SunnyDay: "The sunlight turned harsh!",
  Sandstorm: "A sandstorm kicked up!",
  Hail: "It started to hail!",
  Snow: "It started to snow!",
  none: "The weather cleared.",
};

const CANT_REASON: Record<string, string> = {
  flinch: "flinched and couldn't move!",
  par: "is paralyzed! It can't move!",
  slp: "is fast asleep.",
  frz: "is frozen solid!",
  recharge: "must recharge!",
};

/** Flavor text for the charging turn of two-turn moves (Fly, Solar Beam, etc.). */
const CHARGE_TEXT: Record<string, string> = {
  Fly: "flew up high!",
  Bounce: "sprang up!",
  Dig: "burrowed its way under the ground!",
  Dive: "hid underwater!",
  "Solar Beam": "took in sunlight!",
  "Solar Blade": "took in sunlight!",
  "Sky Attack": "is glowing!",
  "Skull Bash": "lowered its head!",
  "Razor Wind": "whipped up a whirlwind!",
  "Freeze Shock": "became cloaked in a freezing light!",
  "Ice Burn": "became cloaked in freezing air!",
  Geomancy: "is absorbing power!",
  "Phantom Force": "vanished instantly!",
  "Shadow Force": "vanished instantly!",
  "Meteor Beam": "is overflowing with space power!",
  "Electro Shot": "absorbed electricity!",
};

/**
 * Showdown reports some Pokemon names (e.g. Sirfetch'd, Farfetch'd) with a typographic apostrophe
 * (U+2019, "'") instead of the plain ASCII one (U+0027, "'") our data sources use. Left
 * un-normalized, a strict `===` comparison against our own data silently never matches.
 */
export function normalizeApostrophe(name: string): string {
  return name.replace(/’/g, "'");
}

/** The ident's name portion exactly as Showdown reports it, including any battleNickname suffix. */
export function rawIdentName(ident: string): string {
  const colon = ident.indexOf(": ");
  const name = colon === -1 ? ident : ident.slice(colon + 2);
  return normalizeApostrophe(name);
}

/** Player-facing name: rawIdentName with battleNickname's same-species disambiguation suffix removed. */
export function stripIdent(ident: string): string {
  return rawIdentName(ident).replace(/ #\d+$/, "");
}

function isPlayerSide(ident: string): boolean {
  return ident.startsWith("p1");
}

function hasTag(parts: string[], tag: string): boolean {
  return parts.some((part) => part.startsWith(tag));
}

function findTag(parts: string[], tag: string): string | undefined {
  const match = parts.find((part) => part.startsWith(tag));
  return match?.slice(tag.length);
}

function boostVerb(amount: number, positive: boolean): string {
  const magnitude = Math.abs(amount);
  const word = positive ? "rose" : "fell";
  if (magnitude >= 3) return `${word} ${positive ? "drastically" : "severely"}!`;
  if (magnitude === 2) return `${word} ${positive ? "sharply" : "harshly"}!`;
  return `${word}!`;
}

/**
 * Translates a single Showdown protocol log line into classic-game-style battle text.
 * Returns null for lines that don't have a player-facing message (raw HP updates, [silent]
 * bookkeeping lines, upkeep reminders, and protocol commands we don't render).
 */
export function formatBattleLine(line: string, context: FormatContext): string | null {
  if (!line.startsWith("|")) return null;
  const parts = line.split("|");
  const type = parts[1];

  if (hasTag(parts, "[silent]")) return null;

  switch (type) {
    case "move":
      return `${stripIdent(parts[2])} used ${parts[3]}!`;

    case "-damage": {
      const from = findTag(parts, "[from] ");
      if (!from) return null;
      const target = stripIdent(parts[2]);
      if (from === "psn" || from === "tox") return `${target} is hurt by poison!`;
      if (from === "brn") return `${target} is hurt by its burn!`;
      if (from === "Leech Seed") return `${target}'s health is sapped by Leech Seed!`;
      if (from.startsWith("item:")) return `${target} is hurt by its ${from.slice("item: ".length)}!`;
      return `${target} is hurt by ${from}!`;
    }

    case "-heal": {
      const from = findTag(parts, "[from] ");
      if (!from) return null;
      const target = stripIdent(parts[2]);
      if (from.startsWith("item:")) return `${target} restored a little HP using its ${from.slice("item: ".length)}!`;
      if (from === "drain") return `${target} had its energy drained!`;
      return `${target} regained health!`;
    }

    case "-miss":
      return `${stripIdent(parts[2])}'s attack missed!`;

    case "-fail":
      return "But it failed!";

    case "-immune":
      return `It doesn't affect ${stripIdent(parts[2])}...`;

    case "-status": {
      const text = STATUS_INFLICTED[parts[3] as StatusCode];
      return text ? `${stripIdent(parts[2])} ${text}` : null;
    }

    case "-curestatus": {
      const text = STATUS_CURED[parts[3] as StatusCode];
      return text ? `${stripIdent(parts[2])}'s ${text}` : null;
    }

    case "-boost":
    case "-unboost": {
      const stat = STAT_NAMES[parts[3]] ?? parts[3];
      const amount = Number(parts[4]) || 1;
      return `${stripIdent(parts[2])}'s ${stat} ${boostVerb(amount, type === "-boost")}`;
    }

    case "switch":
    case "drag": {
      const ident = parts[2];
      const name = stripIdent(ident);
      if (type === "drag") return `${name} was dragged out!`;
      return isPlayerSide(ident) ? `Go, ${name}!` : `${context.opponentName} sent out ${name}!`;
    }

    case "faint":
      return `${stripIdent(parts[2])} fainted!`;

    case "-ability":
      return `${stripIdent(parts[2])}'s ${parts[3]} activated!`;

    case "-item":
      return `${stripIdent(parts[2])} is holding ${parts[3]}!`;

    case "-enditem":
      return `${stripIdent(parts[2])} used its ${parts[3]}!`;

    case "-weather":
      return hasTag(parts, "[upkeep]") ? null : (WEATHER_START[parts[2]] ?? null);

    case "-sidestart":
    case "-sideend": {
      const side = parts[2].startsWith("p1") ? "your" : "the opposing";
      const condition = parts[3].replace(/^move: /, "");
      return type === "-sidestart"
        ? `${condition} started on ${side} team's side!`
        : `${condition} wore off ${side} team's side!`;
    }

    case "cant": {
      const reason = CANT_REASON[parts[3]] ?? "couldn't move!";
      return `${stripIdent(parts[2])} ${reason}`;
    }

    case "-prepare": {
      const text = CHARGE_TEXT[parts[3]] ?? "is charging its power!";
      return `${stripIdent(parts[2])} ${text}`;
    }

    case "-crit":
      return "A critical hit!";

    case "-supereffective":
      return "It's super effective!";

    case "-resisted":
      return "It's not very effective...";

    default:
      return null;
  }
}
