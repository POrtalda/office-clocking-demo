const request = require("supertest");

jest.mock("../../models/TimeRecord", () => ({
  find: jest.fn(),
}));

jest.mock("../../models/User", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../utils/dateTime", () => {
  const actual = jest.requireActual("../../utils/dateTime");
  return {
    ...actual,
  };
});

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const app = require("../../app");
const TimeRecord = require("../../models/TimeRecord");
const jwt = require("jsonwebtoken");

describe("GET /api/admin/manual-closure-requests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin-user-id",
      username: "admin",
      role: "admin",
    });
  });

  it("restituisce 200 con lista vuota se non ci sono richieste pendenti", async () => {
    const leanMock = jest.fn().mockResolvedValue([]);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const populateMock = jest.fn().mockReturnValue({ sort: sortMock });

    TimeRecord.find.mockReturnValue({
      populate: populateMock,
    });

    const response = await request(app)
      .get("/api/admin/manual-closure-requests")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      total: 0,
      records: [],
    });

    expect(TimeRecord.find).toHaveBeenCalledWith({
      status: "pending_manual_closure",
      clockOut: null,
    });

    expect(populateMock).toHaveBeenCalledWith("user", "username role");
    expect(sortMock).toHaveBeenCalledWith({
      "manualClosureRequest.requestedAt": 1,
      clockIn: 1,
    });
  });

  it("restituisce 200 con le richieste pendenti formattate correttamente", async () => {
    const recordsFromDb = [
      {
        _id: "record-1",
        user: {
          _id: "user-1",
          username: "luca",
          role: "user",
        },
        clockIn: new Date("2026-03-16T08:00:00.000Z"),
        clockOut: null,
        durationSec: 0,
        status: "pending_manual_closure",
        manualClosureRequest: {
          proposedClockOut: new Date("2026-03-16T12:30:00.000Z"),
          note: "Ho dimenticato l'uscita",
          requestedAt: new Date("2026-03-16T12:35:00.000Z"),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: "",
        },
      },
    ];

    const leanMock = jest.fn().mockResolvedValue(recordsFromDb);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const populateMock = jest.fn().mockReturnValue({ sort: sortMock });

    TimeRecord.find.mockReturnValue({
      populate: populateMock,
    });

    const response = await request(app)
      .get("/api/admin/manual-closure-requests")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.records).toHaveLength(1);

    const record = response.body.records[0];

    expect(record._id).toBe("record-1");
    expect(record.username).toBe("luca");
    expect(record.status).toBe("pending_manual_closure");
    expect(record.effectiveStatus).toBe("pending_manual_closure");
    expect(record.effectiveStatusLabel).toBe("IN ATTESA APPROVAZIONE");
    expect(record.proposedDurationSec).toBe(16200);
    expect(record.proposedDurationHHMMSS).toBe("04:30:00");
    expect(record.effectiveDurationSec).toBe(0);
    expect(record.effectiveDurationHHMMSS).toBe("00:00:00");
  });

  it("restituisce proposedDuration null se proposedClockOut non è valido rispetto a clockIn", async () => {
    const recordsFromDb = [
      {
        _id: "record-2",
        user: {
          _id: "user-2",
          username: "mario",
          role: "user",
        },
        clockIn: new Date("2026-03-16T10:00:00.000Z"),
        clockOut: null,
        durationSec: 0,
        status: "pending_manual_closure",
        manualClosureRequest: {
          proposedClockOut: new Date("2026-03-16T09:00:00.000Z"),
          note: "orario errato",
          requestedAt: new Date("2026-03-16T10:05:00.000Z"),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: "",
        },
      },
    ];

    const leanMock = jest.fn().mockResolvedValue(recordsFromDb);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const populateMock = jest.fn().mockReturnValue({ sort: sortMock });

    TimeRecord.find.mockReturnValue({
      populate: populateMock,
    });

    const response = await request(app)
      .get("/api/admin/manual-closure-requests")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);

    const record = response.body.records[0];

    expect(record.username).toBe("mario");
    expect(record.proposedDurationSec).toBeNull();
    expect(record.proposedDurationHHMMSS).toBeNull();
  });
});