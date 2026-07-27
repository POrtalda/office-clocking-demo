/**
 * tests/records/myOpen.test.js
 *
 * Test API per GET /api/records/my-open
 *
 * In questa fase:
 * - usiamo Supertest sull'app Express
 * - mockiamo TimeRecord e jsonwebtoken
 * - non dipendiamo ancora dal database reale
 */

const request = require("supertest");

// Mock dipendenze usate dal middleware auth e dal controller records
jest.mock("../../models/TimeRecord");
jest.mock("jsonwebtoken");

const TimeRecord = require("../../models/TimeRecord");
const jwt = require("jsonwebtoken");

// Importiamo l'app DOPO i mock
const app = require("../../app");

describe("GET /api/records/my-open", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Token valido di default
    jwt.verify.mockReturnValue({
      id: "user123",
      username: "mario",
      role: "user",
    });
  });

  test("restituisce record null se non esiste nessun record aperto", async () => {
    const sortMock = jest.fn().mockResolvedValue(null);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .get("/api/records/my-open")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      record: null,
      isFromPreviousDay: false,
      canRequestManualClosure: false,
    });
  });

  test("restituisce il record aperto di oggi con flag corretti", async () => {
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
      .get("/api/records/my-open")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(200);
    expect(res.body.record).toMatchObject({
      _id: "open123",
      user: "user123",
      clockOut: null,
      durationSec: 0,
      status: "open",
    });
    expect(res.body.isFromPreviousDay).toBe(false);
    expect(res.body.canRequestManualClosure).toBe(false);
  });

  test("restituisce isFromPreviousDay=true se il record aperto è di un giorno precedente", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const previousDayRecord = {
      _id: "prev123",
      user: "user123",
      clockIn: yesterday,
      clockOut: null,
      durationSec: 0,
      status: "open",
    };

    const sortMock = jest.fn().mockResolvedValue(previousDayRecord);
    TimeRecord.findOne.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .get("/api/records/my-open")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(200);
    expect(res.body.record).toMatchObject({
      _id: "prev123",
      status: "open",
    });
    expect(res.body.isFromPreviousDay).toBe(true);
    expect(res.body.canRequestManualClosure).toBe(true);
  });

  test("restituisce canRequestManualClosure=true se il record è manual_closure_rejected", async () => {
    const rejectedRecord = {
      _id: "rej123",
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
      .get("/api/records/my-open")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(200);
    expect(res.body.record).toMatchObject({
      _id: "rej123",
      status: "manual_closure_rejected",
    });
    expect(res.body.canRequestManualClosure).toBe(true);
  });
});