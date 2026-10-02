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

const futureDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
};

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
    const startDate = futureDate(10);
    const endDate = futureDate(16);
    const createdLeave = {
      _id: "leave-ferie-range-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      date: new Date(`${startDate}T00:00:00.000Z`),
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
      note: "Vacanza",
    };

    LeaveRequest.create.mockResolvedValue(createdLeave);

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate,
        endDate,
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
    const startDate = futureDate(10);
    const existingStartDate = futureDate(12);
    const existingEndDate = futureDate(14);
    const endDate = futureDate(16);
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave-existing-123",
      user: "user123",
      type: "ferie",
      status: "approved",
      startDate: new Date(`${existingStartDate}T00:00:00.000Z`),
      endDate: new Date(`${existingEndDate}T00:00:00.000Z`),
    });

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate,
        endDate,
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
    const startDate = futureDate(10);
    const recordDate = futureDate(12);
    const endDate = futureDate(16);
    TimeRecord.findOne.mockResolvedValue({
      _id: "record-existing-123",
      user: "user123",
      clockIn: new Date(`${recordDate}T08:00:00.000Z`),
    });

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate,
        endDate,
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
    const pirDate = futureDate(20);
    const createdPir = {
      _id: "leave-pir-123",
      user: "user123",
      type: "pir",
      status: "pending",
      date: new Date(`${pirDate}T00:00:00.000Z`),
      startDate: new Date(`${pirDate}T00:00:00.000Z`),
      endDate: new Date(`${pirDate}T00:00:00.000Z`),
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
        date: pirDate,
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
    const ferieStartDate = futureDate(10);
    const pirDate = futureDate(12);
    const ferieEndDate = futureDate(16);
    LeaveRequest.findOne.mockResolvedValue({
      _id: "leave-ferie-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      startDate: new Date(`${ferieStartDate}T00:00:00.000Z`),
      endDate: new Date(`${ferieEndDate}T00:00:00.000Z`),
    });

    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: pirDate,
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
    const startDate = futureDate(10);
    const endDate = futureDate(16);

    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 30,
      }),
    });

    const res = await request(app)
      .post("/api/leaves/ferie")
      .set("Authorization", "Bearer token-valido")
      .send({
        startDate,
        endDate,
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
    const pirDate = futureDate(10);

    AppSettings.findOneAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        leaveMinAdvanceDays: 30,
      }),
    });

    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: pirDate,
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
    const startDate = futureDate(10);
    const endDate = futureDate(16);

    const createdLeave = {
      _id: "leave-ferie-email-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      date: new Date(`${startDate}T00:00:00.000Z`),
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
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
        startDate,
        endDate,
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
    const pirDate = futureDate(20);

    const createdPir = {
      _id: "leave-pir-email-123",
      user: "user123",
      type: "pir",
      status: "pending",
      date: new Date(`${pirDate}T00:00:00.000Z`),
      startDate: new Date(`${pirDate}T00:00:00.000Z`),
      endDate: new Date(`${pirDate}T00:00:00.000Z`),
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
        date: pirDate,
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
    const startDate = futureDate(10);
    const endDate = futureDate(16);

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => { });

    const createdLeave = {
      _id: "leave-ferie-email-error-123",
      user: "user123",
      type: "ferie",
      status: "pending",
      date: new Date(`${startDate}T00:00:00.000Z`),
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
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
        startDate,
        endDate,
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
  test("crea un PIR orario di 3 ore e calcola automaticamente l'orario di fine", async () => {
    const createdPir = {
      _id: "leave-pir-hourly-123",
      user: "user123",
      type: "pir",
      status: "pending",
      date: new Date("2027-06-15T00:00:00.000Z"),
      hours: 3,
      startTime: "10:00",
      endTime: "13:00",
      note: "Visita personale",
    };

    LeaveRequest.findOne.mockResolvedValue(null);
    LeaveRequest.create.mockResolvedValue(createdPir);

    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: "2027-06-15",
        hours: 3,
        startTime: "10:00",
        note: "Visita personale",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Richiesta PIR inviata con successo.");

    expect(LeaveRequest.create).toHaveBeenCalledWith({
      user: "user123",
      type: "pir",
      status: "pending",
      date: expect.any(Date),
      startDate: expect.any(Date),
      endDate: expect.any(Date),
      hours: 3,
      startTime: "10:00",
      endTime: "13:00",
      note: "Visita personale",
    });

    // Un PIR orario deve poter convivere con le timbrature
    // della stessa giornata.
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
  });
  test("rifiuta un PIR orario superiore a 8 ore", async () => {
    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: futureDate(10),
        hours: 9,
        startTime: "08:00",
        note: "Permesso troppo lungo",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_PIR_HOURS");

    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });
  test("rifiuta un PIR orario senza ora di inizio", async () => {
    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: futureDate(10),
        hours: 2,
        note: "Permesso senza orario",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_PIR_START_TIME");

    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });
  test("rifiuta un PIR orario che termina il giorno successivo", async () => {
    const res = await request(app)
      .post("/api/leaves/pir")
      .set("Authorization", "Bearer token-valido")
      .send({
        date: futureDate(10),
        hours: 5,
        startTime: "20:00",
        note: "Permesso oltre mezzanotte",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("INVALID_PIR_TIME_RANGE");

    expect(LeaveRequest.create).not.toHaveBeenCalled();
  });
});
