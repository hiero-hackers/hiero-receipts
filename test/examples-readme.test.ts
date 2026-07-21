/**
 * The examples README table cannot drift from the folder — the same
 * discipline as the flag table. A stale row (pointing at a deleted example)
 * shipped once; this makes that class of mistake impossible.
 */
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dir = new URL("../examples/", import.meta.url);
const readme = readFileSync(new URL("README.md", dir), "utf8");
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

describe("examples/README.md ↔ examples/*.{ts,js}", () => {
  it("every example file has a row", () => {
    for (const f of files) {
      expect(readme, `README is missing a row for ${f}`).toContain(`](${f})`);
    }
  });

  it("every row points at a file that exists", () => {
    for (const link of readme.matchAll(/\]\(([\w-]+\.(?:ts|js))\)/g)) {
      expect(files, `README row points at missing file ${link[1]}`).toContain(link[1]);
    }
  });
});
