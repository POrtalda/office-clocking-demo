/**
 * tests/records/clockIn.test.js
 *
 * Test API per POST /api/records/clock-in
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
jest.mock("../../models/User");
jest.mock("jsonwebtoken");

const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

// Importiamo l'app DOPO i mock
const app = require("../../app");

describe("POST /api/records/clock-in", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = { ...originalEnv };
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "false";

    // Token valido di default
    jwt.verify.mockReturnValue({
      id: "user123",
      username: "mario",
      role: "user",
    });

    // Di default nei vecchi test non esiste nessuna assenza approvata oggi
    LeaveRequest.findOne.mockResolvedValue(null);

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ geolocationEnabled: true }),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("restituisce 201 e crea una nuova timbratura se non esiste un record aperto", async () => {
    const sortMock = jest.fn().mockResolvedValue(null);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const fakeCreatedRecord = {
      _id: "record123",
      user: "user123",
      clockIn: new Date("2026-03-26T08:00:00.000Z"),
      clockOut: null,
      durationSec: 0,
      status: "open",
    };

    TimeRecord.create.mockResolvedValue(fakeCreatedRecord);

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Entrata registrata con successo");

    expect(jwt.verify).toHaveBeenCalledWith(
      "token-valido",
      process.env.JWT_SECRET
    );

    expect(LeaveRequest.findOne).toHaveBeenCalled();

    expect(TimeRecord.findOne).toHaveBeenCalledWith({
      user: "user123",
      status: {
        $in: ["open", "pending_manual_closure", "manual_closure_rejected"],
      },
      clockOut: null,
    });

    expect(TimeRecord.create).toHaveBeenCalledWith({
      user: "user123",
      clockIn: expect.any(Date),
      clockOut: null,
      durationSec: 0,
      status: "open",
      clockInLocation: null,
    });

    expect(res.body.record).toMatchObject({
      _id: "record123",
      user: "user123",
      clockOut: null,
      durationSec: 0,
      status: "open",
    });
  });

  test("restituisce 400 se esiste già una timbratura aperta oggi", async () => {
    const openRecordToday = {
      _id: "open123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
    };

    const sortMock = jest.fn().mockResolvedValue(openRecordToday);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Hai già una timbratura aperta oggi");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
  });

  test("restituisce 400 se esiste una richiesta di chiusura manuale in attesa", async () => {
    const pendingRecord = {
      _id: "pending123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "pending_manual_closure",
    };

    const sortMock = jest.fn().mockResolvedValue(pendingRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai una richiesta di chiusura manuale in attesa di approvazione"
    );

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
  });

  test("restituisce 201 se esiste una richiesta di chiusura manuale in attesa di un giorno precedente", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const pendingPreviousDayRecord = {
      _id: "pending-previous123",
      user: "user123",
      clockIn: yesterday,
      clockOut: null,
      durationSec: 0,
      status: "pending_manual_closure",
    };

    const fakeCreatedRecord = {
      _id: "record-today123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
    };

    const sortMock = jest.fn().mockResolvedValue(pendingPreviousDayRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    TimeRecord.create.mockResolvedValue(fakeCreatedRecord);

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Entrata registrata con successo");

    expect(LeaveRequest.findOne).toHaveBeenCalled();

    expect(TimeRecord.create).toHaveBeenCalledWith({
      user: "user123",
      clockIn: expect.any(Date),
      clockOut: null,
      durationSec: 0,
      status: "open",
      clockInLocation: null,
    });

    expect(res.body.record).toMatchObject({
      _id: "record-today123",
      user: "user123",
      clockOut: null,
      durationSec: 0,
      status: "open",
    });
  });

  test("restituisce 400 se esiste una richiesta di chiusura manuale rifiutata", async () => {
    const rejectedRecord = {
      _id: "rejected123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "manual_closure_rejected",
    };

    const sortMock = jest.fn().mockResolvedValue(rejectedRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai una richiesta di chiusura manuale rifiutata: devi inviarne una nuova"
    );

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
  });

  test("restituisce 400 se esiste una timbratura aperta di un giorno precedente", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const openPreviousDayRecord = {
      _id: "previous123",
      user: "user123",
      clockIn: yesterday,
      clockOut: null,
      durationSec: 0,
      status: "open",
    };

    const sortMock = jest.fn().mockResolvedValue(openPreviousDayRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai una timbratura aperta di un giorno precedente"
    );

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
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
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai segnato mutua per oggi: non puoi registrare un'entrata"
    );
    expect(res.body.code).toBe("MUTUA_ALREADY_PRESENT");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
  });

  test("restituisce 400 se esiste una ferie approvata oggi", async () => {
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave-ferie-123",
      user: "user123",
      type: "ferie",
      status: "approved",
      date: new Date(),
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Hai un'assenza approvata per oggi (ferie): non puoi registrare un'entrata"
    );
    expect(res.body.code).toBe("APPROVED_LEAVE_ALREADY_PRESENT");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
  });

  test("non considera il PIR orario come assenza giornaliera bloccante", async () => {
    const sortMock = jest.fn().mockResolvedValue(null);

    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    TimeRecord.create.mockResolvedValue({
      _id: "record-hourly-pir-123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      durationSec: 0,
      status: "open",
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(201);
    expect(TimeRecord.create).toHaveBeenCalled();

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

  test("restituisce 400 se la geolocalizzazione è attiva e mancano le coordinate", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45";
    process.env.OFFICE_LNG = "7";
    process.env.OFFICE_RADIUS_METERS = "150";

    const sortMock = jest.fn().mockResolvedValue(null);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Posizione non valida: impossibile registrare l'entrata"
    );
    expect(res.body.code).toBe("INVALID_LOCATION");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.findOne).toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
  });

  test("restituisce 400 se la geolocalizzazione è attiva e l'utente è fuori raggio", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45";
    process.env.OFFICE_LNG = "7";
    process.env.OFFICE_RADIUS_METERS = "50";

    const sortMock = jest.fn().mockResolvedValue(null);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido")
      .send({
        location: {
          latitude: "45.01",
          longitude: "7.01",
          accuracy: "20",
        },
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Non puoi registrare l'entrata: sei fuori dall'area autorizzata"
    );
    expect(res.body.code).toBe("LOCATION_OUT_OF_RANGE");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.findOne).toHaveBeenCalled();
    expect(TimeRecord.create).not.toHaveBeenCalled();
  });

  test("restituisce 201 se la geolocalizzazione è attiva e l'utente è dentro il raggio", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45";
    process.env.OFFICE_LNG = "7";
    process.env.OFFICE_RADIUS_METERS = "150";

    const sortMock = jest.fn().mockResolvedValue(null);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const fakeCreatedRecord = {
      _id: "record-geolocated-123",
      user: "user123",
      clockIn: new Date("2026-03-26T08:00:00.000Z"),
      clockOut: null,
      durationSec: 0,
      status: "open",
    };

    TimeRecord.create.mockResolvedValue(fakeCreatedRecord);

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido")
      .send({
        location: {
          latitude: "45",
          longitude: "7",
          accuracy: "20",
        },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Entrata registrata con successo");

    expect(LeaveRequest.findOne).toHaveBeenCalled();
    expect(TimeRecord.findOne).toHaveBeenCalled();

    expect(TimeRecord.create).toHaveBeenCalledWith({
      user: "user123",
      clockIn: expect.any(Date),
      clockOut: null,
      durationSec: 0,
      status: "open",
      clockInLocation: {
        latitude: 45,
        longitude: 7,
        accuracy: 20,
        distanceMeters: 0,
        radiusMeters: 150,
        validatedAt: expect.any(Date),
        validationStatus: "passed",
      },
    });

    expect(res.body.record).toMatchObject({
      _id: "record-geolocated-123",
      user: "user123",
      clockOut: null,
      durationSec: 0,
      status: "open",
    });
  });
  test("restituisce 201 se la geolocalizzazione è attiva ma disattivata per l'utente", async () => {
    process.env.GEOLOCATION_CLOCK_IN_ENABLED = "true";
    process.env.OFFICE_LAT = "45.19101925311772";
    process.env.OFFICE_LNG = "7.893680019094721";
    process.env.OFFICE_RADIUS_METERS = "150";

    User.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ geolocationEnabled: false }),
    });

    const sortMock = jest.fn().mockResolvedValue(null);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const fakeCreatedRecord = {
      _id: "record-user-geo-disabled",
      user: "user123",
      clockIn: new Date("2026-03-26T08:00:00.000Z"),
      clockOut: null,
      durationSec: 0,
      status: "open",
    };

    TimeRecord.create.mockResolvedValue(fakeCreatedRecord);

    const res = await request(app)
      .post("/api/records/clock-in")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Entrata registrata con successo");

    expect(TimeRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "user123",
        status: "open",
        clockInLocation: null,
      })
    );
  });
});
