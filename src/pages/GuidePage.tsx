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

      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">Installing this app</h2>
        <p className="mt-1 text-sm text-slate-600">
          PokeRally is a Progressive Web App (PWA) — a website that can be installed like a regular
          app. Installing it adds an icon to your home screen, opens it in its own window without
          browser tabs or an address bar, and lets it keep working (aside from fetching new
          Pokémon images) without an internet connection.
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>
            <a
              href="https://support.apple.com/guide/iphone/iphea86e5236/ios"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-blue-600 underline"
            >
              How to install on iPhone/iPad
            </a>{" "}
            (Apple Support)
          </li>
          <li>
            <a
              href="https://support.google.com/chrome/answer/9658361"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-blue-600 underline"
            >
              How to install on Android
            </a>{" "}
            (Google Chrome Help)
          </li>
        </ul>
      </section>
    </main>
  );
}
