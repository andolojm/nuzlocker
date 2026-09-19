import type { Item } from "../../api/pikaserve";
import { bulbapediaItemUrl } from "../../util/externalLinks";

/**
 * One-line held-item readout for the Pokemon modal: the item name (linked to Bulbapedia, like
 * AbilityLine's ability), with its description as an indented bullet underneath.
 */
export function HeldItemLine({ heldItem }: { heldItem: Item | undefined }) {
  return (
    <>
      <p className="text-xs min-[600px]:text-sm">
        <span className="font-semibold">Holding:</span>{" "}
        {heldItem ? (
          <a
            href={bulbapediaItemUrl(heldItem.name.english)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-blue-600 underline"
          >
            {heldItem.name.english}
          </a>
        ) : (
          <span className="italic text-slate-600">nothing</span>
        )}
      </p>
      {heldItem && (
        <ul className="list-disc pl-5 text-xs italic text-slate-600 min-[600px]:text-sm">
          <li>{heldItem.description}</li>
        </ul>
      )}
    </>
  );
}
