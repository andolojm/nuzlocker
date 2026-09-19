import { PikaLocal } from "../api/pikaLocal";
import { getOpponentBerryIds, setOpponentBerryIds } from "../api/opponentBerries";
import { ItemAllowlistEditor } from "./ItemAllowlistEditor";

export interface OpponentBerryEditorProps {
  onClose: () => void;
}

/**
 * Dev tool: picks which berries an opposing Pokemon may be given when a Battle stage's team is
 * generated (see api/opponentBerries and PikaLocal.getRandomOpponentItem).
 */
export function OpponentBerryEditor({ onClose }: OpponentBerryEditorProps) {
  return (
    <ItemAllowlistEditor
      title="Opponent Berries"
      hint="Check a berry to let opposing Pokémon carry it into a battle stage. Half the time an opponent is given a held item instead; with nothing checked here, the other half holds nothing. Wild Pokémon never hold items."
      loadItems={() => PikaLocal.getAllBerries()}
      loadEnabledIds={getOpponentBerryIds}
      onSubmit={setOpponentBerryIds}
      onClose={onClose}
    />
  );
}
