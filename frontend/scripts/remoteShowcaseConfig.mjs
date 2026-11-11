export function remoteFrontendConfig(env) {
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITE_") && !["VITE_API_URL", "VITE_DEMO_MODE", "VITE_DEMO_LOCAL_GPS_BYPASS", "VITE_SHOWCASE_REMOTE"].includes(key)) throw new Error("Showcase: variabile VITE non autorizzata; non inserire segreti nel frontend");
  }
  const url = new URL(env.VITE_API_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !url.hostname.includes(".") || /(?:localhost|\.local|\.test|\.invalid)$/.test(url.hostname) || /^\d+(?:\.\d+){3}$/.test(url.hostname)) throw new Error("Showcase: specificare l'origine API HTTPS pubblica, senza percorso o credenziali");
  if (env.VITE_DEMO_LOCAL_GPS_BYPASS && env.VITE_DEMO_LOCAL_GPS_BYPASS !== "false") throw new Error("Showcase: bypass GPS locale vietato");
  return { VITE_API_URL: url.origin, VITE_DEMO_MODE: "true", VITE_DEMO_LOCAL_GPS_BYPASS: "false", VITE_SHOWCASE_REMOTE: "true" };
}
export function securityHeaders(api) {
  return `/*
  X-Robots-Tag: noindex, nofollow, noarchive
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(self), camera=(), microphone=()
  Content-Security-Policy: default-src 'self'; connect-src 'self' ${api}; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
/manifest.webmanifest
  Cache-Control: no-cache
`;
}
