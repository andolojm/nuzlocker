import { abilityByName } from "../../api/pikaLocal";
import { bulbapediaAbilityUrl } from "../../util/externalLinks";

/**
 * One-line ability readout for the Pokemon modals: the ability name (linked to Bulbapedia), with
 * its description as an indented bullet underneath — mirrors HeldItemLine's layout. The
 * description is looked up from the vendored ability data by name.
 */
export function AbilityLine({ ability }: { ability: string }) {
  const description = abilityByName(ability)?.description;

  return (
    <>
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
      </p>
      {description && (
        <ul className="list-disc pl-5 text-xs italic text-slate-600 min-[600px]:text-sm">
          <li>{description}</li>
        </ul>
      )}
    </>
  );
}
