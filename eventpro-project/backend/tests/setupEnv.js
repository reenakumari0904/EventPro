// Ensures required env vars exist before any module (server.js, db.js,
// auth.middleware.js) reads them at import time.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret_do_not_use_in_prod";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/eventpro_test";
