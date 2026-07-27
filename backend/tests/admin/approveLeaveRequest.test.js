const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../../models/TimeRecord");
jest.mock("../../models/LeaveRequest");
jest.mock("jsonwebtoken");

const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("POST /api/admin/leave-requests/:leaveId/approve", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin123",
      username: "admin",
      role: "admin",
    });

    LeaveRequest.findOne.mockResolvedValue(null);
    TimeRecord.findOne.mockResolvedValue(null);
  });

  test("blocca l'approvazione se nello stesso giorno esiste gia un'assenza approvata", async () => {
    const leaveId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    LeaveRequest.findById.mockResolvedValue({
      _id: leaveId,
      user: userId,
      type: "ferie",
      status: "pending",
      date: new Date("2026-04-29T00:00:00.000Z"),
      save: jest.fn(),
    });

    LeaveRequest.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      user: userId,
      type: "mutua",
      status: "approved",
      date: new Date("2026-04-29T00:00:00.000Z"),
    });

    const res = await request(app)
      .post(`/api/admin/leave-requests/${leaveId}/approve`)
      .set("Authorization", "Bearer token-admin")
      .send({});

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("APPROVED_LEAVE_ALREADY_PRESENT");
    expect(res.body.message).toBe(
      "Non puoi approvare questa assenza: esiste gia un'assenza approvata nello stesso giorno."
    );

    expect(TimeRecord.findOne).not.toHaveBeenCalled();
  });
});
