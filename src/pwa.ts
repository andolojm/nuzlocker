import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

/**
 * Forces the browser to re-fetch the service worker script from the server. If it has
 * changed, the new version installs and activates, which triggers an automatic reload
 * (registerType: 'autoUpdate' in vite.config.ts). Returns whether a check was possible.
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  await registration.update();
  return true;
}
