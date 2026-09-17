import { useState } from "react";
import { NavLink } from "react-router-dom";
import { ResetConfirmModal } from "./ResetConfirmModal";

export interface HeaderProps {
  /** Reset game state to initial, same as the "RESET STATE" dev tool button. */
  onReset: () => void;
}

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-semibold ${
    isActive ? "text-emerald-600" : "text-slate-700 hover:text-emerald-600"
  }`;

export function Header({ onReset }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  function handleResetClick() {
    setMenuOpen(false);
    setConfirmingReset(true);
  }

  function handleResetConfirm() {
    setConfirmingReset(false);
    onReset();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <span className="text-lg font-extrabold tracking-tight text-slate-900">PokeRally</span>

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          <NavLink to="/" end className={linkClassName}>
            Play
          </NavLink>
          <NavLink to="/guide" className={linkClassName}>
            Guide
          </NavLink>
          <button
            type="button"
            onClick={handleResetClick}
            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600"
          >
            Reset
          </button>
          <NavLink to="/hall-of-fame" className={linkClassName}>
            Hall of Fame
          </NavLink>
        </nav>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 sm:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <HamburgerIcon />
        </button>
      </div>

      {menuOpen && (
        <nav aria-label="Main" className="flex flex-col items-end gap-1 border-t border-slate-200 px-6 py-2 sm:hidden">
          <NavLink to="/" end className={linkClassName} onClick={() => setMenuOpen(false)}>
            Play
          </NavLink>
          <NavLink to="/guide" className={linkClassName} onClick={() => setMenuOpen(false)}>
            Guide
          </NavLink>
          <button
            type="button"
            onClick={handleResetClick}
            className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600"
          >
            Reset
          </button>
          <NavLink to="/hall-of-fame" className={linkClassName} onClick={() => setMenuOpen(false)}>
            Hall of Fame
          </NavLink>
        </nav>
      )}

      {confirmingReset && (
        <ResetConfirmModal onCancel={() => setConfirmingReset(false)} onConfirm={handleResetConfirm} />
      )}
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
