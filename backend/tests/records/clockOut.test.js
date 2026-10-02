/**
 * tests/records/clockOut.test.js
 *
 * Test API per POST /api/records/clock-out
 *
 * In questa fase:
 * - usiamo Supertest sull'app Express
 * - mockiamo TimeRecord, LeaveRequest e jsonwebtoken
 * - non dipendiamo ancora dal database reale
 */

const request = require("supertest");

// Mock dipendenze usate dal middleware auth e dal controller records
jest.mock("../../models/TimeRecord");
jest.mock("../../models/LeaveRequest");
jest.mock("jsonwebtoken");
jest.mock("../../models/User");

const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// Importiamo l'app DOPO i mock
const app = require("../../app");

describe("POST /api/records/clock-out", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    delete process.env.GEOLOCATION_CLOCK_IN_ENABLED;
    delete process.env.OFFICE_LAT;
    delete process.env.OFFICE_LNG;
    delete process.env.OFFICE_RADIUS_METERS;

    // Token valido di default
    jwt.verify.mockReturnValue({
      id: "user123",
      username: "mario",
      role: "user",
    });

    // Di default nei vecchi test non esiste nessuna mutua approvata oggi
    LeaveRequest.findOne.mockResolvedValue(null);
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ geolocationEnabled: true }),
    });
  });

  test("restituisce 404 se non esiste nessuna timbratura aperta", async () => {
    const sortMock = jest.fn().mockResolvedValue(null);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Nessuna timbratura aperta trovata");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
  });

  test("restituisce 400 se esiste una richiesta di chiusura manuale in attesa", async () => {
    const pendingRecord = {
      _id: "pending123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "pending_manual_closure",
      save: jest.fn(),
    };

    const sortMock = jest.fn().mockResolvedValue(pendingRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai una richiesta di chiusura manuale in attesa di approvazione"
    );

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(pendingRecord.save).not.toHaveBeenCalled();
  });

  test("restituisce 400 se esiste una richiesta di chiusura manuale rifiutata", async () => {
    const rejectedRecord = {
      _id: "rejected123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "manual_closure_rejected",
      save: jest.fn(),
    };

    const sortMock = jest.fn().mockResolvedValue(rejectedRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "La richiesta precedente è stata rifiutata: inviane una nuova"
    );

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(rejectedRecord.save).not.toHaveBeenCalled();
  });

  test("restituisce 400 se la timbratura aperta appartiene a un giorno precedente", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const previousDayRecord = {
      _id: "previous123",
      user: "user123",
      clockIn: yesterday,
      clockOut: null,
      durationSec: 0,
      status: "open",
      save: jest.fn(),
    };

    const sortMock = jest.fn().mockResolvedValue(previousDayRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "La timbratura aperta appartiene a un giorno precedente: serve una chiusura manuale"
    );

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(previousDayRecord.save).not.toHaveBeenCalled();
  });

  test("restituisce 200 e chiude la timbratura se il record aperto è valido", async () => {
    const openRecord = {
      _id: "open123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
      save: jest.fn().mockResolvedValue(true),
    };

    const sortMock = jest.fn().mockResolvedValue(openRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Uscita registrata con successo");

    expect(LeaveRequest.findOne).toHaveBeenCalled();

    expect(openRecord.status).toBe("closed");
    expect(openRecord.clockOut).toEqual(expect.any(Date));
    expect(openRecord.durationSec).toBeGreaterThanOrEqual(0);
    expect(openRecord.save).toHaveBeenCalled();

    expect(res.body.record.status).toBe("closed");
    expect(res.body.record.clockOut).toEqual(expect.any(String));
    expect(res.body.record.durationSec).toBeGreaterThanOrEqual(0);
  });

  test("restituisce 400 se la geolocalizzazione è attiva e manca la posizione in uscita", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45.19101925311772";
    process.env.OFFICE_LNG = "7.893680019094721";
    process.env.OFFICE_RADIUS_METERS = "150";

    const openRecord = {
      _id: "open-missing-location",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
      save: jest.fn().mockResolvedValue(true),
    };

    const sortMock = jest.fn().mockResolvedValue(openRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Posizione non valida: impossibile registrare l'uscita"
    );
    expect(res.body.code).toBe("INVALID_LOCATION");

    expect(openRecord.save).not.toHaveBeenCalled();
  });

  test("restituisce 400 se la geolocalizzazione è attiva e l'utente è fuori raggio in uscita", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45.19101925311772";
    process.env.OFFICE_LNG = "7.893680019094721";
    process.env.OFFICE_RADIUS_METERS = "150";

    const openRecord = {
      _id: "open-out-of-range",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
      save: jest.fn().mockResolvedValue(true),
    };

    const sortMock = jest.fn().mockResolvedValue(openRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        location: {
          latitude: 45.0703,
          longitude: 7.6869,
          accuracy: 20,
        },
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Non puoi registrare l'uscita: sei fuori dall'area autorizzata"
    );
    expect(res.body.code).toBe("LOCATION_OUT_OF_RANGE");

    expect(openRecord.save).not.toHaveBeenCalled();
  });

  test("restituisce 200 se la geolocalizzazione è attiva e l'utente è dentro raggio in uscita", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45.19101925311772";
    process.env.OFFICE_LNG = "7.893680019094721";
    process.env.OFFICE_RADIUS_METERS = "150";

    const openRecord = {
      _id: "open-inside-range",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
      clockOutLocation: null,
      save: jest.fn().mockResolvedValue(true),
    };

    const sortMock = jest.fn().mockResolvedValue(openRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        location: {
          latitude: 45.19101925311772,
          longitude: 7.893680019094721,
          accuracy: 15,
        },
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Uscita registrata con successo");

    expect(openRecord.status).toBe("closed");
    expect(openRecord.clockOut).toEqual(expect.any(Date));
    expect(openRecord.durationSec).toBeGreaterThanOrEqual(0);
    expect(openRecord.clockOutLocation).toEqual({
      latitude: 45.19101925311772,
      longitude: 7.893680019094721,
      accuracy: 15,
      distanceMeters: expect.any(Number),
      radiusMeters: 150,
      validatedAt: expect.any(Date),
      validationStatus: "passed",
    });

    expect(openRecord.save).toHaveBeenCalled();

    expect(res.body.record.status).toBe("closed");
    expect(res.body.record.clockOutLocation).toEqual({
      latitude: 45.19101925311772,
      longitude: 7.893680019094721,
      accuracy: 15,
      distanceMeters: expect.any(Number),
      radiusMeters: 150,
      validatedAt: expect.any(String),
      validationStatus: "passed",
    });
  });

  test("restituisce 400 se esiste una mutua approvata oggi", async () => {
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave123",
      user: "user123",
      type: "mutua",
      status: "approved",
      date: new Date(),
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai segnato mutua per oggi: non puoi registrare un'uscita"
    );
    expect(res.body.code).toBe("MUTUA_ALREADY_PRESENT");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
  });

  test("restituisce 400 se esiste un PIR approvato oggi", async () => {
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave-pir-123",
      user: "user123",
      type: "pir",
      status: "approved",
      date: new Date(),
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai un'assenza approvata per oggi (PIR): non puoi registrare un'uscita"
    );
    expect(res.body.code).toBe("APPROVED_LEAVE_ALREADY_PRESENT");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
  });

  test("non considera il PIR orario come assenza giornaliera bloccante in uscita", async () => {
    await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(LeaveRequest.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        $and: [
          {
            $or: [
              { type: { $in: ["mutua", "ferie"] } },
              {
                type: "pir",
                hours: null,
              },
            ],
          },
        ],
      })
    );
  });

  test("restituisce 200 se la geolocalizzazione è attiva ma disattivata per l'utente in uscita", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45.19101925311772";
    process.env.OFFICE_LNG = "7.893680019094721";
    process.env.OFFICE_RADIUS_METERS = "150";

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ geolocationEnabled: false }),
    });

    const openRecord = {
      _id: "record-user-geo-disabled-out",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
      save: jest.fn().mockResolvedValue(true),
    };

    const sortMock = jest.fn().mockResolvedValue(openRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-out")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Uscita registrata con successo");

    expect(openRecord.status).toBe("closed");
    expect(openRecord.clockOutLocation).toBeNull();
    expect(openRecord.save).toHaveBeenCalled();
  });
});
