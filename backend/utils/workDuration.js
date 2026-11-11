/** Calculate paid work time, excluding only completed/elapsed break intervals. */
function durationSeconds(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Number.isFinite(a) && Number.isFinite(b) ? Math.max(0, Math.floor((b - a) / 1000)) : 0;
}

function calculateWorkDuration(record, end = record?.clockOut) {
  if (!record?.clockIn || !end) return { durationSec: 0, breakSec: 0, beforeBreakSec: 0, afterBreakSec: 0 };
  const startMs = new Date(record.clockIn).getTime();
  const endMs = new Date(end).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new Error('Intervallo di lavoro incoerente');
  }
  const intervals = (record.breaks || []).map(b => ({
    start: new Date(b.startAt).getTime(),
    end: b.endAt ? new Date(b.endAt).getTime() : endMs,
  })).sort((a,b) => a.start-b.start);
  let previousEnd = startMs;
  let breakMs = 0;
  let firstBreakAt = null;
  let firstResumeAt = null;
  for (const interval of intervals) {
    if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) ||
        interval.start < startMs || interval.end < interval.start || interval.end > endMs ||
        interval.start < previousEnd) {
      throw new Error('Intervalli di pausa incoerenti');
    }
    if (firstBreakAt === null) { firstBreakAt = interval.start; firstResumeAt = interval.end; }
    breakMs += interval.end - interval.start;
    previousEnd = interval.end;
  }
  const durationSec = Math.max(0, Math.floor((endMs - startMs - breakMs) / 1000));
  const beforeBreakSec = firstBreakAt === null ? durationSec : Math.floor((firstBreakAt - startMs) / 1000);
  const afterBreakSec = firstResumeAt === null ? 0 : Math.max(0, Math.floor((endMs - firstResumeAt - (breakMs - (firstResumeAt-firstBreakAt))) / 1000));
  return { durationSec, breakSec: Math.floor(breakMs / 1000), beforeBreakSec, afterBreakSec };
}
// Normalize responses only: historical documents are never rewritten.
function withWorkDuration(source) {
  const record = source.toObject ? source.toObject() : { ...source };
  const cancelled = record.status === 'cancelled';
  const elapsedBreaks = (record.breaks || []).filter(b => b.startAt && b.endAt);
  const breakSec = Math.floor(elapsedBreaks.reduce((total, b) =>
    total + Math.max(0, new Date(b.endAt) - new Date(b.startAt)), 0) / 1000);
  let durationSec = 0;
  if (!cancelled && record.clockOut) {
    durationSec = (record.breaks || []).length || !Number.isFinite(record.durationSec) || record.durationSec < 0
      ? calculateWorkDuration(record).durationSec
      : Math.max(0, record.durationSec);
  }
  return { ...record, durationSec, breakSec };
}
module.exports = { durationSeconds, calculateWorkDuration, withWorkDuration };
