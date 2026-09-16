// Shared mock for config/db.js. Every test file that needs it calls
// jest.unstable_mockModule("../config/db.js", () => import("./mockDb.js"))
// BEFORE importing anything that (transitively) imports the real db.js —
// required by Jest's native-ESM mocking rules.
import { jest } from "@jest/globals";

export const query = jest.fn();
export const pool = { query: jest.fn(), end: jest.fn(), totalCount: 0, idleCount: 0, waitingCount: 0 };
