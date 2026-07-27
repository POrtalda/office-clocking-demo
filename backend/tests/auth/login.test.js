/**
 * tests/auth/login.test.js
 *
 * Test API per autenticazione:
 * - POST /api/auth/login
 * - GET /api/auth/me
 *
 * In questa fase:
 * - usiamo Supertest sull'app Express
 * - mockiamo User, bcrypt e jsonwebtoken
 * - non dipendiamo ancora dal database reale
 */

const request = require("supertest");

// Mock delle dipendenze usate da controller e middleware
jest.mock("../../models/User");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Importiamo l'app DOPO i mock
const app = require("../../app");

describe("Auth API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // POST /api/auth/login
  // ==========================================================================

  describe("POST /api/auth/login", () => {
    test("restituisce 400 se username e password mancano", async () => {
      const res = await request(app).post("/api/auth/login").send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Username e password sono obbligatori");

      expect(User.findOne).not.toHaveBeenCalled();
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("restituisce 401 se lo username non esiste", async () => {
      User.findOne.mockResolvedValue(null);

      const res = await request(app).post("/api/auth/login").send({
        username: "mario",
        password: "1234",
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Credenziali non valide");

      expect(User.findOne).toHaveBeenCalledWith({ username: "mario" });
      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("restituisce 401 se la password è errata", async () => {
      const fakeUser = {
        _id: "abc123",
        username: "mario",
        role: "user",
        password: "hashed-password",
      };

      User.findOne.mockResolvedValue(fakeUser);
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app).post("/api/auth/login").send({
        username: "mario",
        password: "password-sbagliata",
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Credenziali non valide");

      expect(User.findOne).toHaveBeenCalledWith({ username: "mario" });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password-sbagliata",
        "hashed-password"
      );
      expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("restituisce 200, token e user se il login è valido", async () => {
      const fakeUser = {
        _id: "abc123",
        username: "mario",
        role: "user",
        password: "hashed-password",
      };

      User.findOne.mockResolvedValue(fakeUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue("fake-jwt-token");

      const res = await request(app).post("/api/auth/login").send({
        username: "mario",
        password: "1234",
      });

      expect(res.statusCode).toBe(200);

      expect(User.findOne).toHaveBeenCalledWith({ username: "mario" });
      expect(bcrypt.compare).toHaveBeenCalledWith("1234", "hashed-password");
      expect(jwt.sign).toHaveBeenCalled();

      expect(res.body).toEqual({
        message: "Login effettuato con successo",
        token: "fake-jwt-token",
        user: {
          username: "mario",
          role: "user",
        },
      });
    });
  });

  // ==========================================================================
  // GET /api/auth/me
  // ==========================================================================

  describe("GET /api/auth/me", () => {
    test("restituisce 401 se manca Authorization header", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Token mancante");

      expect(jwt.verify).not.toHaveBeenCalled();
    });

    test("restituisce 401 se il formato Authorization non è Bearer", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Token abc123");

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Formato token non valido");

      expect(jwt.verify).not.toHaveBeenCalled();
    });

    test("restituisce 401 se il token non è valido", async () => {
      const error = new Error("invalid token");
      error.name = "JsonWebTokenError";

      jwt.verify.mockImplementation(() => {
        throw error;
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer token-falso");

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Token non valido");

      expect(jwt.verify).toHaveBeenCalledWith(
        "token-falso",
        process.env.JWT_SECRET
      );
    });

    test("restituisce 200 e i dati utente se il token è valido", async () => {
      jwt.verify.mockReturnValue({
        id: "user123",
        username: "mario",
        role: "user",
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer token-valido");

      expect(res.statusCode).toBe(200);

      expect(jwt.verify).toHaveBeenCalledWith(
        "token-valido",
        process.env.JWT_SECRET
      );

      expect(res.body).toEqual({
        user: {
          id: "user123",
          username: "mario",
          role: "user",
        },
      });
    });
  });
});