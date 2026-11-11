// Use normalized API durations: breaks have already been subtracted by the backend.
export function getClosedWorkSummary(records = []) {
  return records.reduce((summary, record) => {
    if (!record.clockOut || String(record.status || "").toLowerCase() === "cancelled") return summary;
    const durationSec = Number(record.durationSec);
    const breakSec = Number(record.breakSec);
    summary.durationSec += Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
    summary.breakSec += Number.isFinite(breakSec) ? Math.max(0, breakSec) : 0;
    return summary;
  }, { durationSec: 0, breakSec: 0 });
}
