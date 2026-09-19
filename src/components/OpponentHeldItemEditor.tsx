import { PikaLocal } from "../api/pikaLocal";
import { getOpponentHeldItemIds, setOpponentHeldItemIds } from "../api/opponentHeldItems";
import { ItemAllowlistEditor } from "./ItemAllowlistEditor";

export interface OpponentHeldItemEditorProps {
  onClose: () => void;
}

/**
 * Dev tool: picks which held items an opposing Pokemon may be given when a Battle stage's team is
 * generated (see api/opponentHeldItems and PikaLocal.getRandomOpponentItem).
 */
export function OpponentHeldItemEditor({ onClose }: OpponentHeldItemEditorProps) {
  return (
    <ItemAllowlistEditor
      title="Opponent Held Items"
      hint="Check an item to let opposing Pokémon carry it into a battle stage. Half the time an opponent is given a berry instead; with nothing checked here, the other half holds nothing. Wild Pokémon never hold items."
      loadItems={() => PikaLocal.getAllHeldItems()}
      loadEnabledIds={getOpponentHeldItemIds}
      onSubmit={setOpponentHeldItemIds}
      onClose={onClose}
    />
  );
}
