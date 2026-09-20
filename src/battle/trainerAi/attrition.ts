import { Dex } from "@pkmn/sim";
import type { Combatant, FieldConditions, HazardState } from "./types";

/*
 * Damage that lands without anyone selecting a move: status ticks, weather chip, terrain healing,
 * and the toll a switch-in pays walking into entry hazards. The horizon model is only as good as
 * its turn counts, and a burned Pokemon standing in a sandstorm loses an eighth of its health per
 * turn to things no attack accounts for.
 */

/** Per-turn fraction of max HP lost to each non-volatile status. */
const STATUS_RESIDUAL_FRACTION: Record<string, number> = {
  brn: 1 / 16,
  psn: 1 / 8,
  // Toxic ramps 1/16, 2/16, 3/16...; this is its average over a horizon-length stay, not its first tick.
  tox: 2 / 16,
};

/** Abilities that turn off every form of indirect chip damage for their holder. */
const CHIP_IMMUNE_ABILITIES = new Set(["Magic Guard"]);
/** Abilities that specifically shrug off weather chip. */
const WEATHER_CHIP_IMMUNE_ABILITIES = new Set([
  "Overcoat",
  "Sand Veil",
  "Sand Rush",
  "Sand Force",
  "Snow Cloak",
  "Ice Body",
  "Slush Rush",
]);

const SANDSTORM_IMMUNE_TYPES = ["Rock", "Ground", "Steel"];

/** Whether hazards and terrain reach this Pokemon. Mirrors the grounding assumption damageMath already makes for terrain. */
export function isGrounded(combatant: Combatant): boolean {
  return !combatant.types.includes("Flying") && combatant.ability !== "Levitate";
}

/**
 * Net HP lost per turn to everything other than attacks, as a fraction of max HP. Negative when
 * the Pokemon is healing faster than it is chipped (Grassy Terrain with no status).
 */
export function residualFractionPerTurn(combatant: Combatant, field: FieldConditions): number {
  if (combatant.ability !== undefined && CHIP_IMMUNE_ABILITIES.has(combatant.ability)) return 0;

  let fraction = combatant.status ? (STATUS_RESIDUAL_FRACTION[combatant.status] ?? 0) : 0;

  const weatherImmune =
    combatant.ability !== undefined && WEATHER_CHIP_IMMUNE_ABILITIES.has(combatant.ability);
  if (!weatherImmune) {
    if (field.weather === "Sandstorm" && !SANDSTORM_IMMUNE_TYPES.some((type) => combatant.types.includes(type))) {
      fraction += 1 / 16;
    }
    // Gen 9 Snow is purely a defensive boost; only the older Hail actually chips.
    if (field.weather === "Hail" && !combatant.types.includes("Ice")) fraction += 1 / 16;
  }

  if (field.terrain === "Grassy Terrain" && isGrounded(combatant)) fraction -= 1 / 16;

  return fraction;
}

/** Net HP lost per turn to residual effects, in HP points. */
export function residualDamagePerTurn(combatant: Combatant, field: FieldConditions): number {
  return residualFractionPerTurn(combatant, field) * combatant.maxHp;
}

/** Spikes damage by layer count. */
const SPIKES_FRACTION = [0, 1 / 8, 1 / 6, 1 / 4];
/**
 * HP-equivalent charged for the non-damaging hazards, so a switch-in that walks into poison or a
 * Speed drop is compared against one that walks into Stealth Rock in the same currency.
 */
const TOXIC_SPIKES_EQUIVALENT = [0, 0.12, 0.2];
const STICKY_WEB_EQUIVALENT = 0.06;

const TOXIC_SPIKES_IMMUNE_TYPES = ["Poison", "Steel"];

/**
 * What switching this Pokemon in costs, as a fraction of its max HP. Real damage for Stealth Rock
 * and Spikes; an HP-equivalent stand-in for Toxic Spikes and Sticky Web, whose cost is real but
 * isn't paid in HP.
 */
export function switchInHazardCost(combatant: Combatant, hazards: HazardState | undefined): number {
  if (!hazards) return 0;
  const chipImmune = combatant.ability !== undefined && CHIP_IMMUNE_ABILITIES.has(combatant.ability);
  const grounded = isGrounded(combatant);
  let cost = 0;

  if (hazards.stealthRock && !chipImmune) {
    cost += (1 / 8) * Math.pow(2, Dex.getEffectiveness("Rock", combatant.types));
  }
  if (grounded) {
    if (!chipImmune) cost += SPIKES_FRACTION[Math.min(hazards.spikes, 3)];
    // A grounded Poison-type absorbs the layers on the way in rather than being poisoned by them.
    if (!TOXIC_SPIKES_IMMUNE_TYPES.some((type) => combatant.types.includes(type)) && combatant.status === null) {
      cost += TOXIC_SPIKES_EQUIVALENT[Math.min(hazards.toxicSpikes, 2)];
    }
    if (hazards.stickyWeb) cost += STICKY_WEB_EQUIVALENT;
  }

  return cost;
}
