import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // The locale catalogs are declarative wording data — their correctness
      // is pinned by verbatim golden receipts (test/i18n.test.ts) and native
      // review, not by exercising every sentence variant's branches.
      exclude: ["src/locales/**"],
      // Ratchet, don't rot: set just under the current numbers so coverage
      // can only be raised deliberately, never lowered silently.
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 95,
      },
    },
  },
});
