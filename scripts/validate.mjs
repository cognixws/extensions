#!/usr/bin/env node
// Validates catalog.json (ADR-0380): schema, id rules, pinned refs, icons,
// and — when a GitHub token is present — that each entry's repository exists
// and holds a parseable manifest at the pinned ref.
//
// No dependencies. Run: node scripts/validate.mjs
// Set GITHUB_TOKEN (or GH_TOKEN) to enable the network checks; GitHub
// Actions always sets one. Without a token the network checks are skipped
// and the run says so.

import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

function fail(msg) {
  problems.push(msg);
}

// ── catalog.json ──────────────────────────────────────────────────────────
const catalogPath = join(root, "catalog.json");
let catalog;
try {
  catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
} catch (e) {
  console.error(`catalog.json is not valid JSON: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(catalog)) fail("catalog.json must be a JSON array");
if (catalog.length > 500) fail(`catalog.json holds ${catalog.length} entries; the cap is 500`);

const ids = new Set();
const idRe = /^[a-z0-9][a-z0-9-]{0,39}$/;
const tagRe = /^[a-z0-9][a-z0-9-]{0,19}$/;
const refRe = /^[A-Za-z0-9._/-]{1,64}$/;
const tiers = new Set(["first-party", "community"]);

let apiVersionMax = Number.POSITIVE_INFINITY;
const apiPath = join(root, "API_VERSION");
if (existsSync(apiPath)) {
  const n = Number.parseInt(readFileSync(apiPath, "utf8").trim(), 10);
  if (Number.isInteger(n) && n > 0) apiVersionMax = n;
  else fail("API_VERSION must hold a positive integer");
}

for (const [i, e] of catalog.entries()) {
  const at = `catalog.json[${i}] (${e && e.id ? e.id : "?"})`;
  if (typeof e !== "object" || e === null || Array.isArray(e)) {
    fail(`${at}: entry must be an object`);
    continue;
  }
  const req = ["id", "name", "publisher", "description", "repo", "ref", "icon", "tier", "pricing"];
  for (const k of req) {
    if (typeof e[k] !== "string" || !e[k].trim()) fail(`${at}: "${k}" is required`);
  }
  if (problems.some((p) => p.startsWith(at))) continue;

  if (!idRe.test(e.id)) fail(`${at}: id must match ${idRe} (lowercase, digits, dashes, ≤ 40)`);
  if (ids.has(e.id)) fail(`${at}: id "${e.id}" is already in the catalog`);
  ids.add(e.id);

  if (e.name.length > 60) fail(`${at}: name is longer than 60 characters`);
  if (e.publisher.length > 40) fail(`${at}: publisher is longer than 40 characters`);
  if (e.description.length > 160) fail(`${at}: description is longer than 160 characters (one sentence)`);

  if (!/^https:\/\/.+/.test(e.repo)) fail(`${at}: repo must be an https URL`);
  else if (/\/tree\/|\.git$/.test(e.repo)) fail(`${at}: repo must be the plain repository URL (no /tree/, no .git)`);
  else if (!/^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(e.repo)) fail(`${at}: repo must be a github.com/owner/repo URL in v1`);

  if (!refRe.test(e.ref)) fail(`${at}: ref must be 1–64 characters of letters, digits, . _ / -`);
  if (/^(main|master|develop|dev|latest|next)$/i.test(e.ref)) {
    fail(`${at}: ref pins a moving branch ("${e.ref}") — pin a tag or a commit sha (GUIDELINES.md)`);
  }

  if (e.tags !== undefined) {
    if (!Array.isArray(e.tags) || e.tags.length > 5) fail(`${at}: tags must be an array of at most 5`);
    else for (const t of e.tags) if (typeof t !== "string" || !tagRe.test(t)) fail(`${at}: tag ${JSON.stringify(t)} must match ${tagRe}`);
  }

  if (!tiers.has(e.tier)) fail(`${at}: tier must be "first-party" or "community"`);
  if (e.tier === "community" && e.id.startsWith("picode-")) {
    fail(`${at}: the "picode-" id prefix is reserved for first-party entries (GUIDELINES.md)`);
  }
  if (e.tier === "first-party" && !e.repo.startsWith("https://github.com/cognixws/")) {
    fail(`${at}: tier "first-party" is for cognixws repositories`);
  }
  if (e.pricing !== "free") fail(`${at}: pricing must be "free" in v1 (paid extensions come in v2)`);

  const iconPath = join(root, e.icon || "");
  if (!iconPath.startsWith(join(root, "icons") + "/")) {
    fail(`${at}: icon must live under icons/`);
  } else if (!existsSync(iconPath) || !statSync(iconPath).isFile()) {
    fail(`${at}: icon "${e.icon}" does not exist in this repository`);
  } else if (statSync(iconPath).size > 20 * 1024) {
    fail(`${at}: icon "${e.icon}" is larger than 20 KB`);
  }
}

// ── network checks (need a token; always present in GitHub Actions) ───────
let checked = 0;
async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "cognixws-extensions-validate",
    },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function checkRemote(e) {
  const slug = e.repo.replace("https://github.com/", "");
  const meta = await gh(`/repos/${slug}`);
  if (meta.private || meta.fork) {
    if (meta.private) fail(`${e.id}: repository is private — the marketplace can only recommend public repos`);
    if (meta.fork) fail(`${e.id}: repository is a fork (GUIDELINES.md: refuse forks without a substantial change)`);
  }
  // Manifest at the pinned ref.
  let manifest;
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${slug}/${encodeURIComponent(e.ref)}/picode-extension.json`);
    if (res.status === 404) {
      fail(`${e.id}: no picode-extension.json at ref ${e.ref}`);
      return;
    }
    if (!res.ok) throw new Error(`raw fetch → ${res.status}`);
    manifest = JSON.parse(await res.text());
  } catch (err) {
    fail(`${e.id}: could not read the manifest at ref ${e.ref} (${err.message})`);
    return;
  }
  if (manifest.id !== e.id) fail(`${e.id}: the manifest at ${e.ref} declares id "${manifest.id}"`);
  const v = Number(manifest.apiVersion);
  if (!Number.isInteger(v)) fail(`${e.id}: manifest at ${e.ref} has no numeric apiVersion`);
  else if (v > apiVersionMax) fail(`${e.id}: manifest apiVersion ${v} is above the accepted ${apiVersionMax} (bump API_VERSION in the same PR that ships it)`);
  // License at the pinned ref.
  const license = await gh(`/repos/${slug}/license?ref=${encodeURIComponent(e.ref)}`).catch(() => null);
  if (!license) fail(`${e.id}: no LICENSE detected at ref ${e.ref}`);
}

if (token) {
  for (const e of catalog) {
    if (typeof e !== "object" || e === null) continue;
    try {
      await checkRemote(e);
      checked++;
    } catch (err) {
      fail(`${e.id}: network check failed (${err.message})`);
    }
  }
}

console.log(`catalog: ${catalog.length} entries, ${checked} remotely checked${token ? "" : " (network checks skipped: no GITHUB_TOKEN)"}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("catalog OK");
