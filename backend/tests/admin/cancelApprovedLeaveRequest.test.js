/**
 * tests/admin/cancelApprovedLeaveRequest.test.js
 *
 * Test API per POST /api/admin/leave-requests/:leaveId/cancel
 */

const request = require("supertest");
const mongoose = require("mongoose");

jest.mock("../../models/LeaveRequest");
jest.mock("../../models/User");
jest.mock("jsonwebtoken");

const LeaveRequest = require("../../models/LeaveRequest");
const User = require("../../models/User");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("POST /api/admin/leave-requests/:leaveId/cancel", () => {
  const adminUserId = new mongoose.Types.ObjectId().toString();
  const validLeaveId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: adminUserId,
      username: "admin",
      role: "admin",
    });

    User.findById.mockResolvedValue({
      _id: adminUserId,
      username: "admin",
      role: "admin",
      isActive: true,
    });
  });

  function authHeader() {
    return {
      Authorization: "Bearer valid-admin-token",
    };
  }

  function makeApprovedLeave(overrides = {}) {
    return {
      _id: validLeaveId,
      user: {
        _id: new mongoose.Types.ObjectId().toString(),
        username: "mario",
      },
      type: "ferie",
      status: "approved",
      reviewNote: "Approvata",
      reviewedAt: new Date("2026-05-20T10:00:00.000Z"),
      reviewedBy: adminUserId,
      save: jest.fn(),
      populate: jest.fn(),
      ...overrides,
    };
  }

  it("restituisce 400 se leaveId non è valido", async () => {
    const res = await request(app)
      .post("/api/admin/leave-requests/not-valid-id/cancel")
      .set(authHeader())
      .send({ reviewNote: "Errore inserimento ferie" });

    expect(res.status).toBe(400);
    expect(LeaveRequest.findById).not.toHaveBeenCalled();
  });

  it("restituisce 400 se manca reviewNote", async () => {
    const res = await request(app)
      .post(`/api/admin/leave-requests/${validLeaveId}/cancel`)
      .set(authHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(LeaveRequest.findById).not.toHaveBeenCalled();
  });

  it("restituisce 404 se la richiesta assenza non esiste", async () => {
    LeaveRequest.findById.mockResolvedValue(null);

    const res = await request(app)
        .post(`/api/admin/leave-requests/${validLeaveId}/cancel`)
        .set(authHeader())
        .send({ reviewNote: "Richiesta inserita per errore" });

    expect(res.status).toBe(404);
    expect(LeaveRequest.findById).toHaveBeenCalledWith(validLeaveId);
  });

  // MUTUA non è un tipo valido per cancellazione approvata, deve essere solo ferie o pir
  it("restituisce 400 se il tipo non è ferie o pir", async () => {
    const leave = makeApprovedLeave({ type: "mutua" });
    LeaveRequest.findById.mockResolvedValue(leave);

    const res = await request(app)
        .post(`/api/admin/leave-requests/${validLeaveId}/cancel`)
        .set(authHeader())
        .send({ reviewNote: "Richiesta non annullabile" });

    expect(res.status).toBe(400);
    expect(leave.save).not.toHaveBeenCalled();
  });

  // PENDING non è uno status valido per cancellazione approvata, deve essere solo approved
    it("restituisce 400 se la richiesta non è approvata", async () => {
        const leave = makeApprovedLeave({ status: "pending" });
        LeaveRequest.findById.mockResolvedValue(leave);

        const res = await request(app)
        .post(`/api/admin/leave-requests/${validLeaveId}/cancel`)
        .set(authHeader())
        .send({ reviewNote: "Richiesta non ancora approvata" });

    expect(res.status).toBe(400);
    expect(leave.save).not.toHaveBeenCalled();
  });

  // TEST POSITIVO: annullamento corretto di una richiesta ferie approvata
  it("annulla una richiesta ferie approvata", async () => {
    const leave = makeApprovedLeave();

    leave.save.mockResolvedValue(leave);

    LeaveRequest.findById
        .mockResolvedValueOnce(leave)
        .mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(leave),
        });

    const res = await request(app)
        .post(`/api/admin/leave-requests/${validLeaveId}/cancel`)
        .set(authHeader())
        .send({ reviewNote: "Ferie annullate su richiesta del dipendente" });

    expect(res.status).toBe(200);

    expect(leave.status).toBe("cancelled");
    expect(leave.reviewedBy).toBe(adminUserId);
    expect(leave.reviewedAt).toBeInstanceOf(Date);
    expect(leave.reviewNote).toBe("Ferie annullate su richiesta del dipendente");

    expect(leave.save).toHaveBeenCalledTimes(1);

    expect(res.body.message).toBe("Richiesta assenza annullata");
    expect(res.body.leave).toBeDefined();
  });
});