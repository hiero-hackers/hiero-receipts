/**
 * Example helper: render receipt HTML to a PDF with a headless browser.
 *
 * This lives in the EXAMPLES, not the library — producing a PDF needs a
 * rendering engine (I/O), which the pure `hiero-receipts` core stays out of.
 * A real app would do the same thing (often with Puppeteer). Dependency-free:
 * it drives a Chrome/Chromium/Edge already on the machine, and if none is
 * found it prints the manual command instead of failing.
 */
import { writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "google-chrome",
  "chromium",
  "chromium-browser",
  "microsoft-edge",
];

function findBrowser() {
  for (const candidate of CANDIDATES) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (existsSync(candidate)) return candidate;
    } else {
      try {
        execFileSync(process.platform === "win32" ? "where" : "which", [candidate], {
          stdio: "ignore",
        });
        return candidate;
      } catch {
        /* not on PATH — keep looking */
      }
    }
  }
  return undefined;
}

/**
 * Write `html` to `outPath` as a PDF. Returns true on success; on a machine
 * with no headless browser, returns false and prints how to do it by hand.
 */
export function htmlToPdf(html, outPath) {
  const htmlPath = join(tmpdir(), `hiero-receipt-${process.pid}.html`);
  writeFileSync(htmlPath, html);

  const browser = findBrowser();
  if (!browser) {
    console.log(`  (no headless browser found — open ${htmlPath} and Print → Save as PDF)`);
    return false;
  }
  try {
    execFileSync(
      browser,
      [
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        `--print-to-pdf=${outPath}`,
        `file://${htmlPath}`,
      ],
      { stdio: "ignore" },
    );
    return true;
  } catch (err) {
    console.log(`  (PDF render failed: ${err instanceof Error ? err.message : err})`);
    return false;
  }
}
