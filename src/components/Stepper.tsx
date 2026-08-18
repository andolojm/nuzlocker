import { StageType } from "../engine/stage";
import type { Stage } from "../engine/stage";

export interface StepperProps {
  stages: Stage[];
  progress: number;
}

type StepStatus = "complete" | "current" | "upcoming";

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

export function BattleBallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2Z" fill="#1f2937" stroke="#1f2937" strokeWidth="1.4" />
      <path d="M2 12a10 10 0 0 0 20 0H2Z" fill="#ffffff" stroke="#1f2937" strokeWidth="1.4" />
      <rect x="2" y="11" width="20" height="2" fill="#facc15" />
      <circle cx="12" cy="12" r="3" fill="#facc15" stroke="#1f2937" strokeWidth="1.4" />
    </svg>
  );
}

function StepIcon({ stage, status }: { stage: Stage; status: StepStatus }) {
  const iconClassName = `h-5 w-5 ${status === "complete" ? "opacity-50 grayscale" : ""}`;

  return stage.type === StageType.Battle ? (
    <BattleBallIcon className={iconClassName} />
  ) : (
    <PokeballIcon className={iconClassName} />
  );
}

function StepNode({ stage, status }: { stage: Stage; status: StepStatus }) {
  const border =
    status === "current" ? "border-emerald-500" : status === "complete" ? "border-slate-200" : "border-slate-300";
  const background = status === "current" ? "bg-emerald-50" : "bg-white";

  return (
    <div
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${border} ${background}`}
      aria-current={status === "current" ? "step" : undefined}
    >
      <StepIcon stage={stage} status={status} />
    </div>
  );
}

export function Stepper({ stages, progress }: StepperProps) {
  return (
    <nav aria-label="Progress" className="w-full overflow-x-auto border-b border-slate-200 bg-white py-4">
      <ol role="list" className="flex w-max min-w-full items-center gap-6 px-6">
        {stages.map((stage, index) => {
          const status = stepStatus(index, progress);
          const isLast = index === stages.length - 1;
          const numberColor =
            status === "current" ? "text-emerald-600" : status === "complete" ? "text-slate-400" : "text-slate-500";

          return (
            <li
              key={index}
              className={`flex shrink-0 items-center gap-1.5 ${isLast ? "" : "flex-1 min-w-[4rem]"}`}
              title={stage.description}
            >
              <StepNode stage={stage} status={status} />
              {!isLast && (
                <div
                  className={`h-0.5 w-4 shrink-0 ${status === "complete" ? "bg-slate-400" : "bg-slate-200"}`}
                  aria-hidden="true"
                />
              )}
              <span className={`shrink-0 text-xs font-semibold ${numberColor}`}>{index + 1}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
