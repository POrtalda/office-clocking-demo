// Isolated UI fixture server: no backend, MongoDB, SMTP or write operations.
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const users = [
  { _id: "ui-a", username: "Dipendente A", fullName: "Profilo fittizio A", role: "user", isActive: true },
  { _id: "ui-b", username: "Dipendente B", fullName: "Profilo fittizio B", role: "user", isActive: true },
  { _id: "ui-admin", username: "Admin UI", role: "admin", isActive: true },
];
const fixture = { name: "readonly-ui-fixtures", configureServer(server) {
  server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith("/tests/visual-check/api/")) return next();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method !== "GET") { res.statusCode = 405; return res.end(JSON.stringify({ message: "Anteprima UI: operazioni di scrittura disabilitate" })); }
    const url = new URL(req.url, "http://127.0.0.1:5176");
    const record = { _id: "ui-record", clockIn: new Date(Date.now() - 600000).toISOString(), clockOut: null, status: "open", breaks: [], durationSec: 0 };
    let data = { records: [], leaves: [], requests: [], rows: [], total: 0, totalSec: 0 };
    if (url.pathname.endsWith("/admin/users")) data = { users };
    else if (url.pathname.endsWith("/records/my-open")) data = { record, isFromPreviousDay: false, canRequestManualClosure: false };
    else if (url.pathname.endsWith("/records/my")) data = { records: [record] };
    else if (url.pathname.endsWith("/settings")) data = { settings: { leaveMinAdvanceDays: 2, leaveNotificationEmails: [] } };
    else if (url.pathname.endsWith("/daily-attendance")) data = { date: url.searchParams.get("date"), timezone: "Europe/Rome", isToday: true, checkedAt: new Date().toISOString(), checkReached: false, counts: { total: 2, entered: 1, missing: 1, absent: 0 }, entered: [{ userId: "ui-a", username: "Dipendente A", firstClockIn: record.clockIn }], missing: [{ userId: "ui-b", username: "Dipendente B" }], absent: [] };
    res.end(JSON.stringify(data));
  });
} };
const server = await createServer({ root, mode: "demo-local", define: { "import.meta.env.VITE_API_URL": JSON.stringify("/tests/visual-check") }, plugins: [fixture], server: { host: "127.0.0.1", port: 5176, strictPort: true } });
await server.listen();
console.log("Collaudo UI isolato: http://127.0.0.1:5176/tests/visual-check/index.html — nessuna connessione DB/SMTP");
