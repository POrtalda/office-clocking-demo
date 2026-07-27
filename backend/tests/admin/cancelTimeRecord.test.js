const request = require("supertest");

jest.mock("../../models/TimeRecord", () => ({
  findById: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const app = require("../../app");
const TimeRecord = require("../../models/TimeRecord");
const jwt = require("jsonwebtoken");

describe("POST /api/admin/records/:recordId/cancel", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin-user-id",
      username: "admin",
      role: "admin",
    });
  });

  it("restituisce 400 se recordId non è valido", async () => {
    const response = await request(app)
      .post("/api/admin/records/not-valid/cancel")
      .send({ cancelReason: "Errore di timbratura" })
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_RECORD_ID");
    expect(TimeRecord.findById).not.toHaveBeenCalled();
  });

  it("restituisce 400 se manca cancelReason", async () => {
    const response = await request(app)
      .post("/api/admin/records/665f1f77bcf86cd799439011/cancel")
      .send({})
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("TIMERECORD_CANCELLATION_REASON_REQUIRED");
    expect(TimeRecord.findById).not.toHaveBeenCalled();
  });

  it("restituisce 404 se la timbratura non esiste", async () => {
    TimeRecord.findById.mockResolvedValueOnce(null);

    const response = await request(app)
      .post("/api/admin/records/665f1f77bcf86cd799439011/cancel")
      .send({ cancelReason: "Entrata registrata per errore" })
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("RECORD_NOT_FOUND");
    expect(TimeRecord.findById).toHaveBeenCalledWith("665f1f77bcf86cd799439011");
  });

  it("restituisce 400 se la timbratura è già annullata", async () => {
    TimeRecord.findById.mockResolvedValueOnce({
      _id: "665f1f77bcf86cd799439011",
      status: "cancelled",
    });

    const response = await request(app)
      .post("/api/admin/records/665f1f77bcf86cd799439011/cancel")
      .send({ cancelReason: "Entrata registrata per errore" })
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("TIMERECORD_ALREADY_CANCELLED");
  });

  it("annulla correttamente una timbratura", async () => {
    const saveMock = jest.fn().mockResolvedValue();

    const recordDoc = {
      _id: "665f1f77bcf86cd799439011",
      user: "user-id",
      clockIn: new Date("2026-03-10T08:00:00.000Z"),
      clockOut: new Date("2026-03-10T12:00:00.000Z"),
      durationSec: 14400,
      status: "closed",
      cancellation: {
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: "",
      },
      save: saveMock,
    };

    const savedRecord = {
      _id: "665f1f77bcf86cd799439011",
      user: {
        _id: "user-id",
        username: "mario",
        role: "user",
      },
      clockIn: new Date("2026-03-10T08:00:00.000Z"),
      clockOut: new Date("2026-03-10T12:00:00.000Z"),
      durationSec: 14400,
      status: "cancelled",
      cancellation: {
        cancelledAt: new Date("2026-03-10T13:00:00.000Z"),
        cancelledBy: {
          _id: "admin-user-id",
          username: "admin",
          role: "admin",
        },
        cancelReason: "Entrata registrata per errore",
      },
    };

    const leanMock = jest.fn().mockResolvedValue(savedRecord);
    const thirdPopulateMock = jest.fn().mockReturnValue({ lean: leanMock });
    const secondPopulateMock = jest.fn().mockReturnValue({
      populate: thirdPopulateMock,
    });
    const firstPopulateMock = jest.fn().mockReturnValue({
      populate: secondPopulateMock,
    });

    TimeRecord.findById
      .mockResolvedValueOnce(recordDoc)
      .mockReturnValueOnce({
        populate: firstPopulateMock,
      });

    const response = await request(app)
      .post("/api/admin/records/665f1f77bcf86cd799439011/cancel")
      .send({ cancelReason: "Entrata registrata per errore" })
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Timbratura annullata");

    expect(recordDoc.status).toBe("cancelled");
    expect(recordDoc.cancellation.cancelledAt).toBeInstanceOf(Date);
    expect(recordDoc.cancellation.cancelledBy).toBe("admin-user-id");
    expect(recordDoc.cancellation.cancelReason).toBe(
      "Entrata registrata per errore"
    );

    expect(saveMock).toHaveBeenCalledTimes(1);

    expect(response.body.record.effectiveStatus).toBe("cancelled");
    expect(response.body.record.effectiveStatusLabel).toBe("ANNULLATA");
    expect(response.body.record.effectiveDurationSec).toBe(0);
    expect(response.body.record.effectiveDurationHHMMSS).toBe("00:00:00");
  });
});