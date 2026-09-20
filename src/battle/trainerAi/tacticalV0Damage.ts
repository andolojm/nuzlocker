import { Dex } from "@pkmn/sim";
import type { DamageSpec, MoveData } from "./damageMath";
import {
  AVERAGE_DAMAGE_ROLL,
  NO_POWER_MOVE_BASELINE,
  abilityOffenseStatMultiplier,
  abilityPowerMultiplier,
  abilityStabMultiplier,
  abilityStatusAttackMultiplier,
  averageHits,
  baseDamage,
  burnMultiplier,
  isImmuneViaAbility,
  terrainMultiplier,
  weatherMultiplier,
} from "./damageMath";
import { estimatedStat } from "./statMath";
import type { Combatant, FieldConditions, StatKey } from "./types";

/*
 * The damage formula exactly as it stood when the v0 trainer AI was frozen, kept alongside it so
 * that "Tactical v0" really is the old AI rather than the old decision logic wearing the current
 * damage math. The two differences against damageMath.ts are deliberate:
 *
 *   - no critical-hit expectation; every hit is priced as an ordinary one
 *   - no resolveBasePower pass, so a state-dependent move (Gyro Ball, Eruption, Hex) falls back to
 *     the Dex's own base power, or to NO_POWER_MOVE_BASELINE when the Dex reports 0
 *
 * Everything else — the ability, weather, terrain and STAB multipliers — is imported rather than
 * duplicated, because none of it changed. If one of those helpers is ever modified in a way that
 * shifts behavior, this file has to take its own copy of that helper too, or v0 stops being v0.
 */

/** computeSpecDamage as of the v0 freeze: no crit blend. */
export function computeSpecDamageV0(
  spec: DamageSpec,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
): number {
  const isPhysical = spec.category === "Physical";
  const atkKey: StatKey = isPhysical ? "atk" : "spa";
  const defKey: StatKey = isPhysical ? "def" : "spd";

  const attackStat =
    estimatedStat(attacker, atkKey) *
    abilityOffenseStatMultiplier(attacker.ability, spec.category) *
    abilityStatusAttackMultiplier(attacker.ability, attacker.status) *
    burnMultiplier(spec.category, attacker.status, attacker.ability);
  const defenseStat = estimatedStat(defender, defKey);

  const power =
    (spec.basePower || NO_POWER_MOVE_BASELINE) *
    abilityPowerMultiplier(attacker.ability, spec.basePower) *
    averageHits(spec.multihit);

  const stab = attacker.types.includes(spec.type) ? abilityStabMultiplier(attacker.ability) : 1;
  const typeMultiplier = isImmuneViaAbility(spec.type, defender.ability)
    ? 0
    : Math.pow(2, Dex.getEffectiveness(spec.type, defender.types));

  return (
    baseDamage(attacker.level, power, attackStat, defenseStat) *
    stab *
    typeMultiplier *
    weatherMultiplier(spec.type, field.weather) *
    terrainMultiplier(spec.type, field.terrain) *
    AVERAGE_DAMAGE_ROLL
  );
}

/** computeRawDamage as of the v0 freeze: the Dex move is fed to the formula as-is. */
export function computeRawDamageV0(
  moveData: MoveData,
  attacker: Combatant,
  defender: Combatant,
  field: FieldConditions,
): number {
  return computeSpecDamageV0(moveData, attacker, defender, field);
}
