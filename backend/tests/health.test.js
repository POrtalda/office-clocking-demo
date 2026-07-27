const request = require("supertest");
const app = require("../app");

describe("GET /", () => {
  test("restituisce 200 e messaggio API attiva", async () => {
    const res = await request(app).get("/");

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      message: "Office Clocking API attiva",
    });
  });
});