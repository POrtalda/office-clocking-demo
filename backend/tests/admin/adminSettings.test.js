const request = require("supertest");

jest.mock("../../models/AppSettings");
jest.mock("jsonwebtoken");

const AppSettings = require("../../models/AppSettings");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("Admin settings routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "admin123",
      username: "admin",
      role: "admin",
    });
  });

  test("GET /api/admin/settings restituisce le impostazioni globali", async () => {
    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: [],
      }),
    });

    const res = await request(app)
      .get("/api/admin/settings")
      .set("Authorization", "Bearer token-admin");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      settings: {
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: [],
      },
    });

    expect(AppSettings.findOneAndUpdate).toHaveBeenCalledWith(
      { key: "global" },
      { $setOnInsert: { key: "global" } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  test("PATCH /api/admin/settings aggiorna i giorni minimi di anticipo", async () => {
    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 5,
        leaveNotificationEmails: [],
      }),
    });

    const res = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", "Bearer token-admin")
      .send({
        leaveMinAdvanceDays: 5,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: "Impostazioni aggiornate correttamente",
      settings: {
        leaveMinAdvanceDays: 5,
        leaveNotificationEmails: [],
      },
    });

    expect(AppSettings.findOneAndUpdate).toHaveBeenCalledWith(
      { key: "global" },
      {
        $set: {
          key: "global",
          leaveMinAdvanceDays: 5,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  test("PATCH /api/admin/settings aggiorna le email di notifica ferie/PIR", async () => {
    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: ["admin@example.com", "hr@example.com"],
      }),
    });

    const res = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", "Bearer token-admin")
      .send({
        leaveNotificationEmails: [
          "admin@example.com",
          "HR@example.com",
          " admin@example.com ",
        ],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: "Impostazioni aggiornate correttamente",
      settings: {
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: ["admin@example.com", "hr@example.com"],
      },
    });

    expect(AppSettings.findOneAndUpdate).toHaveBeenCalledWith(
      { key: "global" },
      {
        $set: {
          key: "global",
          leaveNotificationEmails: ["admin@example.com", "hr@example.com"],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  test("PATCH /api/admin/settings accetta una lista vuota di email notifica", async () => {
    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: [],
      }),
    });

    const res = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", "Bearer token-admin")
      .send({
        leaveNotificationEmails: [],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.settings.leaveNotificationEmails).toEqual([]);

    expect(AppSettings.findOneAndUpdate).toHaveBeenCalledWith(
      { key: "global" },
      {
        $set: {
          key: "global",
          leaveNotificationEmails: [],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  });

  test("PATCH /api/admin/settings rifiuta email di notifica non valide", async () => {
    const res = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", "Bearer token-admin")
      .send({
        leaveNotificationEmails: ["admin@example.com", "email-non-valida"],
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_LEAVE_NOTIFICATION_EMAIL");
    expect(AppSettings.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("PATCH /api/admin/settings rifiuta valori non validi", async () => {
    const res = await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", "Bearer token-admin")
      .send({
        leaveMinAdvanceDays: -1,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_LEAVE_MIN_ADVANCE_DAYS");
    expect(res.body.message).toBe(
      "Il numero di giorni di anticipo deve essere un intero tra 0 e 365"
    );

    expect(AppSettings.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
