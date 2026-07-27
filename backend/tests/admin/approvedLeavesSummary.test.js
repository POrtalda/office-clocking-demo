const request = require("supertest");

jest.mock("../../models/User", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../models/LeaveRequest", () => ({
  find: jest.fn(),
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
const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");
const { getRangeFromToInAppTz } = require("../../utils/dateTime");

function mockUserFindOne(user = null) {
  const queryMock = {
    lean: jest.fn().mockResolvedValue(user),
  };

  User.findOne.mockReturnValue(queryMock);

  return queryMock;
}

function mockLeaveRequestFind(leaves = []) {
  const queryMock = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(leaves),
  };

  LeaveRequest.find.mockReturnValue(queryMock);

  return queryMock;
}

describe("GET /api/admin/approved-leaves", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin-user-id",
      username: "admin",
      role: "admin",
    });

    getRangeFromToInAppTz.mockReturnValue({
      start: new Date("2026-06-01T00:00:00.000Z"),
      nextDayStart: new Date("2026-07-01T00:00:00.000Z"),
    });

    mockLeaveRequestFind([]);
  });

  it("restituisce solo ferie e PIR approvati nel periodo richiesto", async () => {
    const leavesFromDb = [
      {
        _id: "leave-ferie-1",
        user: {
          _id: "user-mario",
          username: "mario",
          role: "user",
          fullName: "Mario Rossi",
          email: "mario@example.com",
          isActive: true,
        },
        type: "ferie",
        status: "approved",
        date: new Date("2026-06-10T00:00:00.000Z"),
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: new Date("2026-06-12T00:00:00.000Z"),
        note: "ferie approvate",
      },
      {
        _id: "leave-pir-1",
        user: {
          _id: "user-mario",
          username: "mario",
          role: "user",
          fullName: "Mario Rossi",
          email: "mario@example.com",
          isActive: true,
        },
        type: "pir",
        status: "approved",
        date: new Date("2026-06-14T00:00:00.000Z"),
        startDate: new Date("2026-06-14T00:00:00.000Z"),
        endDate: new Date("2026-06-14T00:00:00.000Z"),
        note: "pir approvato",
      },
    ];

    mockLeaveRequestFind(leavesFromDb);

    const response = await request(app)
      .get("/api/admin/approved-leaves?from=2026-06-01&to=2026-06-30")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);

    expect(response.body).toMatchObject({
      from: "2026-06-01",
      to: "2026-06-30",
      username: "",
      type: "",
      timezone: "Europe/Rome",
      total: 2,
    });

    expect(response.body.leaves).toHaveLength(2);
    expect(response.body.leaves.map((leave) => leave.type).sort()).toEqual([
      "ferie",
      "pir",
    ]);

    expect(response.body.leaves.every((leave) => leave.status === "approved")).toBe(
      true
    );

    expect(response.body.leaves[0]).toHaveProperty("username", "mario");

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      status: "approved",
      type: { $in: ["ferie", "pir"] },
      $or: [
        {
          startDate: { $lt: new Date("2026-07-01T00:00:00.000Z") },
          endDate: { $gte: new Date("2026-06-01T00:00:00.000Z") },
        },
        {
          date: {
            $gte: new Date("2026-06-01T00:00:00.000Z"),
            $lt: new Date("2026-07-01T00:00:00.000Z"),
          },
        },
      ],
    });
  });

  it("filtra per tipo assenza", async () => {
    mockLeaveRequestFind([
      {
        _id: "leave-ferie-1",
        user: {
          _id: "user-mario",
          username: "mario",
          role: "user",
          fullName: "Mario Rossi",
          email: "mario@example.com",
          isActive: true,
        },
        type: "ferie",
        status: "approved",
        date: new Date("2026-06-10T00:00:00.000Z"),
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: new Date("2026-06-10T00:00:00.000Z"),
      },
    ]);

    const response = await request(app)
      .get("/api/admin/approved-leaves?from=2026-06-01&to=2026-06-30&type=ferie")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.type).toBe("ferie");
    expect(response.body.leaves[0].type).toBe("ferie");

    expect(LeaveRequest.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        type: "ferie",
      })
    );
  });

  it("filtra per username", async () => {
    mockUserFindOne({
      _id: "user-mario",
      username: "mario",
      role: "user",
    });

    mockLeaveRequestFind([]);

    const response = await request(app)
      .get("/api/admin/approved-leaves?from=2026-06-01&to=2026-06-30&username=mario")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(200);
    expect(response.body.username).toBe("mario");

    expect(User.findOne).toHaveBeenCalledWith({
      username: "mario",
    });

    expect(LeaveRequest.find).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "user-mario",
      })
    );
  });

  it("rifiuta un tipo assenza non valido", async () => {
    const response = await request(app)
      .get("/api/admin/approved-leaves?from=2026-06-01&to=2026-06-30&type=mutua")
      .set("Authorization", "Bearer fake-admin-token");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Tipo assenza non valido. Valori ammessi: ferie, pir"
    );

    expect(LeaveRequest.find).not.toHaveBeenCalled();
  });
});