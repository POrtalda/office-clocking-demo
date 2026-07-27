const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../../models/TimeRecord");
jest.mock("../../models/LeaveRequest");
jest.mock("jsonwebtoken");

const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("POST /api/admin/leave-requests/:leaveId/reject", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin123",
      username: "admin",
      role: "admin",
    });
  });

  test("blocca il rifiuto ferie se manca la motivazione", async () => {
    const leaveId = new mongoose.Types.ObjectId();

    LeaveRequest.findById.mockResolvedValue({
      _id: leaveId,
      user: new mongoose.Types.ObjectId(),
      type: "ferie",
      status: "pending",
      date: new Date("2026-04-29T00:00:00.000Z"),
      save: jest.fn(),
    });

    const res = await request(app)
      .post(`/api/admin/leave-requests/${leaveId}/reject`)
      .set("Authorization", "Bearer token-admin")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("LEAVE_REJECTION_REASON_REQUIRED");
    expect(res.body.message).toBe(
      "La motivazione del rifiuto è obbligatoria per ferie e PIR"
    );
  });

  test("blocca il rifiuto PIR se manca la motivazione", async () => {
    const leaveId = new mongoose.Types.ObjectId();

    LeaveRequest.findById.mockResolvedValue({
      _id: leaveId,
      user: new mongoose.Types.ObjectId(),
      type: "pir",
      status: "pending",
      date: new Date("2026-04-29T00:00:00.000Z"),
      save: jest.fn(),
    });

    const res = await request(app)
      .post(`/api/admin/leave-requests/${leaveId}/reject`)
      .set("Authorization", "Bearer token-admin")
      .send({ reviewNote: "   " });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("LEAVE_REJECTION_REASON_REQUIRED");
    expect(res.body.message).toBe(
      "La motivazione del rifiuto è obbligatoria per ferie e PIR"
    );
  });

  test("rifiuta ferie con motivazione e salva la reviewNote", async () => {
    const leaveId = new mongoose.Types.ObjectId();
    const saveMock = jest.fn().mockResolvedValue(true);

    const leave = {
      _id: leaveId,
      user: new mongoose.Types.ObjectId(),
      type: "ferie",
      status: "pending",
      date: new Date("2026-04-29T00:00:00.000Z"),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: "",
      save: saveMock,
    };

    LeaveRequest.findById
      .mockResolvedValueOnce(leave)
      .mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          ...leave,
          status: "rejected",
          reviewedBy: {
            _id: "admin123",
            username: "admin",
            role: "admin",
          },
          reviewNote: "Periodo non approvabile",
        }),
      });

    const res = await request(app)
      .post(`/api/admin/leave-requests/${leaveId}/reject`)
      .set("Authorization", "Bearer token-admin")
      .send({ reviewNote: "Periodo non approvabile" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Richiesta assenza rifiutata");

    expect(leave.status).toBe("rejected");
    expect(leave.reviewedAt).toEqual(expect.any(Date));
    expect(leave.reviewedBy).toBe("admin123");
    expect(leave.reviewNote).toBe("Periodo non approvabile");
    expect(saveMock).toHaveBeenCalled();
  });
});