/**
 * One-command setup for the examples: `npm run examples:setup`.
 *
 * The library itself has zero runtime dependencies — only the examples need
 * the two optional peer packages, and this fetches them from the GitHub
 * Packages npm registry (published, versioned, prebuilt — the same
 * artifacts every consumer gets). GitHub's registry needs a one-time
 * read:packages token, even for public packages; the script prints the
 * setup steps if the fetch fails.
 *
 * npm refuses to install its own declared optional peers (`npm i` silently
 * no-ops), so the packages are fetched with `npm pack` and extracted into
 * node_modules directly. package.json and package-lock.json stay untouched,
 * so the library remains installable and testable with no token at all.
 * Idempotent — safe to re-run; a plain `npm install` prunes the packages
 * again (npm removes what it didn't put there), just re-run this.
 *
 * Developing the mirror/streams packages themselves against these examples?
 * Use standard `npm link` from your checkout of those repos.
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = fileURLToPath(new URL("..", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const installed = (pkg) => existsSync(join(root, "node_modules", pkg, "package.json"));

/** Fetch `spec` from the registry with `npm pack` and extract into node_modules. */
function packAndExtract(pkg, spec) {
  const scratch = join(tmpdir(), `hiero-receipts-setup-${process.pid}`);
  mkdirSync(scratch, { recursive: true });
  try {
    // Any lifecycle-script output lands on stdout too — the tarball
    // filename is the LAST line.
    const tarball = execFileSync(npm, ["pack", spec, "--pack-destination", scratch], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    })
      .toString()
      .trim()
      .split("\n")
      .pop();
    const dest = join(root, "node_modules", pkg);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    execFileSync("tar", ["-xzf", join(scratch, tarball), "-C", dest, "--strip-components=1"]);
    return true;
  } catch {
    return false;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function setup(pkg) {
  if (installed(pkg)) {
    console.log(`✓ ${pkg} already installed`);
    return true;
  }
  if (packAndExtract(pkg, `${pkg}@^0.1.0`)) {
    console.log(`✓ ${pkg} installed from GitHub Packages`);
    return true;
  }
  console.log(`✗ ${pkg} not installed.
  GitHub Packages requires a token even for public packages:
    1. gh auth refresh -s read:packages        (or a classic PAT with read:packages)
    2. npm config set //npm.pkg.github.com/:_authToken "$(gh auth token)"
    3. npm run examples:setup`);
  return false;
}

const liveReady = setup("@hiero-hackers/enterprise-mirror");
const verifiedReady = setup("@hiero-hackers/streams-node");

console.log(`
Examples ready to run:
  ${liveReady ? "✓" : "✗"} node examples/live-receipt.ts        (mainnet, needs network)
  ${verifiedReady ? "✓" : "✗"} node examples/verified-receipt.ts    (committed fixtures, offline)`);
