const request = require("supertest");
jest.mock("../../models/User", () => ({ find: jest.fn() }));
const User = require("../../models/User");
const app = require("../../app");
const original = process.env.DEMO_MODE;
beforeEach(() => jest.clearAllMocks());
afterEach(() => { if (original === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = original; });
test("demo login profile list keeps active users/admins available without returning credentials", async () => {
  process.env.DEMO_MODE = "true";
  const q = { select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([
    { username: "mario", role: "user", fullName: "Mario Demo", password: "not-for-response" },
    { username: "admin", role: "admin" },
  ]) };
  User.find.mockReturnValue(q);
  const res = await request(app).get("/api/demo/login-users");
  expect(res.status).toBe(200);
  expect(User.find).toHaveBeenCalledWith({ isActive: { $ne: false } });
  expect(res.body.users.map(user => user.username)).toEqual(["mario", "admin"]);
  expect(res.body.users[0].password).toBeUndefined();
});
test.each(["false", "TRUE", undefined])("demo account list stays disabled without exact demo flag %s", async value => {
  if (value === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = value;
  const res = await request(app).get("/api/demo/login-users");
  expect(res.status).toBe(404); expect(User.find).not.toHaveBeenCalled();
});
