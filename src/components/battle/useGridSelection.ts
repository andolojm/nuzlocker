import { useEffect, useState } from "react";

export interface UseGridSelectionOptions {
  itemCount: number;
  columns: number;
  isDisabled: (index: number) => boolean;
  onActivate: (index: number) => void;
  /** Fired on Escape/Backspace. Omit if this grid has nothing to close back to. */
  onClose?: () => void;
  /** Whether this grid currently owns keyboard input. Defaults to true. */
  active?: boolean;
}

function firstEnabledIndex(itemCount: number, isDisabled: (index: number) => boolean): number {
  for (let index = 0; index < itemCount; index++) {
    if (!isDisabled(index)) return index;
  }
  return 0;
}

export function useGridSelection({
  itemCount,
  columns,
  isDisabled,
  onActivate,
  onClose,
  active = true,
}: UseGridSelectionOptions) {
  const [selected, setSelected] = useState(() => firstEnabledIndex(itemCount, isDisabled));

  useEffect(() => {
    if (isDisabled(selected)) {
      setSelected(firstEnabledIndex(itemCount, isDisabled));
    }
  }, [selected, itemCount, isDisabled]);

  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      const row = Math.floor(selected / columns);
      const col = selected % columns;
      let next = selected;

      if (event.key === "ArrowUp" && row > 0) {
        next = selected - columns;
      } else if (event.key === "ArrowDown" && selected + columns < itemCount) {
        next = selected + columns;
      } else if (event.key === "ArrowLeft" && col > 0) {
        next = selected - 1;
      } else if (event.key === "ArrowRight" && col < columns - 1 && selected + 1 < itemCount) {
        next = selected + 1;
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!isDisabled(selected)) onActivate(selected);
        return;
      } else if ((event.key === "Escape" || event.key === "Backspace") && onClose) {
        event.preventDefault();
        onClose();
        return;
      } else {
        return;
      }

      event.preventDefault();
      if (!isDisabled(next)) setSelected(next);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, itemCount, columns, isDisabled, onActivate, onClose, active]);

  return { selected, setSelected };
}
