import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
test("actual clock is non-collapsible, shows Rome date/time and does not announce every tick", async () => {
  const server = await createServer({ mode: "demo-local", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const { default: Clock } = await server.ssrLoadModule("/src/components/OfficeClock/OfficeClock.jsx");
    for (const [date, expectedTime, expectedDay] of [["2026-01-14T23:30:45Z","00:30:45","15 gennaio 2026"],["2026-07-14T22:30:15Z","00:30:15","15 luglio 2026"]]) {
      const html = renderToStaticMarkup(React.createElement(Clock, { now: new Date(date), status: { title: "Pausa in corso", description: "Pausa", tone: "warning" } }));
      assert.ok(html.includes(`aria-label="${expectedTime}"`)); assert.ok(html.includes(expectedDay));
      assert.ok(html.includes("Pausa in corso")); assert.ok(html.includes("EUROPE/ROME"));
      assert.ok(!html.includes("<details")); assert.ok(!html.includes("aria-expanded"));
      assert.ok(!/<time[^>]*aria-live/.test(html));
    }
  } finally { await server.close(); }
});
