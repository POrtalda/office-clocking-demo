// Public deterministic test defaults; no private .env file is loaded by Jest.
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "office-clocking-tests-only-not-a-deployment-secret";
process.env.MONGO_URI ??= "mongodb://127.0.0.1:27017/office_clocking_test";
process.env.CLIENT_URL ??= "http://localhost:5173";
process.env.PORT ??= "5000";
