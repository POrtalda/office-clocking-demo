// Cosmetic preferences only. No token, role or authorization is read or changed.
const PREFIX = "office-clocking:theme:v1:";
const session = new Map();
export function themeAccount(user) {
  const account = user?.username || user?.id || user?._id;
  return typeof account === "string" && account.length > 0 ? account : null;
}
export function themeStorage() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
export async function themePreferenceKey(user, cryptoApi = globalThis.crypto) {
  const account = themeAccount(user);
  if (!account || !cryptoApi?.subtle) return null;
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(["theme", account]));
    const hash = await cryptoApi.subtle.digest("SHA-256", bytes);
    return PREFIX + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}
export function readTheme(storage, key) {
  try {
    const raw = key ? storage?.getItem(key) : null;
    return raw === '"dark"' ? "dark" : "light";
  } catch { return "light"; }
}
export function saveTheme(storage, key, theme) {
  if (!key || !["light", "dark"].includes(theme)) return;
  try { storage?.setItem(key, JSON.stringify(theme)); } catch { /* Session preference still works. */ }
}
export function cachedTheme(user) { return session.get(themeAccount(user)); }
export async function loadAccountTheme(user) {
  const account = themeAccount(user);
  if (!account) return { key: null, theme: "light" };
  if (session.has(account)) return session.get(account);
  const key = await themePreferenceKey(user);
  // A newer choice made while hashing must win.
  if (!session.has(account)) session.set(account, { key, theme: readTheme(themeStorage(), key) });
  return session.get(account);
}
export function rememberTheme(user, entry) {
  const account = themeAccount(user);
  if (account) { session.set(account, entry); saveTheme(themeStorage(), entry.key, entry.theme); }
}
export function applyTheme(theme, documentApi = globalThis.document) {
  if (!documentApi?.documentElement) return;
  const safeTheme = theme === "dark" ? "dark" : "light";
  documentApi.documentElement.dataset.officeTheme = safeTheme;
  documentApi.documentElement.style.colorScheme = safeTheme;
}
export async function prepareInitialTheme(user) {
  // authUser is used solely for paint; AuthProvider still validates the session.
  if (user === undefined) {
    try { user = JSON.parse(themeStorage()?.getItem("authUser") || "null"); } catch { user = null; }
  }
  const entry = await loadAccountTheme(user);
  applyTheme(entry.theme);
}
