import { abilityByName } from "../../api/pikaLocal";
import { bulbapediaAbilityUrl } from "../../util/externalLinks";

/**
 * One-line ability readout for the Pokemon modals: the ability name in bold, followed by its
 * description. The description is looked up from the vendored ability data by name.
 */
export function AbilityLine({ ability }: { ability: string }) {
  const description = abilityByName(ability)?.description;

  return (
    <p className="text-xs min-[600px]:text-sm">
      <span className="font-semibold">Ability:</span>{" "}
      <a
        href={bulbapediaAbilityUrl(ability)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-bold text-blue-600 underline"
      >
        {ability}
      </a>
      {description && <span className="italic text-slate-600"> — {description}</span>}
    </p>
  );
}
