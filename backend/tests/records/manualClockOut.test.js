/**
 * tests/records/manualClockOut.test.js
 *
 * Test API per POST /api/records/request-manual-clock-out
 */

const request = require("supertest");

jest.mock("../../models/TimeRecord");
jest.mock("jsonwebtoken");

const TimeRecord = require("../../models/TimeRecord");
const jwt = require("jsonwebtoken");

const app = require("../../app");

describe("POST /api/records/request-manual-clock-out", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jwt.verify.mockReturnValue({
      id: "user123",
      username: "mario",
      role: "user",
    });
  });

  test("restituisce 400 se mancano i campi richiesti", async () => {
    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Campi richiesti: recordId, date, time");
    expect(TimeRecord.findById).not.toHaveBeenCalled();
  });

  test("restituisce 404 se il record non esiste", async () => {
    TimeRecord.findById.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        recordId: "record123",
        date: "2026-03-25",
        time: "18:00",
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Record non trovato");
    expect(TimeRecord.findById).toHaveBeenCalledWith("record123");
  });

  test("restituisce 403 se il record appartiene a un altro utente", async () => {
    TimeRecord.findById.mockResolvedValue({
      _id: "record123",
      user: "other-user",
      clockIn: new Date("2026-03-24T08:00:00.000Z"),
      clockOut: null,
      status: "open",
    });

    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        recordId: "record123",
        date: "2026-03-25",
        time: "18:00",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe(
      "Non puoi modificare un record di un altro utente"
    );
  });

  test("restituisce 400 se il record non consente una chiusura manuale", async () => {
    TimeRecord.findById.mockResolvedValue({
      _id: "record123",
      user: "user123",
      clockIn: new Date(),
      clockOut: null,
      status: "open",
    });

    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        recordId: "record123",
        date: "2026-03-25",
        time: "18:00",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Il record non è in uno stato che consente una chiusura manuale"
    );
  });

  test("restituisce 400 se l'orario proposto è precedente all'entrata", async () => {
    const record = {
      _id: "record123",
      user: "user123",
      clockIn: new Date("2026-03-25T10:00:00.000Z"),
      clockOut: null,
      status: "manual_closure_rejected",
      save: jest.fn(),
    };

    TimeRecord.findById.mockResolvedValue(record);

    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        recordId: "record123",
        date: "2026-03-25",
        time: "09:00",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "L'orario di uscita proposto deve essere successivo all'orario di entrata"
    );
    expect(record.save).not.toHaveBeenCalled();
  });

  test("restituisce 400 se l'orario proposto è nel futuro", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    const futureDate = `${yyyy}-${mm}-${dd}`;

    const record = {
      _id: "record123",
      user: "user123",
      clockIn: yesterday,
      clockOut: null,
      status: "open",
      save: jest.fn(),
    };

    TimeRecord.findById.mockResolvedValue(record);

    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        recordId: "record123",
        date: futureDate,
        time: "12:00",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "L'orario di uscita proposto non può essere nel futuro"
    );
    expect(record.save).not.toHaveBeenCalled();
  });

  test("restituisce 400 se la durata proposta supera 12 ore", async () => {
    const record = {
      _id: "record123",
      user: "user123",
      clockIn: new Date("2026-03-24T06:00:00.000Z"),
      clockOut: null,
      status: "manual_closure_rejected",
      save: jest.fn(),
    };

    TimeRecord.findById.mockResolvedValue(record);

    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        recordId: "record123",
        date: "2026-03-24",
        time: "20:30",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "La durata proposta supera il limite massimo di 12 ore"
    );
    expect(record.save).not.toHaveBeenCalled();
  });

  test("restituisce 200 e salva la richiesta di chiusura manuale se valida", async () => {
    const record = {
      _id: "record123",
      user: "user123",
      clockIn: new Date("2026-03-25T08:00:00.000Z"),
      clockOut: null,
      status: "manual_closure_rejected",
      manualClosureRequest: null,
      save: jest.fn().mockResolvedValue(true),
    };

    TimeRecord.findById.mockResolvedValue(record);

    const res = await request(app)
      .post("/api/records/request-manual-clock-out")
      .set("Authorization", "Bearer token-valido")
      .send({
        recordId: "record123",
        date: "2026-03-25",
        time: "18:00",
        note: "Ho dimenticato di timbrare l'uscita",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe(
      "Richiesta di chiusura manuale inviata con successo"
    );

    expect(record.status).toBe("pending_manual_closure");
    expect(record.manualClosureRequest).toBeTruthy();
    expect(record.manualClosureRequest.note).toBe(
      "Ho dimenticato di timbrare l'uscita"
    );
    expect(record.manualClosureRequest.proposedClockOut).toEqual(expect.any(Date));
    expect(record.save).toHaveBeenCalled();
  });
});