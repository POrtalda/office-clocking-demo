const request = require("supertest");

// Mock del model TimeRecord.
// Ci basta intercettare la find() usata dal controller.
jest.mock("../../models/TimeRecord", () => ({
  find: jest.fn(),
}));

// Mock del model LeaveRequest.
// Ora summary-all combina timbrature + assenze approvate.
jest.mock("../../models/LeaveRequest", () => ({
  find: jest.fn(),
}));

// Mock del model User.
// In questo file usiamo soprattutto User.find().
jest.mock("../../models/User", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

// Mock parziale delle utility date.
// Manteniamo le funzioni reali, ma forziamo getRangeFromToInAppTz
// per avere range prevedibili e controllabili nei test.
jest.mock("../../utils/dateTime", () => {
  const actual = jest.requireActual("../../utils/dateTime");
  return {
    ...actual,
    getRangeFromToInAppTz: jest.fn(),
  };
});

// Mock di jsonwebtoken per simulare facilmente un admin autenticato.
jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(),
}));

// Import dell'app Express reale e dei moduli mockati.
// Manteniamo require espliciti con path completi per evitare problemi con Jest.
const app = require("../../app");
const User = require("../../models/User");
const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");
const { getRangeFromToInAppTz } = require("../../utils/dateTime");

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

describe("GET /api/admin/summary-all", () => {
  beforeEach(() => {
    // Pulizia totale dei mock prima di ogni test.
    jest.clearAllMocks();

    // Simuliamo sempre un token valido di un admin.
    jwt.verify.mockReturnValue({
      id: "admin-user-id",
      username: "admin",
      role: "admin",
    });

    // Range fisso usato dal controller per il periodo richiesto.
    getRangeFromToInAppTz.mockReturnValue({
      start: new Date("2026-03-01T00:00:00.000Z"),
      nextDayStart: new Date("2026-04-01T00:00:00.000Z"),
    });

    // Di default nei vecchi test non ci sono assenze approvate.
    mockLeaveRequestFind([]);
  });

  it("restituisce 200 con rows vuote se non esistono utenti user", async () => {
    // Simuliamo la chain Mongoose:
    // User.find(...).select(...).sort(...).lean()
    const leanUsersMock = jest.fn().mockResolvedValue([]);
    const sortUsersMock = jest.fn().mockReturnValue({ lean: leanUsersMock });
    const selectUsersMock = jest.fn().mockReturnValue({ sort: sortUsersMock });

    User.find.mockReturnValue({
      select: selectUsersMock,
    });

    const response = await request(app)
      .get("/api/admin/summary-all?from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
      timezone: "Europe/Rome",
      totalUsers: 0,
      rows: [],
    });

    // Aggiornato: il controller ora filtra anche gli utenti attivi.
    expect(User.find).toHaveBeenCalledWith({
      role: "user",
      isActive: true,
    });

    // Aggiornato: il controller ora seleziona anche fullName.
    expect(selectUsersMock).toHaveBeenCalledWith("_id username role fullName");
    expect(sortUsersMock).toHaveBeenCalledWith({ username: 1 });
    expect(leanUsersMock).toHaveBeenCalled();

    // Se non esistono utenti user attivi, non deve nemmeno interrogare record/leave.
    expect(TimeRecord.find).not.toHaveBeenCalled();
    expect(LeaveRequest.find).not.toHaveBeenCalled();
  });

  it("restituisce 200 con aggregazione multiutente corretta", async () => {
    const usersFromDb = [
      {
        _id: "user-mario",
        username: "mario",
        role: "user",
        fullName: "",
      },
      {
        _id: "user-luca",
        username: "luca",
        role: "user",
        fullName: "",
      },
    ];

    // Mock chain Mongoose per la query utenti.
    const leanUsersMock = jest.fn().mockResolvedValue(usersFromDb);
    const sortUsersMock = jest.fn().mockReturnValue({ lean: leanUsersMock });
    const selectUsersMock = jest.fn().mockReturnValue({ sort: sortUsersMock });

    User.find.mockReturnValue({
      select: selectUsersMock,
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
        clockIn: new Date("2026-03-03T13:00:00.000Z"),
        clockOut: new Date("2026-03-03T17:00:00.000Z"),
        durationSec: 14400,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-3",
        user: "user-mario",
        clockIn: new Date("2026-03-04T08:00:00.000Z"),
        clockOut: new Date("2026-03-04T10:00:00.000Z"),
        durationSec: 7200,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-4",
        user: "user-luca",
        clockIn: new Date("2026-03-05T08:30:00.000Z"),
        clockOut: new Date("2026-03-05T12:30:00.000Z"),
        durationSec: 14400,
        status: "closed",
        manualClosureRequest: null,
      },
      {
        _id: "rec-5",
        user: "user-luca",
        clockIn: new Date("2026-03-06T08:00:00.000Z"),
        clockOut: null,
        durationSec: 0,
        status: "pending_manual_closure",
        manualClosureRequest: {
          proposedClockOut: new Date("2026-03-06T12:00:00.000Z"),
          note: "uscita dimenticata",
          requestedAt: new Date("2026-03-06T12:05:00.000Z"),
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: "",
        },
      },
    ];

    // Mock chain Mongoose per la query record.
    const leanRecordsMock = jest.fn().mockResolvedValue(recordsFromDb);
    const sortRecordsMock = jest.fn().mockReturnValue({ lean: leanRecordsMock });

    TimeRecord.find.mockReturnValue({
      sort: sortRecordsMock,
    });

    const response = await request(app)
      .get("/api/admin/summary-all?from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.from).toBe("2026-03-01");
    expect(response.body.to).toBe("2026-03-31");
    expect(response.body.timezone).toBe("Europe/Rome");
    expect(response.body.totalUsers).toBe(2);
    expect(response.body.rows).toHaveLength(2);

    // Aggiornato: il controller considera solo user attivi.
    expect(User.find).toHaveBeenCalledWith({
      role: "user",
      isActive: true,
    });

    expect(selectUsersMock).toHaveBeenCalledWith("_id username role fullName");

    expect(getRangeFromToInAppTz).toHaveBeenCalledWith(
      "2026-03-01",
      "2026-03-31"
    );

    expect(TimeRecord.find).toHaveBeenCalledWith({
      user: { $in: ["user-mario", "user-luca"] },
      clockIn: {
        $gte: new Date("2026-03-01T00:00:00.000Z"),
        $lt: new Date("2026-04-01T00:00:00.000Z"),
      },
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: { $in: ["user-mario", "user-luca"] },
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


    const marioRow = response.body.rows.find((row) => row.username === "mario");
    const lucaRow = response.body.rows.find((row) => row.username === "luca");

    expect(marioRow).toEqual({
      userId: "user-mario",
      username: "mario",
      role: "user",
      fullName: "",
      totalRecords: 3,
      closedRecords: 3,
      totalSec: 36000,
      totalHHMMSS: "10:00:00",
      workedDays: 2,
      avgSecPerDay: 18000,
      avgHHMMSS: "05:00:00",
      mutue: 0,
      ferie: 0,
      pir: 0,
      absenceDays: 0,
    });

    expect(lucaRow).toEqual({
      userId: "user-luca",
      username: "luca",
      role: "user",
      fullName: "",
      totalRecords: 2,
      closedRecords: 1,
      totalSec: 14400,
      totalHHMMSS: "04:00:00",
      workedDays: 1,
      avgSecPerDay: 14400,
      avgHHMMSS: "04:00:00",
      mutue: 0,
      ferie: 0,
      pir: 0,
      absenceDays: 0,
    });
  });

  it("restituisce 200 filtrando per username", async () => {
    const usersFromDb = [
      {
        _id: "user-mario",
        username: "mario",
        role: "user",
        fullName: "",
      },
    ];

    // Mock chain utenti.
    const leanUsersMock = jest.fn().mockResolvedValue(usersFromDb);
    const sortUsersMock = jest.fn().mockReturnValue({ lean: leanUsersMock });
    const selectUsersMock = jest.fn().mockReturnValue({ sort: sortUsersMock });

    User.find.mockReturnValue({
      select: selectUsersMock,
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
    ];

    // Mock chain record.
    const leanRecordsMock = jest.fn().mockResolvedValue(recordsFromDb);
    const sortRecordsMock = jest.fn().mockReturnValue({ lean: leanRecordsMock });

    TimeRecord.find.mockReturnValue({
      sort: sortRecordsMock,
    });

    const response = await request(app)
      .get("/api/admin/summary-all?from=2026-03-01&to=2026-03-31&username=mario")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.totalUsers).toBe(1);
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]).toEqual({
      userId: "user-mario",
      username: "mario",
      role: "user",
      fullName: "",
      totalRecords: 1,
      closedRecords: 1,
      totalSec: 14400,
      totalHHMMSS: "04:00:00",
      workedDays: 1,
      avgSecPerDay: 14400,
      avgHHMMSS: "04:00:00",
      mutue: 0,
      ferie: 0,
      pir: 0,
      absenceDays: 0,
    });

    // Aggiornato: oltre a role e username, ora si filtra anche per isActive=true.
    expect(User.find).toHaveBeenCalledWith({
      role: "user",
      username: "mario",
      isActive: true,
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: { $in: ["user-mario"] },
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

  it("usa la durata ricalcolata se durationSec non è valida", async () => {
    const usersFromDb = [
      {
        _id: "user-mario",
        username: "mario",
        role: "user",
        fullName: "",
      },
    ];

    // Mock chain utenti.
    const leanUsersMock = jest.fn().mockResolvedValue(usersFromDb);
    const sortUsersMock = jest.fn().mockReturnValue({ lean: leanUsersMock });
    const selectUsersMock = jest.fn().mockReturnValue({ sort: sortUsersMock });

    User.find.mockReturnValue({
      select: selectUsersMock,
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

    // Mock chain record.
    const leanRecordsMock = jest.fn().mockResolvedValue(recordsFromDb);
    const sortRecordsMock = jest.fn().mockReturnValue({ lean: leanRecordsMock });

    TimeRecord.find.mockReturnValue({
      sort: sortRecordsMock,
    });

    const response = await request(app)
      .get("/api/admin/summary-all?from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.totalUsers).toBe(1);
    expect(response.body.rows[0]).toEqual({
      userId: "user-mario",
      username: "mario",
      role: "user",
      fullName: "",
      totalRecords: 1,
      closedRecords: 1,
      totalSec: 9000,
      totalHHMMSS: "02:30:00",
      workedDays: 1,
      avgSecPerDay: 9000,
      avgHHMMSS: "02:30:00",
      mutue: 0,
      ferie: 0,
      pir: 0,
      absenceDays: 0,
    });
  });

  it("conteggia le assenze approvate nel riepilogo multiutente", async () => {
    const usersFromDb = [
      {
        _id: "user-mario",
        username: "mario",
        role: "user",
        fullName: "Mario Rossi",
      },
      {
        _id: "user-luca",
        username: "luca",
        role: "user",
        fullName: "Luca Bianchi",
      },
    ];

    const leanUsersMock = jest.fn().mockResolvedValue(usersFromDb);
    const sortUsersMock = jest.fn().mockReturnValue({ lean: leanUsersMock });
    const selectUsersMock = jest.fn().mockReturnValue({ sort: sortUsersMock });

    User.find.mockReturnValue({
      select: selectUsersMock,
    });

    const leanRecordsMock = jest.fn().mockResolvedValue([]);
    const sortRecordsMock = jest.fn().mockReturnValue({ lean: leanRecordsMock });

    TimeRecord.find.mockReturnValue({
      sort: sortRecordsMock,
    });

    mockLeaveRequestFind([
      {
        _id: "leave-1",
        user: "user-mario",
        type: "ferie",
        status: "approved",
        date: new Date("2026-03-12T00:00:00.000Z"),
      },
      {
        _id: "leave-2",
        user: "user-mario",
        type: "pir",
        status: "approved",
        date: new Date("2026-03-13T00:00:00.000Z"),
      },
      {
        _id: "leave-3",
        user: "user-luca",
        type: "mutua",
        status: "approved",
        date: new Date("2026-03-14T00:00:00.000Z"),
      },
    ]);

    const response = await request(app)
      .get("/api/admin/summary-all?from=2026-03-01&to=2026-03-31")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.totalUsers).toBe(2);

    const marioRow = response.body.rows.find((row) => row.username === "mario");
    const lucaRow = response.body.rows.find((row) => row.username === "luca");

    expect(marioRow).toEqual({
      userId: "user-mario",
      username: "mario",
      role: "user",
      fullName: "Mario Rossi",
      totalRecords: 0,
      closedRecords: 0,
      totalSec: 0,
      totalHHMMSS: "00:00:00",
      workedDays: 0,
      avgSecPerDay: 0,
      avgHHMMSS: "00:00:00",
      mutue: 0,
      ferie: 1,
      pir: 1,
      absenceDays: 2,
    });

    expect(lucaRow).toEqual({
      userId: "user-luca",
      username: "luca",
      role: "user",
      fullName: "Luca Bianchi",
      totalRecords: 0,
      closedRecords: 0,
      totalSec: 0,
      totalHHMMSS: "00:00:00",
      workedDays: 0,
      avgSecPerDay: 0,
      avgHHMMSS: "00:00:00",
      mutue: 1,
      ferie: 0,
      pir: 0,
      absenceDays: 1,
    });
  });
});