const request = require("supertest");

jest.mock("../../models/TimeRecord", () => ({
  find: jest.fn(),
}));

jest.mock("../../models/LeaveRequest", () => ({
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
    getRangeFromToInAppTz: jest.fn(),
  };
});

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

const app = require("../../app");
const User = require("../../models/User");
const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");
const { getRangeFromToInAppTz } = require("../../utils/dateTime");

function mockUserFindOne(user = null) {
  const queryMock = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(user),
  };

  User.findOne.mockReturnValue(queryMock);

  return queryMock;
}

function mockTimeRecordFind(records = []) {
  const queryMock = {
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(records),
  };

  TimeRecord.find.mockReturnValue(queryMock);

  return queryMock;
}

function mockLeaveRequestFind(leaves = []) {
  const queryMock = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(leaves),
  };

  LeaveRequest.find.mockReturnValue(queryMock);

  return queryMock;
}

describe("GET /api/admin/summary", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin-user-id",
      username: "admin",
      role: "admin",
    });

    getRangeFromToInAppTz.mockReturnValue({
      start: new Date("2026-03-01T00:00:00.000Z"),
      nextDayStart: new Date("2026-04-01T00:00:00.000Z"),
    });

    mockTimeRecordFind([]);
    mockLeaveRequestFind([]);
  });

  it("restituisce 400 se mancano username, from o to", async () => {
    const response = await request(app)
      .get("/api/admin/summary")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Parametri richiesti: username, from, to"
    );

    expect(User.findOne).not.toHaveBeenCalled();
    expect(TimeRecord.find).not.toHaveBeenCalled();
    expect(LeaveRequest.find).not.toHaveBeenCalled();
  });

  it("restituisce 404 se l'utente non esiste", async () => {
    mockUserFindOne(null);

    const response = await request(app)
      .get("/api/admin/summary?username=mario&from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Utente non trovato");

    expect(User.findOne).toHaveBeenCalledWith({
      username: "mario",
    });

    expect(TimeRecord.find).not.toHaveBeenCalled();
    expect(LeaveRequest.find).not.toHaveBeenCalled();
  });

  it("restituisce 200 con summary vuoto se non esistono record e assenze", async () => {
    mockUserFindOne({
      _id: "user-mario",
      username: "mario",
      role: "user",
    });

    mockTimeRecordFind([]);
    mockLeaveRequestFind([]);

    const response = await request(app)
      .get("/api/admin/summary?username=mario&from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

      
    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      username: "mario",
      from: "2026-03-01",
      to: "2026-03-31",
      timezone: "Europe/Rome",
      totalRecords: 0,
      closedRecords: 0,
      totalSec: 0,
      totalHHMMSS: "00:00:00",
      mutue: 0,
      ferie: 0,
      pir: 0,
      absenceDays: 0,
      records: [],
    });

    expect(getRangeFromToInAppTz).toHaveBeenCalledWith(
      "2026-03-01",
      "2026-03-31"
    );

    expect(TimeRecord.find).toHaveBeenCalledWith({
      user: "user-mario",
      clockIn: {
        $gte: new Date("2026-03-01T00:00:00.000Z"),
        $lt: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: "user-mario",
      status: "approved",
      $or: [
        {
          startDate: { $lt: new Date("2026-04-01T00:00:00.000Z") },
          endDate: { $gte: new Date("2026-03-01T00:00:00.000Z") },
        },
        {
          date: {
            $gte: new Date("2026-03-01T00:00:00.000Z"),
            $lt: new Date("2026-04-01T00:00:00.000Z"),
          },
        },
      ],
    });
  });

  it("restituisce 200 con summary corretta su record chiusi e aperti", async () => {
    mockUserFindOne({
      _id: "user-mario",
      username: "mario",
      role: "user",
    });

    const recordsFromDb = [
      {
        _id: "rec-1",
        user: "user-mario",
        clockIn: new Date("2026-03-03T08:00:00.000Z"),
        clockOut: new Date("2026-03-03T12:00:00.000Z"),
        durationSec: 14400,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-2",
        user: "user-mario",
        clockIn: new Date("2026-03-04T08:30:00.000Z"),
        clockOut: new Date("2026-03-04T12:30:00.000Z"),
        durationSec: 14400,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-3",
        user: "user-mario",
        clockIn: new Date("2026-03-05T08:00:00.000Z"),
        clockOut: null,
        durationSec: 0,
        status: "pending_manual_closure",
        manualClosureRequest: {
          proposedClockOut: new Date("2026-03-05T12:00:00.000Z"),
          note: "uscita dimenticata",
          requestedAt: new Date("2026-03-05T12:10:00.000Z"),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: "",
        },
      },
    ];

    mockTimeRecordFind(recordsFromDb);
    mockLeaveRequestFind([]);

    const response = await request(app)
      .get("/api/admin/summary?username=mario&from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      username: "mario",
      from: "2026-03-01",
      to: "2026-03-31",
      timezone: "Europe/Rome",
      totalRecords: 3,
      closedRecords: 2,
      totalSec: 28800,
      totalHHMMSS: "08:00:00",
      mutue: 0,
      ferie: 0,
      pir: 0,
      absenceDays: 0,
    });

    expect(response.body.records).toHaveLength(3);

    expect(response.body.records[0]).toMatchObject({
      effectiveStatus: "closed",
      effectiveStatusLabel: "CHIUSO",
      effectiveDurationSec: 14400,
      effectiveDurationHHMMSS: "04:00:00",
    });

    expect(response.body.records[2]).toMatchObject({
      effectiveStatus: "pending_manual_closure",
      effectiveStatusLabel: "IN ATTESA APPROVAZIONE",
      effectiveDurationSec: 0,
      effectiveDurationHHMMSS: "00:00:00",
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: "user-mario",
      status: "approved",
      $or: [
        {
          startDate: { $lt: new Date("2026-04-01T00:00:00.000Z") },
          endDate: { $gte: new Date("2026-03-01T00:00:00.000Z") },
        },
        {
          date: {
            $gte: new Date("2026-03-01T00:00:00.000Z"),
            $lt: new Date("2026-04-01T00:00:00.000Z"),
          },
        },
      ],
    });
  });

  it("usa la durata ricalcolata se durationSec non è valida ma il record è chiuso", async () => {
    mockUserFindOne({
      _id: "user-mario",
      username: "mario",
      role: "user",
    });

    const recordsFromDb = [
      {
        _id: "rec-legacy",
        user: "user-mario",
        clockIn: new Date("2026-03-10T08:00:00.000Z"),
        clockOut: new Date("2026-03-10T10:30:00.000Z"),
        durationSec: null,
        status: "closed",
        manualClosureRequest: null,
      },
    ];

    mockTimeRecordFind(recordsFromDb);
    mockLeaveRequestFind([]);

    const response = await request(app)
      .get("/api/admin/summary?username=mario&from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      totalRecords: 1,
      closedRecords: 1,
      totalSec: 9000,
      totalHHMMSS: "02:30:00",
      mutue: 0,
      ferie: 0,
      pir: 0,
      absenceDays: 0,
    });

    expect(response.body.records[0]).toMatchObject({
      effectiveStatus: "closed",
      effectiveDurationSec: 9000,
      effectiveDurationHHMMSS: "02:30:00",
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: "user-mario",
      status: "approved",
      $or: [
        {
          startDate: { $lt: new Date("2026-04-01T00:00:00.000Z") },
          endDate: { $gte: new Date("2026-03-01T00:00:00.000Z") },
        },
        {
          date: {
            $gte: new Date("2026-03-01T00:00:00.000Z"),
            $lt: new Date("2026-04-01T00:00:00.000Z"),
          },
        },
      ],
    });
  });

  it("conteggia le assenze approvate nel riepilogo singolo utente", async () => {
    mockUserFindOne({
      _id: "user-mario",
      username: "mario",
      role: "user",
    });

    mockTimeRecordFind([]);

    mockLeaveRequestFind([
      {
        _id: "leave-1",
        user: "user-mario",
        type: "mutua",
        status: "approved",
        date: new Date("2026-03-11T00:00:00.000Z"),
      },
      {
        _id: "leave-2",
        user: "user-mario",
        type: "ferie",
        status: "approved",
        date: new Date("2026-03-12T00:00:00.000Z"),
      },
      {
        _id: "leave-3",
        user: "user-mario",
        type: "pir",
        status: "approved",
        date: new Date("2026-03-13T00:00:00.000Z"),
      },
    ]);

    const response = await request(app)
      .get("/api/admin/summary?username=mario&from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      username: "mario",
      from: "2026-03-01",
      to: "2026-03-31",
      timezone: "Europe/Rome",
      totalRecords: 0,
      closedRecords: 0,
      totalSec: 0,
      totalHHMMSS: "00:00:00",
      mutue: 1,
      ferie: 1,
      pir: 1,
      absenceDays: 3,
      records: [],
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: "user-mario",
      status: "approved",
      $or: [
        {
          startDate: { $lt: new Date("2026-04-01T00:00:00.000Z") },
          endDate: { $gte: new Date("2026-03-01T00:00:00.000Z") },
        },
        {
          date: {
            $gte: new Date("2026-03-01T00:00:00.000Z"),
           $lt: new Date("2026-04-01T00:00:00.000Z"),
          },
        },
      ],
    });
  });
});