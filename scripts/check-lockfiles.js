#!/usr/bin/env node
// check-lockfiles.js — verify every JS subproject with npm deps has a committed package-lock.json
// Usage: node scripts/check-lockfiles.js  (or: npm run npm-check-lockfiles)
//
// Packages with no dependencies/devDependencies are skipped — they are metadata-only
// package.json files (e.g. Python packages with an npm identity file).

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const raw = execSync(
  "find . -name package.json -not -path '*/node_modules/*'",
  { encoding: "utf8", cwd: ROOT }
);

// Patterns to skip — scaffolding templates that users instantiate locally
const SKIP_PATTERNS = ["/assets/", "-template/", "/template/"];

const packages = raw
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((p) => p !== "./package.json")
  .filter((p) => !SKIP_PATTERNS.some((pat) => p.includes(pat)));

let missing = 0;
let skipped = 0;
let ok = 0;

for (const pkg of packages) {
  const abs = resolve(ROOT, pkg.slice(2));
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    continue;
  }

  const depCount =
    Object.keys(manifest.dependencies ?? {}).length +
    Object.keys(manifest.devDependencies ?? {}).length;

  if (depCount === 0) {
    // metadata-only package.json — no lockfile expected
    skipped++;
    continue;
  }

  const lock = pkg.replace("package.json", "package-lock.json");
  const lockAbs = resolve(ROOT, lock.slice(2));
  if (!existsSync(lockAbs)) {
    console.error(`MISSING lockfile: ${lock}  (${depCount} dep(s))`);
    missing++;
  } else {
    console.log(`  OK  ${pkg}  (${depCount} dep(s))`);
    ok++;
  }
}

console.log(`\n${ok} OK, ${missing} missing, ${skipped} skipped (no deps).`);

if (missing > 0) {
  console.error("Run 'npm install' inside each listed directory to generate the lockfile.");
  process.exit(1);
}
