/** Maps a Catch stage's ballBonus to the ball name shown in its icon's tooltip. */
function ballName(ballBonus: number): string {
  if (ballBonus >= 2) return "Ultra Ball";
  if (ballBonus >= 1.5) return "Great Ball";
  return "Poké Ball";
}

interface BallSvgProps {
  className?: string;
}

/** Poké Ball: red cap, white base, black band and button ring. */
function PokeBallSvg({ className }: BallSvgProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="white" stroke="black" strokeWidth="2" />
      <path d="M 2 16 A 14 14 0 0 1 30 16 Z" fill="#e3350d" stroke="black" strokeWidth="2" />
      <rect x="2" y="14.5" width="28" height="3" fill="black" />
      <circle cx="16" cy="16" r="4.2" fill="white" stroke="black" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.6" fill="white" stroke="black" strokeWidth="1" />
    </svg>
  );
}

/** Great Ball: blue cap with a red brim accent, white base, black band and button ring. */
function GreatBallSvg({ className }: BallSvgProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="white" stroke="black" strokeWidth="2" />
      <path d="M 2 16 A 14 14 0 0 1 30 16 Z" fill="#2f6ec5" stroke="black" strokeWidth="2" />
      <path d="M 3.5 9 A 14 14 0 0 1 28.5 9 L 26.5 11 A 11.3 11.3 0 0 0 5.5 11 Z" fill="#e3350d" />
      <rect x="2" y="14.5" width="28" height="3" fill="black" />
      <path d="M 8 15.5 L 11 10.5 L 13 10.5 L 10 15.5 Z" fill="#e3350d" />
      <path d="M 19 15.5 L 22 10.5 L 24 10.5 L 21 15.5 Z" fill="#e3350d" />
      <circle cx="16" cy="16" r="4.2" fill="white" stroke="black" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.6" fill="white" stroke="black" strokeWidth="1" />
    </svg>
  );
}

/** Ultra Ball: black cap with a gold "wing" accent, white base, black band and button ring. */
function UltraBallSvg({ className }: BallSvgProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="white" stroke="black" strokeWidth="2" />
      <path d="M 2 16 A 14 14 0 0 1 30 16 Z" fill="#232323" stroke="black" strokeWidth="2" />
      <path d="M 4 13 L 12 8.5 L 15 12 L 9.5 15.5 Z" fill="#f5c53d" />
      <path d="M 28 13 L 20 8.5 L 17 12 L 22.5 15.5 Z" fill="#f5c53d" />
      <rect x="2" y="14.5" width="28" height="3" fill="black" />
      <circle cx="16" cy="16" r="4.2" fill="white" stroke="black" strokeWidth="2" />
      <circle cx="16" cy="16" r="1.6" fill="white" stroke="black" strokeWidth="1" />
    </svg>
  );
}

export interface BallIconProps {
  /** Catch-rate ball multiplier for the active Catch stage (Poké Ball = 1, Great Ball = 1.5, Ultra Ball = 2). */
  ballBonus: number;
  className?: string;
}

/** Renders the ball icon matching a Catch stage's ballBonus, titled with the ball's name for a tooltip. */
export function BallIcon({ ballBonus, className = "h-6 w-6" }: BallIconProps) {
  const name = ballName(ballBonus);
  const Svg = ballBonus >= 2 ? UltraBallSvg : ballBonus >= 1.5 ? GreatBallSvg : PokeBallSvg;
  return (
    <span title={name} aria-label={name} className="inline-flex">
      <Svg className={className} />
    </span>
  );
}
