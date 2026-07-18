import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import security from "eslint-plugin-security";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig(
  globalIgnores(["**/dist/**", "**/node_modules/**", "examples/output/**", "coverage/**"]),

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  security.configs.recommended,
  prettierConfig,

  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": "error",
    },
  },

  {
    files: ["**/*.{js,mjs,ts}"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // The examples and repo scripts are deliberately I/O-ful dev tooling (they
  // read fixtures, write receipts, spawn npm and a headless browser) — the
  // security plugin's non-literal-fs/child-process rules exist for server
  // code handling untrusted paths, not for scripts whose paths are all their
  // own.
  {
    files: ["examples/**", "scripts/**"],
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-child-process": "off",
    },
  },
);
