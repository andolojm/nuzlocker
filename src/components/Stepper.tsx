import { StageType } from "../engine/stage";
import type { Stage } from "../engine/stage";

export interface StepperProps {
  stages: Stage[];
  progress: number;
}

type StepStatus = "complete" | "current" | "upcoming";

const BATTLE_ACCENT = { fill: "bg-rose-600", ring: "border-rose-600", dot: "bg-rose-600" };

function stepStatus(index: number, progress: number): StepStatus {
  if (index < progress) return "complete";
  if (index === progress) return "current";
  return "upcoming";
}

export function PokeballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2Z" fill="#ef4444" stroke="#1f2937" strokeWidth="1.4" />
      <path d="M2 12a10 10 0 0 0 20 0H2Z" fill="#ffffff" stroke="#1f2937" strokeWidth="1.4" />
      <rect x="2" y="11" width="20" height="2" fill="#1f2937" />
      <circle cx="12" cy="12" r="3" fill="#ffffff" stroke="#1f2937" strokeWidth="1.4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5 text-white">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CatchStepNode({ status }: { status: StepStatus }) {
  const border =
    status === "current" ? "border-slate-900" : status === "complete" ? "border-slate-300" : "border-slate-200";

  return (
    <div
      className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white ${border}`}
      aria-current={status === "current" ? "step" : undefined}
    >
      <PokeballIcon className={`h-5 w-5 ${status === "upcoming" ? "opacity-40 grayscale" : ""}`} />
    </div>
  );
}

// Placeholder styling until a dedicated battle icon replaces this.
function BattleStepNode({ status }: { status: StepStatus }) {
  if (status === "complete") {
    return (
      <div className={`relative flex h-8 w-8 items-center justify-center rounded-full ${BATTLE_ACCENT.fill}`}>
        <CheckIcon />
      </div>
    );
  }

  if (status === "current") {
    return (
      <div
        className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white ${BATTLE_ACCENT.ring}`}
        aria-current="step"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${BATTLE_ACCENT.dot}`} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
      <span className="h-2.5 w-2.5 rounded-full bg-transparent" aria-hidden="true" />
    </div>
  );
}

function StepNode({ stage, status }: { stage: Stage; status: StepStatus }) {
  return stage.type === StageType.Battle ? (
    <BattleStepNode status={status} />
  ) : (
    <CatchStepNode status={status} />
  );
}

export function Stepper({ stages, progress }: StepperProps) {
  return (
    <nav aria-label="Progress">
      <ol role="list" className="flex flex-wrap items-center gap-y-6">
        {stages.map((stage, index) => {
          const status = stepStatus(index, progress);
          const isLast = index === stages.length - 1;

          return (
            <li key={index} className={isLast ? "relative w-8" : "relative w-14 sm:w-16"} title={stage.description}>
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className={`h-0.5 w-full ${status === "complete" ? "bg-slate-400" : "bg-slate-200"}`} />
              </div>
              <StepNode stage={stage} status={status} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
