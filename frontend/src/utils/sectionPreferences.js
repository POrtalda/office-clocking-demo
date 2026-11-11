const PREFIX = "office-clocking:sections:v1:";
export async function createSectionScope(user, page, cryptoApi = globalThis.crypto) {
  const account = user?.username || user?.id;
  if (!account || !user?.role || !page || !cryptoApi?.subtle) return null;
  const identity = JSON.stringify([String(account), String(user.role), String(page)]);
  const bytes = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(identity));
  return PREFIX + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function sectionPreferenceKey(scope, sectionId) {
  return scope && sectionId ? `${scope}:${encodeURIComponent(sectionId)}` : null;
}
export function getSectionStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}
export function readSectionPreference(storage, key) {
  if (!storage || !key) return false;
  try {
    const value = storage.getItem(key);
    if (typeof value !== "string" || value.length > 5) return false;
    return JSON.parse(value) === true;
  } catch { return false; }
}
export function writeSectionPreference(storage, key, open) {
  if (!storage || !key || typeof open !== "boolean") return;
  try { storage.setItem(key, JSON.stringify(open)); } catch { /* Storage denied/full: the UI remains usable in memory. */ }
}
export function revealSection(section) {
  const button = section?.querySelector(":scope > .collapsible-section-heading > button");
  if (button?.getAttribute("aria-expanded") === "false") button.click();
}
