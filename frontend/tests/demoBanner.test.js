import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("actual demo banner renders the local demo label and accessible status", async () => {
  const server = await createServer({ mode: "demo-local", envDir: false, define: { "import.meta.env.VITE_DEMO_MODE": JSON.stringify("true"), "import.meta.env.VITE_DEMO_LOCAL_GPS_BYPASS": JSON.stringify("true"), "import.meta.env.VITE_API_URL": JSON.stringify("http://127.0.0.1:5055") }, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const previousWindow = globalThis.window;
  try {
    // Component unit test only: this is server rendering, not browser validation.
    globalThis.window = { location: { hostname: "127.0.0.1" } };
    const { default: DemoBanner } = await server.ssrLoadModule("/src/components/DemoBanner/DemoBanner.jsx");
    const html = renderToStaticMarkup(React.createElement(DemoBanner));
    assert.ok(html.includes("Modalità Demo locale"));
    assert.ok(html.includes('role="status"'));
    assert.ok(html.includes('aria-label="Modalità demo"'));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    await server.close();
  }
});
