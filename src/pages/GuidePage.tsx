import { SCORING_RULE_EXPLAINERS, ScoringRule } from "../engine/scoring";

export function GuidePage() {
  return (
    <main className="mx-auto max-w-5xl px-1 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Guide</h1>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">Scoring</h2>
        <p className="mt-1 text-sm text-slate-600">
          Your current run keeps a running score, shown in the header. It changes as follows:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          {Object.values(ScoringRule).map((rule) => (
            <li key={rule}>{SCORING_RULE_EXPLAINERS[rule]}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
