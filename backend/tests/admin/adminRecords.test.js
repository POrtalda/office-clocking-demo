const request = require("supertest");

// Mock del model TimeRecord.
// Intercettiamo la find() usata dal controller.
jest.mock("../../models/TimeRecord", () => ({
  find: jest.fn(),
}));

// Mock del model User.
// In questo test ci serve soprattutto findOne().
jest.mock("../../models/User", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

// Mock parziale delle utility data.
// Manteniamo tutto il resto reale e forziamo getDayRangeInAppTz
// per avere un intervallo fisso e prevedibile nei test.
jest.mock("../../utils/dateTime", () => {
  const actual = jest.requireActual("../../utils/dateTime");
  return {
    ...actual,
    getDayRangeInAppTz: jest.fn(),
  };
});

// Mock di jsonwebtoken per simulare un admin autenticato.
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

// Import dell'app Express reale e dei moduli mockati.
const app = require("../../app");
const User = require("../../models/User");
const TimeRecord = require("../../models/TimeRecord");
const jwt = require("jsonwebtoken");
const { getDayRangeInAppTz } = require("../../utils/dateTime");

describe("GET /api/admin/records", () => {
  beforeEach(() => {
    // Pulizia totale dei mock prima di ogni test.
    jest.clearAllMocks();

    // Simuliamo sempre un token admin valido.
    jwt.verify.mockReturnValue({
      id: "admin-user-id",
      username: "admin",
      role: "admin",
    });

    // Range giornaliero fisso, così il test non dipende dalla logica reale.
    getDayRangeInAppTz.mockReturnValue({
      start: new Date("2026-03-15T00:00:00.000Z"),
      nextDayStart: new Date("2026-03-16T00:00:00.000Z"),
    });
  });

  it("restituisce 400 se mancano username o date", async () => {
    const response = await request(app)
      .get("/api/admin/records")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Parametri richiesti: username e date");

    // Se i parametri sono assenti, il controller non deve interrogare il DB.
    expect(User.findOne).not.toHaveBeenCalled();
    expect(TimeRecord.find).not.toHaveBeenCalled();
  });

  it("restituisce 404 se l'utente non esiste", async () => {
    // Simuliamo utente non trovato.
    User.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const response = await request(app)
      .get("/api/admin/records?username=mario&date=2026-03-15")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Utente non trovato");

    expect(User.findOne).toHaveBeenCalledWith({
      username: "mario",
    });
  });

  it("restituisce 200 con dettaglio vuoto se non esistono record", async () => {
    // Simuliamo un utente valido.
    User.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "user-mario",
        username: "mario",
        role: "user",
      }),
    });

    // Simuliamo nessun record nella giornata richiesta.
    const leanMock = jest.fn().mockResolvedValue([]);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });

    TimeRecord.find.mockReturnValue({
      sort: sortMock,
    });

    const response = await request(app)
      .get("/api/admin/records?username=mario&date=2026-03-15")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    // Usiamo toMatchObject per non rendere il test fragile
    // se il backend aggiunge campi innocui in user, come fullName o email.
    expect(response.body).toMatchObject({
      user: {
        username: "mario",
        role: "user",
      },
      date: "2026-03-15",
      timezone: "Europe/Rome",
      totalRecords: 0,
      closedRecords: 0,
      totalSec: 0,
      totalHHMMSS: "00:00:00",
      records: [],
    });

    expect(getDayRangeInAppTz).toHaveBeenCalledWith("2026-03-15");
    expect(TimeRecord.find).toHaveBeenCalledWith({
      user: "user-mario",
      clockIn: {
        $gte: new Date("2026-03-15T00:00:00.000Z"),
        $lt: new Date("2026-03-16T00:00:00.000Z"),
      },
    });
  });

  it("restituisce 200 con dettaglio corretto su record chiusi e aperti", async () => {
    // Simuliamo utente valido.
    User.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "user-mario",
        username: "mario",
        role: "user",
      }),
    });

    const recordsFromDb = [
      {
        _id: "rec-1",
        user: "user-mario",
        clockIn: new Date("2026-03-15T08:00:00.000Z"),
        clockOut: new Date("2026-03-15T12:00:00.000Z"),
        durationSec: 14400,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-2",
        user: "user-mario",
        clockIn: new Date("2026-03-15T13:00:00.000Z"),
        clockOut: new Date("2026-03-15T17:00:00.000Z"),
        durationSec: 14400,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-3",
        user: "user-mario",
        clockIn: new Date("2026-03-15T18:00:00.000Z"),
        clockOut: null,
        durationSec: 0,
        status: "pending_manual_closure",
        manualClosureRequest: {
          proposedClockOut: new Date("2026-03-15T20:00:00.000Z"),
          note: "uscita dimenticata",
          requestedAt: new Date("2026-03-15T20:05:00.000Z"),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: "",
        },
      },
    ];

    // Mock chain Mongoose:
    // TimeRecord.find(...).sort(...).lean()
    const leanMock = jest.fn().mockResolvedValue(recordsFromDb);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });

    TimeRecord.find.mockReturnValue({
      sort: sortMock,
    });

    const response = await request(app)
      .get("/api/admin/records?username=mario&date=2026-03-15")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    // Anche qui usiamo toMatchObject per tollerare campi aggiuntivi.
    expect(response.body.user).toMatchObject({
      username: "mario",
      role: "user",
    });

    expect(response.body.date).toBe("2026-03-15");
    expect(response.body.timezone).toBe("Europe/Rome");
    expect(response.body.totalRecords).toBe(3);
    expect(response.body.closedRecords).toBe(2);
    expect(response.body.totalSec).toBe(28800);
    expect(response.body.totalHHMMSS).toBe("08:00:00");
    expect(response.body.records).toHaveLength(3);

    // Primo record: chiuso correttamente.
    expect(response.body.records[0].effectiveStatus).toBe("closed");
    expect(response.body.records[0].effectiveStatusLabel).toBe("CHIUSO");
    expect(response.body.records[0].effectiveDurationSec).toBe(14400);
    expect(response.body.records[0].effectiveDurationHHMMSS).toBe("04:00:00");

    // Terzo record: ancora pendente di approvazione manuale.
    expect(response.body.records[2].effectiveStatus).toBe(
      "pending_manual_closure"
    );
    expect(response.body.records[2].effectiveStatusLabel).toBe(
      "IN ATTESA APPROVAZIONE"
    );
    expect(response.body.records[2].effectiveDurationSec).toBe(0);
    expect(response.body.records[2].effectiveDurationHHMMSS).toBe("00:00:00");
  });

  it("usa la durata ricalcolata se durationSec non è valida ma il record è chiuso", async () => {
    // Simuliamo utente valido.
    User.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "user-mario",
        username: "mario",
        role: "user",
      }),
    });

    const recordsFromDb = [
      {
        _id: "rec-legacy",
        user: "user-mario",
        clockIn: new Date("2026-03-15T08:00:00.000Z"),
        clockOut: new Date("2026-03-15T10:30:00.000Z"),
        durationSec: null,
        status: "closed",
        manualClosureRequest: null,
      },
    ];

    // Mock chain record.
    const leanMock = jest.fn().mockResolvedValue(recordsFromDb);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });

    TimeRecord.find.mockReturnValue({
      sort: sortMock,
    });

    const response = await request(app)
      .get("/api/admin/records?username=mario&date=2026-03-15")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.totalRecords).toBe(1);
    expect(response.body.closedRecords).toBe(1);
    expect(response.body.totalSec).toBe(9000);
    expect(response.body.totalHHMMSS).toBe("02:30:00");

    // Verifica del fallback: durationSec è null,
    // quindi il controller deve ricalcolare la durata da clockIn/clockOut.
    expect(response.body.records[0].effectiveStatus).toBe("closed");
    expect(response.body.records[0].effectiveDurationSec).toBe(9000);
    expect(response.body.records[0].effectiveDurationHHMMSS).toBe("02:30:00");
  });
});