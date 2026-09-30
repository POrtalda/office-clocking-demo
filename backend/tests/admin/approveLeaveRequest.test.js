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
  test("approva un PIR orario anche se nello stesso giorno esiste una timbratura", async () => {
    const leaveId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const saveMock = jest.fn().mockResolvedValue();

    LeaveRequest.findById
      .mockResolvedValueOnce({
        _id: leaveId,
        user: userId,
        type: "pir",
        status: "pending",
        date: new Date("2026-04-29T00:00:00.000Z"),
        startDate: new Date("2026-04-29T00:00:00.000Z"),
        endDate: new Date("2026-04-29T23:59:59.999Z"),
        hours: 2,
        startTime: "14:00",
        endTime: "16:00",
        save: saveMock,
      })
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              _id: leaveId,
              user: {
                _id: userId,
                username: "utente",
                role: "user",
              },
              type: "pir",
              status: "approved",
              hours: 2,
              startTime: "14:00",
              endTime: "16:00",
            }),
          }),
        }),
      });

    LeaveRequest.findOne.mockResolvedValue(null);

    TimeRecord.findOne.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      user: userId,
      clockIn: new Date("2026-04-29T08:00:00.000Z"),
    });

    const res = await request(app)
      .post(`/api/admin/leave-requests/${leaveId}/approve`)
      .set("Authorization", "Bearer token-admin")
      .send({});

    expect(res.statusCode).toBe(200);
    expect(saveMock).toHaveBeenCalled();
  });
});
