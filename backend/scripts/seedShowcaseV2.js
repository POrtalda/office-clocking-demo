const FIRST_DAY = "2026-08-17";
const LAST_DAY = "2026-11-12";
const DATABASE = "office_clocking_showcase_v2";

const workers = [
  ["mario", "Mario Rossi"],
  ["luca", "Luca Bianchi"],
  ["giulia", "Giulia Verdi"],
  ["anna", "Anna Neri"],
  ["ale", "Alessandro Costa"],
  ["sara", "Sara Gallo"],
  ["marco", "Marco Ferrero"],
  ["elena", "Elena Ricci"],
  ["davide", "Davide Bruno"],
  ["chiara", "Chiara Moretti"],
  ["andrea", "Andrea Riva"],
  ["silvia", "Silvia Romano"],
  ["paolo_demo", "Paolo Greco"],
  ["francesca", "Francesca Serra"],
  ["matteo", "Matteo Conti"],
];

const approvedLeaves = [
  ["mario", "2026-09-14", "ferie", null],
  ["giulia", "2026-10-06", "mutua", null],
  ["sara", "2026-09-28", "ferie", null],
  ["marco", "2026-11-09", "ferie", null],
  ["elena", "2026-10-21", "pir", 8],
  ["matteo", "2026-09-03", "mutua", null],
];

const otherLeaves = [
  ["luca", "2026-11-18", "ferie", "pending", null],
  ["anna", "2026-11-19", "pir", "pending", 3],
  ["davide", "2026-10-15", "pir", "rejected", 2],
];

function formatTime(minutes) {
  return String(Math.floor(minutes / 60)).padStart(2, "0")
    + ":" + String(minutes % 60).padStart(2, "0");
}

function buildPlan() {
  const records = [];
  const leaves = [];
  const approved = new Set();

  for (const [username, date, type, hours] of approvedLeaves) {
    approved.add(username + "|" + date);
    leaves.push({
      username, date, type, hours,
      status: "approved",
      note: "Assenza dimostrativa",
    });
  }

  for (const [username, date, type, status, hours] of otherLeaves) {
    leaves.push({
      username, date, type, status, hours,
      note: "Richiesta dimostrativa",
    });
  }

  const startDate = new Date(FIRST_DAY + "T12:00:00Z");
  const endDate = new Date(LAST_DAY + "T12:00:00Z");

  for (
    let date = new Date(startDate), dayIndex = 0;
    date <= endDate;
    date.setUTCDate(date.getUTCDate() + 1), dayIndex++
  ) {
    const weekday = date.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const dateString = date.toISOString().slice(0, 10);

    workers.forEach(([username], index) => {
      if (approved.has(username + "|" + dateString)) return;

      const partTime = username === "anna";
      const late = (index * 7 + dayIndex) % 19 === 0;
      const overtime =
        !partTime && (index + dayIndex * 3) % 23 === 0;

      const start =
        (partTime ? 540 : 525)
        + ((index + dayIndex) % 5) * 3
        + (late ? 22 : 0);

      const finish =
        start + (partTime ? 240 : 480)
        + (overtime ? 40 : 0);

      records.push({
        username,
        date: dateString,
        inTime: formatTime(start),
        outTime: formatTime(finish),
        kind: "closed",
      });
    });
  }

  const anomaly = records.find(
    r => r.username === "luca" && r.date === "2026-11-09"
  );
  if (anomaly) anomaly.kind = "pending_manual_closure";

  return { records, leaves };
}

function validateLocalUri(uri) {
  if (!uri) throw new Error("MONGO_URI mancante");

  const url = new URL(uri);

  if (
    url.protocol !== "mongodb:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    (url.port && url.port !== "27017") ||
    url.pathname !== "/" + DATABASE ||
    url.username || url.password ||
    url.search || url.hash
  ) {
    throw new Error("Consentito solo MongoDB locale showcase");
  }
}

async function apply(plan) {
  if (process.env.DEMO_MODE !== "true") {
    throw new Error("DEMO_MODE deve essere true");
  }

  validateLocalUri(process.env.MONGO_URI);

  const mongoose = require("mongoose");
  const bcrypt = require("bcryptjs");
  const User = require("../models/User");
  const TimeRecord = require("../models/TimeRecord");
  const { calculateWorkDuration } = require("../utils/workDuration");
  const LeaveRequest = require("../models/LeaveRequest");
  const { parseAppDateTimeToDate } = require("../utils/dateTime");

  const toDate = (date, time) => {
    const value = parseAppDateTimeToDate(date, time);
    if (!value) throw new Error("Data non valida: " + date + " " + time);
    return value;
  };

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    if (mongoose.connection.name !== DATABASE) {
      throw new Error("Database non autorizzato");
    }

    const counts = await Promise.all([
      User.countDocuments(),
      TimeRecord.countDocuments(),
      LeaveRequest.countDocuments(),
    ]);

    if (counts.some(count => count !== 0)) {
      throw new Error("Database non vuoto: operazione bloccata");
    }

    const password = await bcrypt.hash("1234", 10);

    const users = await User.insertMany([
      {
        username: "admin",
        fullName: "Amministratore Demo",
        role: "admin",
        password,
        isActive: true,
        geolocationEnabled: false,
      },
      ...workers.map(([username, fullName]) => ({
        username,
        fullName,
        role: "user",
        password,
        isActive: true,
        geolocationEnabled: false,
      })),
    ]);

    const ids = Object.fromEntries(
      users.map(user => [user.username, user._id])
    );


  function buildShowcaseBreaks(record, clockIn, clockOut) {
    const totalMinutes = (clockOut - clockIn) / 60000;

    // Le giornate brevi rimangono generalmente continuative.
    if (totalMinutes < 360) return [];

    // Distribuzione ripetibile, senza casualit? a ogni esecuzione.
    const key = record.username + record.date;
    const hash = [...key].reduce(
      (sum, char) => sum * 31 + char.charCodeAt(0), 0
    ) >>> 0;

    const choice = hash % 20;

    // Circa il 15% delle giornate lunghe senza pausa.
    if (choice < 3) return [];

    const minutes = choice < 14 ? 30 : choice < 18 ? 60 : 15;

    // Preferiamo una pausa intorno alle 12:30.
    const preferredStart = toDate(record.date, "12:30");
    const minStart = clockIn.getTime() + 120 * 60000;
    const maxStart = clockOut.getTime() - (minutes + 90) * 60000;

    if (maxStart < minStart) return [];

    const startMs = Math.min(
      maxStart,
      Math.max(minStart, preferredStart.getTime())
    );

    return [{
      startAt: new Date(startMs),
      endAt: new Date(startMs + minutes * 60000),
      startMode: "office",
      endMode: "office",
    }];
  }

  const records = plan.records.map(record => {
      const clockIn = toDate(record.date, record.inTime);
      const clockOut = toDate(record.date, record.outTime);
      const breaks = buildShowcaseBreaks(record, clockIn, clockOut);

      if (record.kind === "pending_manual_closure") {
        return {
          user: ids[record.username],
          clockIn,
          clockOut: null,
          durationSec: 0,
          breaks,
          status: "pending_manual_closure",
          manualClosureRequest: {
            proposedClockOut: clockOut,
            note: "Uscita dimenticata (demo)",
            requestedAt: clockOut,
          },
        };
      }

      return {
        user: ids[record.username],
        clockIn,
        clockOut,
        breaks,
        durationSec: calculateWorkDuration({ clockIn, breaks }, clockOut).durationSec,
        status: "closed",
      };
    });

    await TimeRecord.insertMany(records);

    await LeaveRequest.insertMany(
      plan.leaves.map(leave => ({
        user: ids[leave.username],
        date: toDate(leave.date, "00:00"),
        type: leave.type,
        status: leave.status,
        hours: leave.hours ?? null,
        note: leave.note,
        reviewedBy: leave.status === "pending" ? null : ids.admin,
        reviewedAt: leave.status === "pending"
          ? null
          : toDate("2026-11-10", "09:00"),
      }))
    );

    console.log("Popolamento completato nel database locale.");
    console.log("Utenti:", users.length);
    console.log("Timbrature:", records.length);
    console.log("Assenze:", plan.leaves.length);
  } finally {
    await mongoose.disconnect();
  }
}

const plan = buildPlan();

console.log("ANTEPRIMA SHOWCASE");
console.log("Utenti:", workers.length + 1);
console.log("Timbrature:", plan.records.length);
console.log("Assenze:", plan.leaves.length);
console.log("Periodo:", FIRST_DAY, "-", LAST_DAY);

if (process.argv.includes("--apply")) {
  if (!process.argv.includes("--confirm-local-showcase")) {
    console.error("Conferma locale mancante");
    process.exitCode = 1;
  } else {
    apply(plan).catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
} else {
  console.log("Solo anteprima: nessun database modificato.");
}
