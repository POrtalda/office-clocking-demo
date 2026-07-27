const request = require("supertest");

jest.mock("../../models/LeaveRequest");
jest.mock("jsonwebtoken");

const LeaveRequest = require("../../models/LeaveRequest");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("GET /api/leaves/my", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Simuliamo un utente autenticato valido.
    jwt.verify.mockReturnValue({
      id: "user123",
      username: "mario",
      role: "user",
    });
  });

  test("recupera le ferie su periodo anche filtrando un giorno interno al range", async () => {
    const leaves = [
      {
        _id: "leave-ferie-range-123",
        user: "user123",
        type: "ferie",
        status: "pending",
        date: new Date("2026-06-10T00:00:00.000Z"),
        startDate: new Date("2026-06-10T00:00:00.000Z"),
        endDate: new Date("2026-06-16T00:00:00.000Z"),
        note: "Vacanza",
      },
    ];

    const sortMock = jest.fn().mockResolvedValue(leaves);
    LeaveRequest.find.mockReturnValue({
      sort: sortMock,
    });

    const res = await request(app)
      .get("/api/leaves/my?date=2026-06-12")
      .set("Authorization", "Bearer token-valido");

    expect(res.statusCode).toBe(200);
    expect(res.body.leaves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: "leave-ferie-range-123",
          type: "ferie",
          status: "pending",
          note: "Vacanza",
        }),
      ])
    );

    expect(LeaveRequest.find).toHaveBeenCalledWith({
      user: "user123",
      $or: [
        {
          startDate: {
            $lte: expect.any(Date),
          },
          endDate: {
            $gte: expect.any(Date),
          },
        },
        {
          date: {
            $gte: expect.any(Date),
            $lte: expect.any(Date),
          },
        },
      ],
    });

    expect(sortMock).toHaveBeenCalledWith({
        date: -1,
        createdAt: -1,
        });
  });
});