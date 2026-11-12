import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { createServer } from "vite";
import { getOffsiteClockPayload } from "../src/utils/localDemoGps.js";
import { toRomeInputDateTime } from "../src/utils/dateUtils.js";

test("offsite payload is explicit, motivated and distinct from demo GPS omission", () => {
  assert.deepEqual(getOffsiteClockPayload("  Cliente  "), { workLocation: "offsite", offsiteReason: "Cliente" });
  for (const reason of [undefined, "", " ", 123, "x".repeat(501)]) assert.throws(() => getOffsiteClockPayload(reason));
  assert.equal("location" in getOffsiteClockPayload("Cliente"), false);
  assert.equal("demoWithoutGps" in getOffsiteClockPayload("Cliente"), false);
});
test("admin datetime inputs preserve Rome local date and seconds in summer and winter", () => {
  assert.equal(toRomeInputDateTime("2026-07-14T22:30:45Z"), "2026-07-15T00:30:45");
  assert.equal(toRomeInputDateTime("2026-01-14T23:30:15Z"), "2026-01-15T00:30:15");
});
test("actual User sections, Admin loading state, attendance/correction controls and audit render accessibly (SSR only)", async () => {
  const server = await createServer({ mode: "demo-local", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  const previousWindow = globalThis.window;
  try {
    globalThis.window = { location: { hostname: "127.0.0.1" } };
    const { default: CollapsibleSection } = await server.ssrLoadModule("/src/components/CollapsibleSection/CollapsibleSection.jsx");
    const closed = renderToStaticMarkup(React.createElement(CollapsibleSection, { title: "Riepilogo" }, "Contenuto conservato"));
    assert.ok(closed.includes('aria-expanded="false"')); assert.ok(closed.includes('role="heading"')); assert.ok(closed.includes('aria-hidden="true"'));
    assert.ok(closed.includes("Contenuto conservato")); assert.ok(closed.includes('hidden=""'));
    const { default: Details } = await server.ssrLoadModule("/src/components/TimeRecordDetails/TimeRecordDetails.jsx");
    const audit = renderToStaticMarkup(React.createElement(Details, { record: { clockInMode: "offsite", clockInOffsiteReason: "Cliente", adminEditHistory: [{ reason: "Correzione concordata", editedAt: "2026-11-11T12:00:00Z", previousClockIn: "2026-11-11T07:00:00Z", previousClockOut: "2026-11-11T16:00:00Z", newClockIn: "2026-11-11T07:30:00Z", newClockOut: "2026-11-11T16:30:00Z" }] } }));
    assert.ok(audit.includes("Entrata fuori sede")); assert.ok(audit.includes("Cliente")); assert.ok(audit.includes("Correzione concordata"));
    const { default: Editor } = await server.ssrLoadModule("/src/components/Home-admin/AdminRecordEditor.jsx");
    const edit = renderToStaticMarkup(React.createElement(Editor, { record: { status: "closed", clockIn: "2026-11-11T07:00:00Z", clockOut: "2026-11-11T16:00:00Z" } }));
    assert.equal(renderToStaticMarkup(React.createElement(Editor, { readOnly:true, record:{status:"closed",clockIn:"2026-11-11T07:00:00Z",clockOut:"2026-11-11T16:00:00Z"} })), "");
    assert.ok(edit.includes("Correggi")); assert.ok(edit.includes('aria-expanded="false"'));
    assert.equal(renderToStaticMarkup(React.createElement(Editor, { record: { status: "cancelled" } })), "");
    const { default: Attendance } = await server.ssrLoadModule("/src/components/Home-admin/AdminDailyAttendance.jsx");
    const attendance = renderToStaticMarkup(React.createElement(Attendance, { baseUrl: "http://127.0.0.1:5055" }));
    assert.ok(attendance.includes("Presenze giornaliere")); assert.ok(attendance.includes('id="attendance-date"')); assert.ok(attendance.includes("Europe/Rome"));
    const { AuthContext } = await server.ssrLoadModule("/src/context/auth-context.js");
    for (const [file, role, labels] of [
      ["Home-user/Home-user", "user", ["Richiedi assenza", "Modalità della prossima entrata/uscita", "Fuori sede"]],
      ["Home-admin/Home-admin", "admin", ["Caricamento utenti in corso..."]],
    ]) {
      const { default: Page } = await server.ssrLoadModule(`/src/components/${file}.jsx`);
      const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AuthContext.Provider, { value: { user: { username: "demo", role }, logout() {}, handleSessionExpired() {} } }, React.createElement(Page))));
      for (const label of labels) assert.ok(html.includes(label), `${role}: missing ${label}`);
      if (role === "user") assert.ok(html.includes("collapsible-section-arrow"));
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    await server.close();
  }
});
