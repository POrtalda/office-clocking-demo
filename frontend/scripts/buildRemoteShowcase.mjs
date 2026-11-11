import { build } from "vite";
import { writeFile, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { remoteFrontendConfig, securityHeaders } from "./remoteShowcaseConfig.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const flags = remoteFrontendConfig(process.env);
Object.assign(process.env, flags);
// No local .env file may influence this isolated production build.
await build({ root, mode: "showcase-remote", envDir: false, build: { outDir: "dist-showcase", emptyOutDir: true, sourcemap: false }, define: Object.fromEntries(Object.entries(flags).map(([key,value]) => [`import.meta.env.${key}`, JSON.stringify(value)])) });
const output = path.join(root, "dist-showcase");
await writeFile(path.join(output,"_headers"), securityHeaders(flags.VITE_API_URL));
await writeFile(path.join(output,"_redirects"), "/api/* /404.html 404\n/* /index.html 200\n");
await writeFile(path.join(output,"404.html"), "API disponibili esclusivamente sull'origine backend Showcase.");
await writeFile(path.join(output,"robots.txt"), "User-agent: *\nDisallow: /\n");
for (const name of await readdir(path.join(output,"assets"))) {
  if (!name.endsWith(".js")) continue;
  const source = await readFile(path.join(output,"assets",name),"utf8");
  if (/password:\s*["']1234["']|localhost:5055|127\.0\.0\.1:5055|BEGIN PRIVATE KEY/.test(source)) throw new Error("Build Showcase rifiutata: riferimento locale o credenziale dimostrativa semplice");
}
console.log("Build Showcase HTTPS pronta in dist-showcase; nessuna pubblicazione eseguita.");
