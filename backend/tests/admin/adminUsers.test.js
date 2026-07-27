const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../../models/User.js");
const TimeRecord = require("../../models/TimeRecord.js");
const {
  getUsers,
  createUser,
  updateUserStatus,
  updateUserGeolocationStatus,
  updateUserPassword,
  deleteUser,
} = require("../../controllers/adminController");

// Mock del model User.
// In questi test isoliamo il controller senza usare il DB reale.
jest.mock("../../models/User.js", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
}));

// Mock del model TimeRecord per i test di cancellazione utente.
jest.mock("../../models/TimeRecord.js", () => ({
  findOne: jest.fn(),
}));

// Mock di bcrypt per controllare l'hash della password.
jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));

describe("adminController - getUsers", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {};
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it("restituisce 200 con lista utenti vuota", async () => {
    // Simula la chain Mongoose:
    // User.find({}).select(...).sort(...).lean()
    const leanMock = jest.fn().mockResolvedValue([]);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const selectMock = jest.fn().mockReturnValue({ sort: sortMock });

    User.find.mockReturnValue({
      select: selectMock,
    });

    await getUsers(req, res, next);

    expect(User.find).toHaveBeenCalledWith({});
    expect(selectMock).toHaveBeenCalledWith(
      "_id username role isActive geolocationEnabled fullName email createdAt updatedAt"
    );
    expect(sortMock).toHaveBeenCalledWith({ username: 1 });
    expect(leanMock).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith({
      users: [],
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("restituisce la lista utenti completa e ordinata", async () => {
    const usersFromDb = [
      {
        _id: "user-admin",
        username: "admin",
        role: "admin",
        isActive: true,
        fullName: "Admin User",
        email: "admin@example.com",
        createdAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
      {
        _id: "user-luca",
        username: "luca",
        role: "user",
        isActive: false,
        fullName: "Luca Rossi",
        email: "luca@example.com",
        createdAt: "2026-04-01T10:10:00.000Z",
        updatedAt: "2026-04-01T11:39:50.274Z",
      },
    ];

    const leanMock = jest.fn().mockResolvedValue(usersFromDb);
    const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
    const selectMock = jest.fn().mockReturnValue({ sort: sortMock });

    User.find.mockReturnValue({
      select: selectMock,
    });

    await getUsers(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      users: usersFromDb,
    });

    expect(next).not.toHaveBeenCalled();
  });
});

describe("adminController - createUser", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      body: {},
      user: {
        id: "admin-user-id",
        username: "admin",
        role: "admin",
      },
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it("crea un nuovo utente con password hashata e restituisce 201", async () => {
    req.body = {
      username: "Giulia",
      password: "abcd1234",
      role: "user",
      fullName: "Giulia Bianchi",
      email: "Giulia@Example.com",
    };

    User.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    bcrypt.hash.mockResolvedValue("hashed-password-123");

    User.create.mockResolvedValue({
      _id: "new-user-id",
      username: "giulia",
      role: "user",
      isActive: true,
      fullName: "Giulia Bianchi",
      email: "giulia@example.com",
      createdAt: "2026-04-01T12:00:00.000Z",
      updatedAt: "2026-04-01T12:00:00.000Z",
    });

    await createUser(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ username: "giulia" });
    expect(bcrypt.hash).toHaveBeenCalledWith("abcd1234", 10);

    expect(User.create).toHaveBeenCalledWith({
      username: "giulia",
      password: "hashed-password-123",
      role: "user",
      isActive: true,
      geolocationEnabled: true,
      fullName: "Giulia Bianchi",
      email: "giulia@example.com",
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Utente creato con successo",
      user: {
        id: "new-user-id",
        username: "giulia",
        role: "user",
        isActive: true,
        geolocationEnabled: true,
        fullName: "Giulia Bianchi",
        email: "giulia@example.com",
        createdAt: "2026-04-01T12:00:00.000Z",
        updatedAt: "2026-04-01T12:00:00.000Z",
      },
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("rifiuta la creazione se username già esistente", async () => {
    req.body = {
      username: "Giulia",
      password: "abcd1234",
      role: "user",
      fullName: "Giulia Bianchi",
      email: "Giulia@Example.com",
    };

    User.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: "existing-user-id",
        username: "giulia",
      }),
    });

    await createUser(req, res, next);

    expect(User.findOne).toHaveBeenCalledWith({ username: "giulia" });
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe("Username già esistente");
    expect(errorPassedToNext.statusCode).toBe(409);
    expect(errorPassedToNext.code).toBe("USERNAME_ALREADY_EXISTS");
  });

  it("rifiuta la creazione se la password è troppo corta", async () => {
    req.body = {
      username: "Giulia",
      password: "abc",
      role: "user",
      fullName: "Giulia Bianchi",
      email: "Giulia@Example.com",
    };

    await createUser(req, res, next);

    expect(User.findOne).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe(
      "La password deve contenere almeno 4 caratteri"
    );
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("PASSWORD_TOO_SHORT");
  });

  it("rifiuta la creazione se il ruolo non è valido", async () => {
    req.body = {
      username: "Giulia",
      password: "abcd1234",
      role: "manager",
      fullName: "Giulia Bianchi",
      email: "Giulia@Example.com",
    };

    await createUser(req, res, next);

    expect(User.findOne).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe(
      "Ruolo non valido. Valori ammessi: admin, user"
    );
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("INVALID_ROLE");
  });
});

describe("adminController - updateUserStatus", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      user: {
        id: "507f1f77bcf86cd799439011",
        username: "admin",
        role: "admin",
      },
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it("disattiva un utente con successo e restituisce 200", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };
    req.body = { isActive: false };

    const saveMock = jest.fn().mockResolvedValue();

    User.findById.mockResolvedValue({
      _id: userId,
      username: "luca",
      role: "user",
      isActive: true,
      fullName: "",
      email: "",
      createdAt: "2026-04-01T10:10:00.000Z",
      updatedAt: "2026-04-01T11:39:50.274Z",
      save: saveMock,
    });

    await updateUserStatus(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(saveMock).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Utente disattivato con successo",
      user: {
        id: userId,
        username: "luca",
        role: "user",
        isActive: false,
        geolocationEnabled: true,
        fullName: "",
        email: "",
        createdAt: "2026-04-01T10:10:00.000Z",
        updatedAt: "2026-04-01T11:39:50.274Z",
      },
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("rifiuta la disattivazione del proprio account admin", async () => {
    req.params = { id: "507f1f77bcf86cd799439011" };
    req.body = { isActive: false };

    await updateUserStatus(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe(
      "Non puoi disattivare il tuo stesso account admin"
    );
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("CANNOT_DISABLE_SELF");
  });

  it("rifiuta la richiesta se isActive non è booleano", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };
    req.body = { isActive: "false" };

    await updateUserStatus(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe(
      "Il campo isActive è obbligatorio e deve essere booleano"
    );
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("INVALID_IS_ACTIVE");
  });

  it("restituisce 404 se l'utente da aggiornare non esiste", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };
    req.body = { isActive: false };

    User.findById.mockResolvedValue(null);

    await updateUserStatus(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe("Utente non trovato");
    expect(errorPassedToNext.statusCode).toBe(404);
    expect(errorPassedToNext.code).toBe("USER_NOT_FOUND");
  });
});

describe("adminController - updateUserGeolocationStatus", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {
        id: new mongoose.Types.ObjectId().toString(),
      },
      body: {
        geolocationEnabled: false,
      },
      user: {
        id: new mongoose.Types.ObjectId().toString(),
        username: "admin",
        role: "admin",
      },
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it("aggiorna lo stato geolocalizzazione utente e restituisce 200", async () => {
    const userId = req.params.id;

    const userToUpdate = {
      _id: userId,
      username: "luca",
      role: "user",
      isActive: true,
      geolocationEnabled: true,
      fullName: "",
      email: "",
      createdAt: "2026-04-01T10:10:00.000Z",
      updatedAt: "2026-04-01T11:39:50.274Z",
      save: jest.fn().mockResolvedValue(true),
    };

    User.findById.mockResolvedValue(userToUpdate);

    await updateUserGeolocationStatus(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(userToUpdate.geolocationEnabled).toBe(false);
    expect(userToUpdate.save).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Geolocalizzazione disattivata per l'utente",
      user: {
        id: userId,
        username: "luca",
        role: "user",
        isActive: true,
        geolocationEnabled: false,
        fullName: "",
        email: "",
        createdAt: "2026-04-01T10:10:00.000Z",
        updatedAt: "2026-04-01T11:39:50.274Z",
      },
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("rifiuta la richiesta se geolocationEnabled non è booleano", async () => {
    req.body = {
      geolocationEnabled: "false",
    };

    await updateUserGeolocationStatus(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("INVALID_GEOLOCATION_ENABLED");
  });

  it("restituisce 404 se l'utente non esiste", async () => {
    User.findById.mockResolvedValue(null);

    await updateUserGeolocationStatus(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(req.params.id);
    expect(next).toHaveBeenCalled();

    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("USER_NOT_FOUND");
  });
});

describe("adminController - updateUserPassword", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      body: {},
      user: {
        id: "507f1f77bcf86cd799439011",
        username: "admin",
        role: "admin",
      },
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it("aggiorna la password di un utente e restituisce 200", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };
    req.body = { password: "nuovaPassword123" };

    const saveMock = jest.fn().mockResolvedValue();

    User.findById.mockResolvedValue({
      _id: userId,
      username: "luca",
      role: "user",
      isActive: false,
      fullName: "",
      email: "",
      createdAt: "2026-04-01T10:10:00.000Z",
      updatedAt: "2026-04-01T11:39:50.274Z",
      password: "old-hash",
      save: saveMock,
    });

    bcrypt.hash.mockResolvedValue("new-hashed-password");

    await updateUserPassword(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(bcrypt.hash).toHaveBeenCalledWith("nuovaPassword123", 10);
    expect(saveMock).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Password aggiornata con successo",
      user: {
        id: userId,
        username: "luca",
        role: "user",
        isActive: false,
        geolocationEnabled: true,
        fullName: "",
        email: "",
        createdAt: "2026-04-01T10:10:00.000Z",
        updatedAt: "2026-04-01T11:39:50.274Z",
      },
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("rifiuta la richiesta se la password è troppo corta", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };
    req.body = { password: "123" };

    await updateUserPassword(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe(
      "La password deve contenere almeno 4 caratteri"
    );
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("PASSWORD_TOO_SHORT");
  });

  it("rifiuta la richiesta se la password manca", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };
    req.body = {};

    await updateUserPassword(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe("La password è obbligatoria");
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("MISSING_PASSWORD");
  });

  it("rifiuta la richiesta se l'id utente non è valido", async () => {
    req.params = { id: "id-non-valido" };
    req.body = { password: "nuovaPassword123" };

    await updateUserPassword(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe("ID utente non valido");
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("INVALID_USER_ID");
  });

  it("restituisce 404 se l'utente non esiste", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };
    req.body = { password: "nuovaPassword123" };

    User.findById.mockResolvedValue(null);

    await updateUserPassword(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe("Utente non trovato");
    expect(errorPassedToNext.statusCode).toBe(404);
    expect(errorPassedToNext.code).toBe("USER_NOT_FOUND");
  });
});

describe("adminController - deleteUser", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      params: {},
      user: {
        id: "507f1f77bcf86cd799439011",
        username: "admin",
        role: "admin",
      },
    };

    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  it("cancella un utente senza timbrature e restituisce 200", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };

    User.findById.mockResolvedValue({
      _id: userId,
      username: "giulia3",
      role: "user",
      isActive: true,
      fullName: "",
      email: "",
      createdAt: "2026-04-09T16:26:22.654Z",
      updatedAt: "2026-04-09T16:26:51.866Z",
    });

    TimeRecord.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });

    User.findByIdAndDelete.mockResolvedValue({
      _id: userId,
    });

    await deleteUser(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(TimeRecord.findOne).toHaveBeenCalledWith({ user: userId });
    expect(User.findByIdAndDelete).toHaveBeenCalledWith(userId);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Utente cancellato con successo",
      user: {
        id: userId,
        username: "giulia3",
        role: "user",
        isActive: true,
        geolocationEnabled: true,
        fullName: "",
        email: "",
        createdAt: "2026-04-09T16:26:22.654Z",
        updatedAt: "2026-04-09T16:26:51.866Z",
      },
    });

    expect(next).not.toHaveBeenCalled();
  });

  it("rifiuta la richiesta se l'id utente non è valido", async () => {
    req.params = { id: "id-non-valido" };

    await deleteUser(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe("ID utente non valido");
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("INVALID_USER_ID");
  });

  it("rifiuta il self-delete del proprio account admin", async () => {
    req.params = { id: "507f1f77bcf86cd799439011" };

    await deleteUser(req, res, next);

    expect(User.findById).not.toHaveBeenCalled();
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe(
      "Non puoi cancellare il tuo stesso account admin"
    );
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("CANNOT_DELETE_SELF");
  });

  it("restituisce 404 se l'utente non esiste", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };

    User.findById.mockResolvedValue(null);

    await deleteUser(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(TimeRecord.findOne).not.toHaveBeenCalled();
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe("Utente non trovato");
    expect(errorPassedToNext.statusCode).toBe(404);
    expect(errorPassedToNext.code).toBe("USER_NOT_FOUND");
  });

  it("rifiuta la cancellazione se l'utente ha timbrature", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    req.params = { id: userId };

    User.findById.mockResolvedValue({
      _id: userId,
      username: "luca",
      role: "user",
      isActive: true,
      fullName: "",
      email: "",
      createdAt: "2026-04-01T10:10:00.000Z",
      updatedAt: "2026-04-01T11:39:50.274Z",
    });

    TimeRecord.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: "record-id-1",
        }),
      }),
    });

    await deleteUser(req, res, next);

    expect(User.findById).toHaveBeenCalledWith(userId);
    expect(TimeRecord.findOne).toHaveBeenCalledWith({ user: userId });
    expect(User.findByIdAndDelete).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    expect(next).toHaveBeenCalledTimes(1);

    const errorPassedToNext = next.mock.calls[0][0];
    expect(errorPassedToNext).toBeDefined();
    expect(errorPassedToNext.message).toBe(
      "Impossibile cancellare l'utente: sono presenti timbrature collegate. Disattivalo invece di eliminarlo."
    );
    expect(errorPassedToNext.statusCode).toBe(400);
    expect(errorPassedToNext.code).toBe("USER_HAS_TIME_RECORDS");
  });
});
