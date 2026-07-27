export function formatDateIT(dateValue) {
  if (!dateValue) return "-";

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateValue));
}

export function formatTimeIT(dateValue) {
  if (!dateValue) return "-";

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(dateValue));
}

export function formatDateTimeIT(dateValue) {
  if (!dateValue) return "-";

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(dateValue));
}

export function formatDayLabelIT(dateValue) {
  if (!dateValue) return "-";

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateValue));
}

export function formatDuration(totalSec) {
  const sec = Number(totalSec || 0);

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  return `${h}h ${m}m ${s}s`;
}

export function toRomeYMD(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
  }).format(date);

  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    month: "2-digit",
  }).format(date);

  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    day: "2-digit",
  }).format(date);

  return `${year}-${month}-${day}`;
}

export function getRomeMonthRange(dateValue) {
  if (!dateValue) {
    return { from: "", to: "" };
  }

  const date = new Date(dateValue);

  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
  }).format(date);

  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    month: "2-digit",
  }).format(date);

  const monthIndex = Number(month) - 1;
  const lastDay = new Date(Number(year), monthIndex + 1, 0).getDate();

  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}