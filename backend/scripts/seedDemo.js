/**
 * scripts/seedDemo.js
 *
 * Popola il database demo con utenti, timbrature e assenze dimostrative.
 *
 * Uso:
 * npm run seed:demo
 */

require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const TimeRecord = require("../models/TimeRecord");
const LeaveRequest = require("../models/LeaveRequest");

const {
  dayjs,
  APP_TZ,
  parseAppDateTimeToDate,
} = require("../utils/dateTime");

const DEMO_PASSWORD = "1234";

const demoUsers = [
  {
    username: "admin",
    password: DEMO_PASSWORD,
    role: "admin",
    fullName: "Amministratore Demo",
    email: "admin.demo@example.com",
    isActive: true,
  },
  {
    username: "mario",
    password: DEMO_PASSWORD,
    role: "user",
    fullName: "Mario Rossi",
    email: "mario.rossi@example.com",
    isActive: true,
  },
  {
    username: "luca",
    password: DEMO_PASSWORD,
    role: "user",
    fullName: "Luca Bianchi",
    email: "luca.bianchi@example.com",
    isActive: true,
  },
  {
    username: "giulia",
    password: DEMO_PASSWORD,
    role: "user",
    fullName: "Giulia Verdi",
    email: "giulia.verdi@example.com",
    isActive: true,
  },
  {
    username: "anna",
    password: DEMO_PASSWORD,
    role: "user",
    fullName: "Anna Neri",
    email: "anna.neri@example.com",
    isActive: true,
  },
  {
    username: "ale",
    password: DEMO_PASSWORD,
    role: "user",
    fullName: "Alessandro Costa",
    email: "alessandro.costa@example.com",
    isActive: true,
  },
];

function getDemoDate(daysAgo) {
  return dayjs().tz(APP_TZ).subtract(daysAgo, "day").format("YYYY-MM-DD");
}

function buildClosedRecord(userId, daysAgo, clockInTime, clockOutTime) {
  const dateStr = getDemoDate(daysAgo);
  const clockIn = parseAppDateTimeToDate(dateStr, clockInTime);
  const clockOut = parseAppDateTimeToDate(dateStr, clockOutTime);

  if (!clockIn || !clockOut) {
    throw new Error(
      `Timbratura demo non valida: ${dateStr} ${clockInTime}-${clockOutTime}`
    );
  }

  const durationSec = Math.floor((clockOut.getTime() - clockIn.getTime()) / 1000);

  return {
    user: userId,
    clockIn,
    clockOut,
    durationSec,
    status: "closed",
  };
}

function buildOpenRecord(userId, daysAgo, clockInTime) {
  const dateStr = getDemoDate(daysAgo);
  const clockIn = parseAppDateTimeToDate(dateStr, clockInTime);

  if (!clockIn) {
    throw new Error(
      `Timbratura aperta demo non valida: ${dateStr} ${clockInTime}`
    );
  }

  return {
    user: userId,
    clockIn,
    clockOut: null,
    durationSec: 0,
    status: "open",
  };
}

function buildPendingManualClosureRecord(
  userId,
  daysAgo,
  clockInTime,
  proposedClockOutTime,
  note
) {
  const dateStr = getDemoDate(daysAgo);
  const clockIn = parseAppDateTimeToDate(dateStr, clockInTime);
  const proposedClockOut = parseAppDateTimeToDate(dateStr, proposedClockOutTime);

  if (!clockIn || !proposedClockOut) {
    throw new Error(
      `Richiesta chiusura manuale demo non valida: ${dateStr} ${clockInTime}-${proposedClockOutTime}`
    );
  }

  return {
    user: userId,
    clockIn,
    clockOut: null,
    durationSec: 0,
    status: "pending_manual_closure",
    manualClosureRequest: {
      proposedClockOut,
      note,
      requestedAt: dayjs().tz(APP_TZ).subtract(1, "hour").toDate(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: "",
    },
  };
}

function buildLeave(
  userId,
  adminId,
  daysAgo,
  type,
  status,
  hours,
  note,
  reviewNote = ""
) {
  const dateStr = getDemoDate(daysAgo);
  const date = parseAppDateTimeToDate(dateStr, "00:00");

  if (!date) {
    throw new Error(`Assenza demo non valida: ${dateStr} ${type}`);
  }

  const isReviewed = status === "approved" || status === "rejected";

  return {
    user: userId,
    type,
    status,
    date,
    hours,
    note,
    reviewedBy: isReviewed ? adminId : null,
    reviewedAt: isReviewed
      ? dayjs().tz(APP_TZ).subtract(2, "day").toDate()
      : null,
    reviewNote,
  };
}

function buildDemoRecords(usersByUsername) {
  const mario = usersByUsername.mario._id;
  const luca = usersByUsername.luca._id;
  const giulia = usersByUsername.giulia._id;
  const anna = usersByUsername.anna._id;
  const ale = usersByUsername.ale._id;

  return [
    // Mario: profilo regolare con un piccolo ritardo
    buildClosedRecord(mario, 1, "08:55", "17:05"),
    buildClosedRecord(mario, 2, "09:18", "17:10"),
    buildClosedRecord(mario, 3, "08:50", "16:55"),
    buildClosedRecord(mario, 4, "09:02", "17:00"),
    buildClosedRecord(mario, 5, "08:47", "16:50"),

    // Luca: una richiesta di chiusura manuale pendente
    buildClosedRecord(luca, 1, "08:40", "16:45"),
    buildPendingManualClosureRecord(
      luca,
      2,
      "08:52",
      "17:04",
      "Ho dimenticato di timbrare l'uscita a fine turno."
    ),
    buildClosedRecord(luca, 3, "09:31", "17:30"),
    buildClosedRecord(luca, 4, "08:58", "17:02"),

    // Giulia: regolare e precisa
    buildClosedRecord(giulia, 1, "08:45", "16:45"),
    buildClosedRecord(giulia, 2, "08:49", "16:50"),
    buildClosedRecord(giulia, 3, "08:43", "16:47"),
    buildClosedRecord(giulia, 4, "08:46", "16:52"),

    // Anna: part-time
    buildClosedRecord(anna, 1, "09:00", "13:00"),
    buildClosedRecord(anna, 2, "09:05", "13:10"),
    buildClosedRecord(anna, 3, "09:12", "13:00"),
    buildClosedRecord(anna, 4, "09:00", "12:55"),

    // Alessandro: giornata mista con un ritardo e una presenza completa
    buildClosedRecord(ale, 1, "09:24", "17:35"),
    buildClosedRecord(ale, 2, "08:57", "17:01"),
    buildClosedRecord(ale, 3, "09:08", "17:12"),
    buildClosedRecord(ale, 4, "08:51", "16:58"),

    // Record aperto/anomalo di ieri, utile per mostrare alert admin
    buildOpenRecord(anna, 1, "14:00"),
  ];
}

function buildDemoLeaves(usersByUsername) {
  const admin = usersByUsername.admin._id;
  const mario = usersByUsername.mario._id;
  const luca = usersByUsername.luca._id;
  const giulia = usersByUsername.giulia._id;
  const anna = usersByUsername.anna._id;
  const ale = usersByUsername.ale._id;

  return [
    // Mario: ferie approvate
    buildLeave(
      mario,
      admin,
      6,
      "ferie",
      "approved",
      null,
      "Giornata di ferie programmata",
      "Ferie approvate"
    ),

    // Luca: PIR approvato
    buildLeave(
      luca,
      admin,
      1,
      "pir",
      "approved",
      2,
      "Permesso personale di 2 ore",
      "Permesso approvato"
    ),

    // Luca: ferie future in attesa di approvazione
    buildLeave(
      luca,
      admin,
      -3,
      "ferie",
      "pending",
      null,
      "Richiesta ferie per impegno familiare"
    ),

    // Giulia: mutua approvata in un giorno senza timbrature
    buildLeave(
      giulia,
      admin,
      5,
      "mutua",
      "approved",
      null,
      "Febbre e visita medica",
      "Mutua registrata"
    ),

    // Anna: PIR respinto
    buildLeave(
      anna,
      admin,
      3,
      "pir",
      "rejected",
      3,
      "Permesso richiesto per appuntamento personale",
      "Permesso respinto per copertura turno insufficiente"
    ),

    // Alessandro: richiesta PIR futura in attesa
    buildLeave(
      ale,
      admin,
      -2,
      "pir",
      "pending",
      4,
      "Richiesta permesso per visita specialistica"
    ),
  ];
}

async function seedDemo() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI mancante nel file .env");
  }

  console.log("Connessione a MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  console.log("Pulizia utenti demo esistenti...");
  await User.deleteMany({
    username: {
      $in: demoUsers.map((user) => user.username),
    },
  });

  console.log("Pulizia timbrature demo esistenti...");
  await TimeRecord.deleteMany({});

  console.log("Pulizia assenze demo esistenti...");
  await LeaveRequest.deleteMany({});

  console.log("Creazione utenti demo...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const usersToCreate = demoUsers.map((user) => ({
    ...user,
    password: passwordHash,
  }));

  const createdUsers = await User.insertMany(usersToCreate);

  const usersByUsername = Object.fromEntries(
    createdUsers.map((user) => [user.username, user])
  );

  console.log("Creazione timbrature demo...");
  const demoRecords = buildDemoRecords(usersByUsername);
  await TimeRecord.insertMany(demoRecords);

  console.log("Creazione assenze demo...");
  const demoLeaves = buildDemoLeaves(usersByUsername);
  await LeaveRequest.insertMany(demoLeaves);

  console.log("Seed demo completato.");
  console.log("");
  console.log(`Utenti creati: ${createdUsers.length}`);
  console.log(`Timbrature create: ${demoRecords.length}`);
  console.log(`Assenze create: ${demoLeaves.length}`);
  console.log("");
  console.log("Credenziali demo:");
  console.log("admin / 1234");
  console.log("mario / 1234");
  console.log("luca / 1234");
  console.log("giulia / 1234");
  console.log("anna / 1234");
  console.log("ale / 1234");
}

seedDemo()
  .catch((error) => {
    console.error("Errore durante il seed demo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });