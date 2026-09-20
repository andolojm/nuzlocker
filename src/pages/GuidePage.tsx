import { useState } from "react";
import { PreloadImagesConfirmModal } from "../components/PreloadImagesConfirmModal";
import { SCORING_RULE_EXPLAINERS, ScoringRule } from "../engine/scoring";
import { preloadAllPokemonImages } from "../util/preloadPokemonImages";

export function GuidePage() {
  const [confirmingPreload, setConfirmingPreload] = useState(false);
  const [preloadStatus, setPreloadStatus] = useState<string | null>(null);

  async function handlePreloadImages() {
    setConfirmingPreload(false);
    setPreloadStatus("Downloading…");
    try {
      await preloadAllPokemonImages((progress) => {
        setPreloadStatus(`Downloading… ${progress.loaded} of ${progress.total}`);
      });
      setPreloadStatus("All Pokémon images are cached for offline use.");
    } catch (error) {
      console.error("Failed to preload Pokemon images", error);
      setPreloadStatus("Couldn't cache Pokémon images. See console.");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-1 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Guide</h1>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-slate-900">Installing this app</h2>
        <p className="mt-1 text-sm text-slate-600">
          PokeRally is a Progressive Web App (PWA), a website that can be installed like a regular
          app. Installing it adds an icon to your home screen, opens it in its own window without
          browser tabs or an address bar, and lets it keep working without an internet connection,
          once you've{" "}
          <button
            type="button"
            onClick={() => setConfirmingPreload(true)}
            className="font-bold text-blue-600 underline"
          >
            downloaded every Pokémon's artwork
          </button>
          .
        </p>
        {preloadStatus && <p className="mt-1 text-sm text-slate-600">{preloadStatus}</p>}
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

      {confirmingPreload && (
        <PreloadImagesConfirmModal
          onCancel={() => setConfirmingPreload(false)}
          onConfirm={() => void handlePreloadImages()}
        />
      )}
    </main>
  );
}
