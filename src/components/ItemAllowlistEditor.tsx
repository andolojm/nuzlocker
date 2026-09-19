import { useEffect, useMemo, useState } from "react";
import type { Item } from "../api/pikaserve";

export interface ItemAllowlistEditorProps {
  title: string;
  /** Explains what checking something here does; shown above the list. */
  hint: string;
  /** Loads the full set of items to choose from. */
  loadItems: () => Promise<Item[]>;
  /** Loads the currently allowed ids. */
  loadEnabledIds: () => Set<number>;
  onSubmit: (ids: Set<number>) => void;
  onClose: () => void;
}

/**
 * Dev tool shell for editing an allowlist of items: an alphabetical checklist with All/None, and a
 * Submit that hands back the chosen ids. Shared by the opponent held-item and berry editors.
 */
export function ItemAllowlistEditor({
  title,
  hint,
  loadItems,
  loadEnabledIds,
  onSubmit,
  onClose,
}: ItemAllowlistEditorProps) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [enabledIds, setEnabledIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void loadItems().then((loaded) => {
      if (cancelled) return;
      setItems(loaded);
      setEnabledIds(loadEnabledIds());
    });
    return () => {
      cancelled = true;
    };
    // Deliberately runs once: the loaders are stable for this editor's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!items) return [];
    return [...items].sort((a, b) => a.name.english.localeCompare(b.name.english));
  }, [items]);

  function toggle(id: number) {
    setEnabledIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b-2 border-slate-800 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-900">{title}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!items) return;
              onSubmit(enabledIds);
              onClose();
            }}
            disabled={!items}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
        <p className="text-xs text-slate-600">{hint}</p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setEnabledIds(new Set(rows.map((item) => item.id)))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setEnabledIds(new Set())}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            None
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {!items ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {rows.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-2">
                <input
                  type="checkbox"
                  checked={enabledIds.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900">{item.name.english}</span>
                  <p className="mt-0.5 text-xs text-slate-600">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
