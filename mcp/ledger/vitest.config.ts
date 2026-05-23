import { defineConfig } from "vitest/config";

// Tests run against an in-memory ledger so they never touch a real run.
export default defineConfig({
  test: { env: { OBOL_DB_PATH: ":memory:" } },
});
