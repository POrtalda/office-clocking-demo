const request = require("supertest");

jest.mock("../../models/TimeRecord");
jest.mock("../../models/LeaveRequest");
jest.mock("../../models/AppSettings");
jest.mock("../../utils/email");
jest.mock("jsonwebtoken");

const TimeRecord = require("../../models/TimeRecord");
const LeaveRequest = require("../../models/LeaveRequest");
const AppSettings = require("../../models/AppSettings");
const { sendEmail } = require("../../utils/email");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("POST /api/leaves/:type", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    sendEmail.mockResolvedValue({ skipped: false });

    // Simuliamo un utente autenticato valido.
    jwt.verify.mockReturnValue({
      id: "user123",
      username: "mario",
      role: "user",
    });

    // Default: nessuna assenza esistente e nessuna timbratura nel giorno/periodo.
    LeaveRequest.findOne.mockResolvedValue(null);
    TimeRecord.findOne.mockResolvedValue(null);

    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
      }),
    });
  });

  test("blocca una nuova mutua se oggi esiste gia una richiesta ferie attiva", async () => {
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave-ferie-123",
      user: "user123",
      type: "ferie",
      status: "approved",
      date: new Date(),
    });

    const res = await request(app)
      .post("/api/leaves/mutua")
      .set("Authorization", "Bearer token-valido")
      .send({ note: "febbre" });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("LEAVE_ALREADY_PRESENT");
    expect(res.body.message).toBe(
      "Hai gia inserito un'assenza per il giorno selezionato (ferie)."
    );

    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  test("crea una richiesta ferie su periodo startDate/endDate", async () => {
    const createdLeave = {
      _id: "leave-ferie-range-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      date: new Date("2026-06-10T00:00:00.000Z"),
      startDate: new Date("2026-06-10T00:00:00.000Z"),
      endDate: new Date("2026-06-16T00:00:00.000Z"),
      note: "Vacanza",
    };

    LeaveRequest.create.mockResolvedValue(createdLeave);

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate: "2026-06-10",
        endDate: "2026-06-16",
        note: "Vacanza",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Richiesta ferie inviata con successo.");

    expect(LeaveRequest.findOne).toHaveBeenCalledWith({
      user: "user123",
      status: { $in: ["approved", "pending"] },
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

    expect(TimeRecord.findOne).toHaveBeenCalledWith({
      user: "user123",
      clockIn: {
        $gte: expect.any(Date),
        $lte: expect.any(Date),
      },
    });

    expect(LeaveRequest.create).toHaveBeenCalledWith({
      user: "user123",
      type: "ferie",
      status: "pending",
      date: expect.any(Date),
      startDate: expect.any(Date),
      endDate: expect.any(Date),
      note: "Vacanza",
    });
  });

  test("blocca una richiesta ferie se il periodo si sovrappone a un'assenza attiva", async () => {
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave-existing-123",
      user: "user123",
      type: "ferie",
      status: "approved",
      startDate: new Date("2026-06-12T00:00:00.000Z"),
      endDate: new Date("2026-06-14T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate: "2026-06-10",
        endDate: "2026-06-16",
        note: "Vacanza",
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("LEAVE_ALREADY_PRESENT");
    expect(res.body.message).toBe(
      "Hai gia inserito un'assenza per il periodo selezionato (ferie)."
    );

    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  test("blocca una richiesta ferie se esiste una timbratura nel periodo selezionato", async () => {
    TimeRecord.findOne.mockResolvedValue({
      _id: "record-existing-123",
      user: "user123",
      clockIn: new Date("2026-06-12T08:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate: "2026-06-10",
        endDate: "2026-06-16",
        note: "Vacanza",
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("TIMERECORD_ALREADY_PRESENT");
    expect(res.body.message).toBe(
      "Non puoi inserire ferie: esiste gia una timbratura nel periodo selezionato."
    );

    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  test("consente una richiesta PIR se esiste una ferie attiva non sovrapposta", async () => {
    const createdPir = {
      _id: "leave-pir-123",
      user: "user123",
      type: "pir",
      status: "pending",
      date: new Date("2026-06-20T00:00:00.000Z"),
      startDate: new Date("2026-06-20T00:00:00.000Z"),
      endDate: new Date("2026-06-20T00:00:00.000Z"),
      note: "Permesso",
    };

    LeaveRequest.findOne.mockResolvedValue(null);
    TimeRecord.findOne.mockResolvedValue(null);

    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
      }),
    });
    LeaveRequest.create.mockResolvedValue(createdPir);

    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: "2026-06-20",
        note: "Permesso",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Richiesta PIR inviata con successo.");

    expect(LeaveRequest.findOne).toHaveBeenCalledWith({
      user: "user123",
      status: { $in: ["approved", "pending"] },
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

    expect(TimeRecord.findOne).toHaveBeenCalledWith({
      user: "user123",
      clockIn: expect.objectContaining({
        $gte: expect.any(Date),
        $lt: expect.any(Date),
      }),
    });

    expect(LeaveRequest.create).toHaveBeenCalledWith({
      user: "user123",
      type: "pir",
      status: "pending",
      date: expect.any(Date),
      startDate: expect.any(Date),
      endDate: expect.any(Date),
      note: "Permesso",
    });
  });

  test("blocca una richiesta PIR se il giorno scelto si sovrappone a ferie attive", async () => {
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave-ferie-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      startDate: new Date("2026-06-10T00:00:00.000Z"),
      endDate: new Date("2026-06-16T00:00:00.000Z"),
    });

    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: "2026-06-12",
        note: "Permesso",
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("LEAVE_ALREADY_PRESENT");
    expect(res.body.message).toBe(
      "Hai gia inserito un'assenza per il giorno selezionato (ferie)."
    );

    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });
  test("blocca una richiesta ferie se non rispetta i giorni minimi di anticipo", async () => {
    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 30,
      }),
    });

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate: "2026-06-10",
        endDate: "2026-06-16",
        note: "Vacanza troppo vicina",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("LEAVE_MIN_ADVANCE_NOT_RESPECTED");
    expect(res.body.message).toBe(
      "La richiesta deve essere inviata con almeno 30 giorni di anticipo."
    );

    expect(LeaveRequest.findOne).not.toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  test("blocca una richiesta PIR se non rispetta i giorni minimi di anticipo", async () => {
    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 30,
      }),
    });

    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: "2026-06-10",
        note: "Permesso troppo vicino",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("LEAVE_MIN_ADVANCE_NOT_RESPECTED");
    expect(res.body.message).toBe(
      "La richiesta deve essere inviata con almeno 30 giorni di anticipo."
    );

    expect(LeaveRequest.findOne).not.toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });

  test("invia email agli admin quando viene creata una richiesta ferie", async () => {
    const createdLeave = {
      _id: "leave-ferie-email-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      date: new Date("2026-06-10T00:00:00.000Z"),
      startDate: new Date("2026-06-10T00:00:00.000Z"),
      endDate: new Date("2026-06-16T00:00:00.000Z"),
      note: "Vacanza",
    };

    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: ["admin@example.com", "hr@example.com"],
      }),
    });

    LeaveRequest.create.mockResolvedValue(createdLeave);

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate: "2026-06-10",
        endDate: "2026-06-16",
        note: "Vacanza",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Richiesta ferie inviata con successo.");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["admin@example.com", "hr@example.com"],
        subject: "Nuova richiesta Ferie - mario",
        text: expect.stringContaining("Utente: mario"),
      })
    );

    expect(sendEmail.mock.calls[0][0].text).toEqual(
      expect.stringContaining("Tipo richiesta: Ferie")
    );
    expect(sendEmail.mock.calls[0][0].text).toEqual(
      expect.stringContaining("Stato: In attesa")
    );
  });

  test("invia email agli admin quando viene creata una richiesta PIR", async () => {
    const createdPir = {
      _id: "leave-pir-email-123",
      user: "user123",
      type: "pir",
      status: "pending",
      date: new Date("2026-06-20T00:00:00.000Z"),
      startDate: new Date("2026-06-20T00:00:00.000Z"),
      endDate: new Date("2026-06-20T00:00:00.000Z"),
      note: "Permesso",
    };

    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: ["admin@example.com"],
      }),
    });

    LeaveRequest.create.mockResolvedValue(createdPir);

    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: "2026-06-20",
        note: "Permesso",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Richiesta PIR inviata con successo.");

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["admin@example.com"],
        subject: "Nuova richiesta PIR - mario",
        text: expect.stringContaining("Tipo richiesta: PIR"),
      })
    );
  });

  test("crea comunque la richiesta ferie se l'invio email fallisce", async () => {

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => { });

    const createdLeave = {
      _id: "leave-ferie-email-error-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      date: new Date("2026-06-10T00:00:00.000Z"),
      startDate: new Date("2026-06-10T00:00:00.000Z"),
      endDate: new Date("2026-06-16T00:00:00.000Z"),
      note: "Vacanza",
    };

    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 2,
        leaveNotificationEmails: ["admin@example.com"],
      }),
    });

    LeaveRequest.create.mockResolvedValue(createdLeave);
    sendEmail.mockRejectedValueOnce(new Error("SMTP error"));

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate: "2026-06-10",
        endDate: "2026-06-16",
        note: "Vacanza",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Richiesta ferie inviata con successo.");

    expect(LeaveRequest.create).toHaveBeenCalledWith({
      user: "user123",
      type: "ferie",
      status: "pending",
      date: expect.any(Date),
      startDate: expect.any(Date),
      endDate: expect.any(Date),
      note: "Vacanza",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Errore invio email notifica ferie/PIR",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
