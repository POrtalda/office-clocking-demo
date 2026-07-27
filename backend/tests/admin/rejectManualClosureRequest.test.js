/**
 * tests/admin/rejectManualClosureRequest.test.js
 *
 * Test API per POST /api/admin/manual-closure-requests/:recordId/reject
 */

const request = require("supertest");

jest.mock("../../models/TimeRecord");
jest.mock("../../models/User");
jest.mock("jsonwebtoken");

const TimeRecord = require("../../models/TimeRecord");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("POST /api/admin/manual-closure-requests/:recordId/reject", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin123",
      username: "admin",
      role: "admin",
    });
  });

  test("restituisce 404 se il record non esiste", async () => {
    TimeRecord.findById.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/admin/manual-closure-requests/record123/reject")
      .set("Authorization", "Bearer token-admin")
      .send({ reviewNote: "non approvata" });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Record non trovato");
    expect(TimeRecord.findById).toHaveBeenCalledWith("record123");
  });

  test("restituisce 400 se il record non è in pending_manual_closure", async () => {
    const record = {
      _id: "record123",
      clockIn: new Date("2026-03-25T08:00:00.000Z"),
      clockOut: null,
      status: "open",
      manualClosureRequest: {
        proposedClockOut: new Date("2026-03-25T12:00:00.000Z"),
      },
      save: jest.fn(),
    };

    TimeRecord.findById.mockResolvedValue(record);

    const res = await request(app)
      .post("/api/admin/manual-closure-requests/record123/reject")
      .set("Authorization", "Bearer token-admin")
      .send({ reviewNote: "non approvata" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Il record non è in attesa di chiusura manuale"
    );
    expect(record.save).not.toHaveBeenCalled();
  });

  test("restituisce 400 se il record ha già clockOut valorizzato", async () => {
    const record = {
      _id: "record123",
      clockIn: new Date("2026-03-25T08:00:00.000Z"),
      clockOut: new Date("2026-03-25T12:00:00.000Z"),
      status: "pending_manual_closure",
      manualClosureRequest: {
        proposedClockOut: new Date("2026-03-25T12:00:00.000Z"),
      },
      save: jest.fn(),
    };

    TimeRecord.findById.mockResolvedValue(record);

    const res = await request(app)
      .post("/api/admin/manual-closure-requests/record123/reject")
      .set("Authorization", "Bearer token-admin")
      .send({ reviewNote: "non approvata" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Il record non è in attesa di chiusura manuale"
    );
    expect(record.save).not.toHaveBeenCalled();
  });

  test("restituisce 200 e rifiuta correttamente la richiesta valida", async () => {
    const record = {
      _id: "record123",
      user: "user123",
      clockIn: new Date("2026-03-25T08:00:00.000Z"),
      clockOut: null,
      durationSec: 0,
      status: "pending_manual_closure",
      manualClosureRequest: {
        proposedClockOut: new Date("2026-03-25T12:30:00.000Z"),
        note: "Ho dimenticato di timbrare l'uscita",
        requestedAt: new Date("2026-03-25T12:35:00.000Z"),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: "",
      },
      save: jest.fn().mockResolvedValue(true),
    };

    const savedRecord = {
      _id: "record123",
      user: {
        _id: "user123",
        username: "mario",
        role: "user",
      },
      clockIn: new Date("2026-03-25T08:00:00.000Z"),
      clockOut: null,
      durationSec: 0,
      status: "manual_closure_rejected",
      manualClosureRequest: {
        proposedClockOut: new Date("2026-03-25T12:30:00.000Z"),
        note: "Ho dimenticato di timbrare l'uscita",
        requestedAt: new Date("2026-03-25T12:35:00.000Z"),
        reviewedAt: new Date("2026-03-25T13:00:00.000Z"),
        reviewedBy: {
          _id: "admin123",
          username: "admin",
          role: "admin",
        },
        reviewNote: "non approvata",
      },
    };

    const leanMock = jest.fn().mockResolvedValue(savedRecord);
    const secondPopulateMock = jest.fn().mockReturnValue({
      lean: leanMock,
    });
    const firstPopulateMock = jest.fn().mockReturnValue({
      populate: secondPopulateMock,
    });

    TimeRecord.findById
      .mockResolvedValueOnce(record)
      .mockReturnValueOnce({
        populate: firstPopulateMock,
      });

    const res = await request(app)
      .post("/api/admin/manual-closure-requests/record123/reject")
      .set("Authorization", "Bearer token-admin")
      .send({ reviewNote: "non approvata" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe(
      "Richiesta di chiusura manuale rifiutata"
    );

    expect(TimeRecord.findById).toHaveBeenNthCalledWith(1, "record123");
    expect(TimeRecord.findById).toHaveBeenNthCalledWith(2, "record123");
    expect(firstPopulateMock).toHaveBeenCalledWith("user", "username role");
    expect(secondPopulateMock).toHaveBeenCalledWith(
      "manualClosureRequest.reviewedBy",
      "username role"
    );
    expect(leanMock).toHaveBeenCalled();

    expect(record.status).toBe("manual_closure_rejected");
    expect(record.manualClosureRequest.reviewedAt).toEqual(expect.any(Date));
    expect(record.manualClosureRequest.reviewedBy).toBe("admin123");
    expect(record.manualClosureRequest.reviewNote).toBe("non approvata");
    expect(record.save).toHaveBeenCalled();

    expect(res.body.record.status).toBe("manual_closure_rejected");
    expect(res.body.record.effectiveStatus).toBe("manual_closure_rejected");
    expect(res.body.record.effectiveStatusLabel).toBe("RICHIESTA RIFIUTATA");
  });

  test("restituisce 200 e usa la reviewNote di default se non fornita", async () => {
    const record = {
      _id: "record456",
      user: "user456",
      clockIn: new Date("2026-03-26T08:00:00.000Z"),
      clockOut: null,
      durationSec: 0,
      status: "pending_manual_closure",
      manualClosureRequest: {
        proposedClockOut: new Date("2026-03-26T12:30:00.000Z"),
        note: "Dimenticanza uscita",
        requestedAt: new Date("2026-03-26T12:35:00.000Z"),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: "",
      },
      save: jest.fn().mockResolvedValue(true),
    };

    const savedRecord = {
      _id: "record456",
      user: {
        _id: "user456",
        username: "luca",
        role: "user",
      },
      clockIn: new Date("2026-03-26T08:00:00.000Z"),
      clockOut: null,
      durationSec: 0,
      status: "manual_closure_rejected",
      manualClosureRequest: {
        proposedClockOut: new Date("2026-03-26T12:30:00.000Z"),
        note: "Dimenticanza uscita",
        requestedAt: new Date("2026-03-26T12:35:00.000Z"),
        reviewedAt: new Date("2026-03-26T13:00:00.000Z"),
        reviewedBy: {
          _id: "admin123",
          username: "admin",
          role: "admin",
        },
        reviewNote: "Richiesta rifiutata dall'admin",
      },
    };

    const leanMock = jest.fn().mockResolvedValue(savedRecord);
    const secondPopulateMock = jest.fn().mockReturnValue({
      lean: leanMock,
    });
    const firstPopulateMock = jest.fn().mockReturnValue({
      populate: secondPopulateMock,
    });

    TimeRecord.findById
      .mockResolvedValueOnce(record)
      .mockReturnValueOnce({
        populate: firstPopulateMock,
      });

    const res = await request(app)
      .post("/api/admin/manual-closure-requests/record456/reject")
      .set("Authorization", "Bearer token-admin")
      .send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe(
      "Richiesta di chiusura manuale rifiutata"
    );

    expect(record.status).toBe("manual_closure_rejected");
    expect(record.manualClosureRequest.reviewedAt).toEqual(expect.any(Date));
    expect(record.manualClosureRequest.reviewedBy).toBe("admin123");
    expect(record.manualClosureRequest.reviewNote).toBe(
      "Richiesta rifiutata dall'admin"
    );
    expect(record.save).toHaveBeenCalled();

    expect(res.body.record.status).toBe("manual_closure_rejected");
    expect(res.body.record.effectiveStatus).toBe("manual_closure_rejected");
    expect(res.body.record.effectiveStatusLabel).toBe("RICHIESTA RIFIUTATA");
  });
});