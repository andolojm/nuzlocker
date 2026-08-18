import type { TeamPokemon } from "../engine/gameStateEngine";

/**
 * Showdown identifies Pokemon on the wire by nickname (never by species), and offers no other way
 * to tell apart two teammates that happen to share a species — which can happen if a caught team
 * has duplicate species on it. Left undisambiguated, every switch/faint/damage line for any of them
 * looks identical, and matching logic that keys off name (applyLogLine, submitSwitch in
 * useBattleController.ts) silently resolves to whichever one comes first in the team array.
 * Disambiguates same-species teammates with a suffix; leaves already-unique names untouched. " #"
 * can't collide with a real species/nickname, since nothing in this app's data ever produces that
 * substring — see formatBattleLine.ts's stripIdent, which strips it back off for display.
 */
export function battleNickname(team: TeamPokemon[], index: number): string {
  const name = team[index].name.english;
  const occurrence = team.slice(0, index + 1).filter((pokemon) => pokemon.name.english === name).length;
  return occurrence === 1 ? name : `${name} #${occurrence}`;
}
