import { useState } from "react";
import { Outlet } from "react-router-dom";
import { gameStateEngine } from "../engine/gameStateEngine";
import { Header } from "./Header";

export interface LayoutContext {
  /** Bump this into a StageFlow `key` to force a remount after game state is replaced out from under React. */
  resetToken: number;
  bumpReset: () => void;
}

export function Layout() {
  const [resetToken, setResetToken] = useState(0);
  const bumpReset = () => setResetToken((token) => token + 1);

  function handleReset() {
    gameStateEngine.resetRun();
    bumpReset();
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header onReset={handleReset} />
      <Outlet context={{ resetToken, bumpReset } satisfies LayoutContext} />
    </div>
  );
}
