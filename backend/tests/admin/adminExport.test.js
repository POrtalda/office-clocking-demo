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

const CSV_HEADER =
  "tipoRiga;username;userId;dataLocale;entrataISO;uscitaISO;durataSec;durataHHMMSS;statusOriginale;statusEffettivo;statoLabel;assenzaTipo;assenzaOre;assenzaNote;reviewedBy;reviewedAtISO;reviewNote;cancelledBy;cancelledAtISO;cancelReason";

function mockTimeRecordFind(records = []) {
  const leanMock = jest.fn().mockResolvedValue(records);
  const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
  const secondPopulateMock = jest.fn().mockReturnValue({ sort: sortMock });
  const firstPopulateMock = jest.fn().mockReturnValue({
    populate: secondPopulateMock,
  });

  TimeRecord.find.mockReturnValue({
    populate: firstPopulateMock,
  });

  return {
    leanMock,
    sortMock,
    firstPopulateMock,
    secondPopulateMock,
  };
}

function mockLeaveRequestFind(leaves = []) {
  const leanMock = jest.fn().mockResolvedValue(leaves);
  const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
  const secondPopulateMock = jest.fn().mockReturnValue({ sort: sortMock });
  const firstPopulateMock = jest.fn().mockReturnValue({
    populate: secondPopulateMock,
  });

  LeaveRequest.find.mockReturnValue({
    populate: firstPopulateMock,
  });

  return {
    leanMock,
    sortMock,
    firstPopulateMock,
    secondPopulateMock,
  };
}

describe("GET /api/admin/export", () => {
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
  });

  it("restituisce 200 con solo header CSV se non esistono record e assenze", async () => {
    mockTimeRecordFind([]);
    mockLeaveRequestFind([]);

    const response = await request(app)
      .get("/api/admin/export?from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      'attachment; filename="office-clocking_ALL_2026-03-01_to_2026-03-31.csv"'
    );

    expect(response.text.trim()).toBe(CSV_HEADER);

    expect(getRangeFromToInAppTz).toHaveBeenCalledWith(
      "2026-03-01",
      "2026-03-31"
    );

    expect(TimeRecord.find).toHaveBeenCalledWith({
      clockIn: {
        $gte: new Date("2026-03-01T00:00:00.000Z"),
        $lt: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
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

  it("restituisce 404 se viene passato username ma l'utente non esiste", async () => {
    User.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    const response = await request(app)
      .get("/api/admin/export?from=2026-03-01&to=2026-03-31&username=mario")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Utente non trovato");

    expect(User.findOne).toHaveBeenCalledWith({
      username: "mario",
    });

    expect(TimeRecord.find).not.toHaveBeenCalled();
    expect(LeaveRequest.find).not.toHaveBeenCalled();
  });

  it("restituisce 200 con CSV corretto su record chiusi, pendenti e assenze", async () => {
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
        user: {
          _id: "user-mario",
          username: "mario",
          role: "user",
        },
        clockIn: new Date("2026-03-03T08:00:00.000Z"),
        clockOut: new Date("2026-03-03T12:00:00.000Z"),
        durationSec: 14400,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-2",
        user: {
          _id: "user-mario",
          username: "mario",
          role: "user",
        },
        clockIn: new Date("2026-03-04T08:00:00.000Z"),
        clockOut: null,
        durationSec: 0,
        status: "pending_manual_closure",
        manualClosureRequest: {
          proposedClockOut: new Date("2026-03-04T12:00:00.000Z"),
          note: "uscita dimenticata",
          requestedAt: new Date("2026-03-04T12:05:00.000Z"),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: "",
        },
      },
    ];

    const leavesFromDb = [
      {
        _id: "leave-1",
        user: {
          _id: "user-mario",
          username: "mario",
          role: "user",
        },
        type: "ferie",
        status: "approved",
        date: new Date("2026-03-05T00:00:00.000Z"),
        hours: null,
        note: "Ferie approvate",
        reviewedBy: {
          _id: "admin-user-id",
          username: "admin",
          role: "admin",
        },
        reviewedAt: new Date("2026-03-01T10:00:00.000Z"),
        reviewNote: "Ok",
      },
    ];

    mockTimeRecordFind(recordsFromDb);
    mockLeaveRequestFind(leavesFromDb);

    const response = await request(app)
      .get("/api/admin/export?from=2026-03-01&to=2026-03-31&username=mario")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain(
      'attachment; filename="office-clocking_ALL_2026-03-01_to_2026-03-31_user-mario.csv"'
    );

    expect(User.findOne).toHaveBeenCalledWith({
      username: "mario",
    });

    expect(TimeRecord.find).toHaveBeenCalledWith({
      user: "user-mario",
      clockIn: {
        $gte: new Date("2026-03-01T00:00:00.000Z"),
        $lt: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: "user-mario",
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

    const lines = response.text.trim().split("\n");

    expect(lines[0]).toBe(CSV_HEADER);

    expect(lines[1]).toContain("timbratura;mario;user-mario;");
    expect(lines[1]).toContain("2026-03-03T08:00:00.000Z");
    expect(lines[1]).toContain("2026-03-03T12:00:00.000Z");
    expect(lines[1]).toContain(";14400;04:00:00;closed;closed;CHIUSO");

    expect(lines[2]).toContain("timbratura;mario;user-mario;");
    expect(lines[2]).toContain("2026-03-04T08:00:00.000Z");
    expect(lines[2]).toContain(
      ";;0;00:00:00;pending_manual_closure;pending_manual_closure;IN ATTESA APPROVAZIONE"
    );

    expect(lines[3]).toContain("assenza;mario;user-mario;");
    expect(lines[3]).toContain(
      "approved;approved;APPROVATA;FERIE;;Ferie approvate;admin;2026-03-01T10:00:00.000Z;Ok;;;"
    );
  });

  it("usa la durata effettiva ricalcolata sui record legacy chiusi", async () => {
    const recordsFromDb = [
      {
        _id: "rec-legacy",
        user: {
          _id: "user-luca",
          username: "luca",
          role: "user",
        },
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
      .get("/api/admin/export?from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    const lines = response.text.trim().split("\n");

    expect(lines[1]).toContain("timbratura;luca;user-luca;");
    expect(lines[1]).toContain("2026-03-10T08:00:00.000Z");
    expect(lines[1]).toContain("2026-03-10T10:30:00.000Z");
    expect(lines[1]).toContain(";9000;02:30:00;closed;closed;CHIUSO");
  });

  it("usa userId dal record se user non è popolato come oggetto", async () => {
    const recordsFromDb = [
      {
        _id: "rec-plain-user",
        user: "user-raw-id",
        clockIn: new Date("2026-03-11T08:00:00.000Z"),
        clockOut: new Date("2026-03-11T09:00:00.000Z"),
        durationSec: 3600,
        status: "closed",
        manualClosureRequest: null,
      },
    ];

    mockTimeRecordFind(recordsFromDb);
    mockLeaveRequestFind([]);

    const response = await request(app)
      .get("/api/admin/export?from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    const lines = response.text.trim().split("\n");

    expect(lines[1]).toContain("timbratura;;user-raw-id;");
    expect(lines[1]).toContain(";3600;01:00:00;closed;closed;CHIUSO");
  });
});