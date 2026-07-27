const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const app = require("../../app.js");
const User = require("../../models/User.js");
const TimeRecord = require("../../models/TimeRecord.js");

describe("Admin users routes", () => {
  let adminToken;
  let userToken;
  let originalDemoMode;

  beforeAll(() => {
    originalDemoMode = process.env.DEMO_MODE;
  });

  beforeEach(() => {
    process.env.DEMO_MODE = "false";

    // Token valido di admin
    adminToken = jwt.sign(
      {
        id: new mongoose.Types.ObjectId().toString(),
        username: "admin",
        role: "admin",
      },
      process.env.JWT_SECRET
    );

    // Token valido di utente normale
    userToken = jwt.sign(
      {
        id: new mongoose.Types.ObjectId().toString(),
        username: "mario",
        role: "user",
      },
      process.env.JWT_SECRET
    );
  });

  afterEach(() => {
    process.env.DEMO_MODE = "false";

    // Ripulisce tutti gli spy/mock tra un test e l'altro
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalDemoMode === undefined) {
      delete process.env.DEMO_MODE;
    } else {
      process.env.DEMO_MODE = originalDemoMode;
    }
  });

  // ==========================================================================
  // GET /api/admin/users
  // ==========================================================================

  describe("GET /api/admin/users", () => {
    test("restituisce 401 senza token", async () => {
      const res = await request(app).get("/api/admin/users");

      expect(res.status).toBe(401);
    });

    test("restituisce 403 con utente non admin", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    test("restituisce 200 con admin autenticato", async () => {
      jest.spyOn(User, "find").mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([
              {
                _id: "1",
                username: "mario",
                role: "user",
                isActive: true,
                fullName: "",
                email: "",
                createdAt: "2026-04-01T10:00:00.000Z",
                updatedAt: "2026-04-01T10:00:00.000Z",
              },
              {
                _id: "2",
                username: "luca",
                role: "user",
                isActive: false,
                fullName: "",
                email: "",
                createdAt: "2026-04-01T10:00:00.000Z",
                updatedAt: "2026-04-01T10:00:00.000Z",
              },
            ]),
          }),
        }),
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0].username).toBe("mario");
      expect(res.body.users[1].username).toBe("luca");
    });
  });

  // ==========================================================================
  // POST /api/admin/users
  // ==========================================================================

  describe("POST /api/admin/users", () => {
    test("restituisce 401 senza token", async () => {
      const res = await request(app).post("/api/admin/users").send({
        username: "nuovoutente",
        password: "1234",
        role: "user",
      });

      expect(res.status).toBe(401);
    });

    test("restituisce 403 con utente non admin", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          username: "nuovoutente",
          password: "1234",
          role: "user",
        });

      expect(res.status).toBe(403);
    });

    test("restituisce 400 se mancano username e password", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Username e password sono obbligatori");
    });

    test("restituisce 400 se la password è troppo corta", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          username: "nuovoutente",
          password: "123",
          role: "user",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "La password deve contenere almeno 4 caratteri"
      );
    });

    test("restituisce 400 se il ruolo non è valido", async () => {
      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          username: "nuovoutente",
          password: "1234",
          role: "manager",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Ruolo non valido. Valori ammessi: admin, user"
      );
    });

    test("restituisce 409 se username già esistente", async () => {
      jest.spyOn(User, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "1",
          username: "mario",
          role: "user",
        }),
      });

      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          username: "mario",
          password: "1234",
          role: "user",
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Username già esistente");
    });

    test("restituisce 201 e crea un utente correttamente", async () => {
      jest.spyOn(User, "findOne").mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      jest.spyOn(bcrypt, "hash").mockResolvedValue("hashed-password");

      jest.spyOn(User, "create").mockResolvedValue({
        _id: "123",
        username: "nuovoutente",
        password: "hashed-password",
        role: "user",
        isActive: true,
        fullName: "Nuovo Utente",
        email: "nuovo@example.com",
        createdAt: "2026-04-02T10:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z",
      });

      const res = await request(app)
        .post("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          username: "NuovoUtente",
          password: "1234",
          role: "user",
          fullName: "Nuovo Utente",
          email: "nuovo@example.com",
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Utente creato con successo");
      expect(res.body.user.username).toBe("nuovoutente");
      expect(res.body.user.role).toBe("user");
      expect(res.body.user.isActive).toBe(true);
      expect(res.body.user.fullName).toBe("Nuovo Utente");
      expect(res.body.user.email).toBe("nuovo@example.com");
    });
  });

  // ==========================================================================
  // PATCH /api/admin/users/:id/status
  // ==========================================================================

  describe("PATCH /api/admin/users/:id/status", () => {
    test("restituisce 401 senza token", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/status`)
        .send({ isActive: false });

      expect(res.status).toBe(401);
    });

    test("restituisce 403 con utente non admin", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/status`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
    });

    test("restituisce 403 se DEMO_MODE=true", async () => {
      process.env.DEMO_MODE = "true";

      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: "Azione disabilitata nella versione demo",
        code: "DEMO_MODE_BLOCKED",
      });
    });

    test("restituisce 400 se isActive non è booleano", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: "false" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Il campo isActive è obbligatorio e deve essere booleano"
      );
    });

    test("restituisce 400 se l'admin prova a disattivare sé stesso", async () => {
      const selfId = new mongoose.Types.ObjectId().toString();

      const selfAdminToken = jwt.sign(
        {
          id: selfId,
          username: "admin",
          role: "admin",
        },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .patch(`/api/admin/users/${selfId}/status`)
        .set("Authorization", `Bearer ${selfAdminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Non puoi disattivare il tuo stesso account admin"
      );
    });

    test("restituisce 404 se l'utente non esiste", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(User, "findById").mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Utente non trovato");
    });

    test("restituisce 200 e aggiorna correttamente lo stato utente", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const saveMock = jest.fn().mockResolvedValue();

      jest.spyOn(User, "findById").mockResolvedValue({
        _id: userId,
        username: "luca",
        role: "user",
        isActive: true,
        fullName: "",
        email: "",
        createdAt: "2026-04-02T10:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z",
        save: saveMock,
      });

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Utente disattivato con successo");
      expect(res.body.user.username).toBe("luca");
      expect(res.body.user.isActive).toBe(false);
      expect(saveMock).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // PATCH /api/admin/users/:id/password
  // ==========================================================================

  describe("PATCH /api/admin/users/:id/password", () => {
    test("restituisce 401 senza token", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/password`)
        .send({ password: "nuovapassword" });

      expect(res.status).toBe(401);
    });

    test("restituisce 403 con utente non admin", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/password`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ password: "nuovapassword" });

      expect(res.status).toBe(403);
    });

    test("restituisce 403 se DEMO_MODE=true", async () => {
      process.env.DEMO_MODE = "true";

      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ password: "1234" });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: "Azione disabilitata nella versione demo",
        code: "DEMO_MODE_BLOCKED",
      });
    });

    test("restituisce 400 se manca la password", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("La password è obbligatoria");
    });

    test("restituisce 400 se la password è troppo corta", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ password: "123" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "La password deve contenere almeno 4 caratteri"
      );
    });

    test("restituisce 404 se l'utente non esiste", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(User, "findById").mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ password: "1234" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Utente non trovato");
    });

    test("restituisce 200 e aggiorna correttamente la password", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const saveMock = jest.fn().mockResolvedValue();

      jest.spyOn(User, "findById").mockResolvedValue({
        _id: userId,
        username: "luca",
        role: "user",
        isActive: true,
        fullName: "",
        email: "",
        password: "old-hash",
        createdAt: "2026-04-02T10:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z",
        save: saveMock,
      });

      jest.spyOn(bcrypt, "hash").mockResolvedValue("new-hashed-password");

      const res = await request(app)
        .patch(`/api/admin/users/${userId}/password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ password: "1234" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password aggiornata con successo");
      expect(res.body.user.username).toBe("luca");
      expect(bcrypt.hash).toHaveBeenCalledWith("1234", 10);
      expect(saveMock).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // DELETE /api/admin/users/:id
  // ==========================================================================

  describe("DELETE /api/admin/users/:id", () => {
    test("restituisce 401 senza token", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app).delete(`/api/admin/users/${userId}`);

      expect(res.status).toBe(401);
    });

    test("restituisce 403 con utente non admin", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    test("restituisce 403 se DEMO_MODE=true", async () => {
      process.env.DEMO_MODE = "true";

      const userId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: "Azione disabilitata nella versione demo",
        code: "DEMO_MODE_BLOCKED",
      });
    });

    test("restituisce 400 se l'id utente non è valido", async () => {
      const res = await request(app)
        .delete("/api/admin/users/id-non-valido")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("ID utente non valido");
    });

    test("restituisce 400 se l'admin prova a cancellare sé stesso", async () => {
      const selfId = new mongoose.Types.ObjectId().toString();

      const selfAdminToken = jwt.sign(
        {
          id: selfId,
          username: "admin",
          role: "admin",
        },
        process.env.JWT_SECRET
      );

      const res = await request(app)
        .delete(`/api/admin/users/${selfId}`)
        .set("Authorization", `Bearer ${selfAdminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Non puoi cancellare il tuo stesso account admin"
      );
    });

    test("restituisce 404 se l'utente non esiste", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(User, "findById").mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Utente non trovato");
    });

    test("restituisce 400 se l'utente ha timbrature", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(User, "findById").mockResolvedValue({
        _id: userId,
        username: "luca",
        role: "user",
        isActive: true,
        fullName: "",
        email: "",
        createdAt: "2026-04-02T10:00:00.000Z",
        updatedAt: "2026-04-02T10:00:00.000Z",
      });

      jest.spyOn(TimeRecord, "findOne").mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "record-id-1",
          }),
        }),
      });

      const res = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(
        "Impossibile cancellare l'utente: sono presenti timbrature collegate. Disattivalo invece di eliminarlo."
      );
    });

    test("restituisce 200 e cancella correttamente un utente senza timbrature", async () => {
      const userId = new mongoose.Types.ObjectId().toString();

      jest.spyOn(User, "findById").mockResolvedValue({
        _id: userId,
        username: "giulia3",
        role: "user",
        isActive: true,
        fullName: "",
        email: "",
        createdAt: "2026-04-09T16:26:22.654Z",
        updatedAt: "2026-04-09T16:26:51.866Z",
      });

      jest.spyOn(TimeRecord, "findOne").mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      jest.spyOn(User, "findByIdAndDelete").mockResolvedValue({
        _id: userId,
      });

      const res = await request(app)
        .delete(`/api/admin/users/${userId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Utente cancellato con successo");
      expect(res.body.user.username).toBe("giulia3");
      expect(res.body.user.role).toBe("user");
      expect(res.body.user.isActive).toBe(true);
    });
  });
});