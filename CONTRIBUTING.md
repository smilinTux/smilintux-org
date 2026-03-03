# Contributing to the Sovereign Agent Monorepo

This monorepo hosts the full SKCapstone sovereign agent framework.
Most packages are Python; a set of JavaScript subprojects live alongside them
for browser extensions, VS Code/Cursor extensions, web apps, and Cloudflare Workers.

---

## Python packages (primary language)

All Python packages follow the same conventions:

- Python 3.11+, PEP 8, type hints, `pydantic` models
- Formatter: `black`; linter: `ruff`
- Tests: `pytest` with at least happy-path, edge-case, and failure coverage
- Install for development: `pip install -e ".[dev]"` inside the package directory

**Active Python packages:**

| Directory | PyPI name | Purpose |
|---|---|---|
| `skcapstone/` | `skcapstone` | Sovereign agent framework core |
| `skmemory/` | `skmemory` | Persistent agent memory (SQLite + vector) |
| `skcomm/` | `skcomm` | Secure inter-agent messaging |
| `skchat/` | `skchat` | Chat interface and conversation management |
| `capauth/` | `capauth` | CapAuth PMA identity and trust |
| `skseal/` | `skseal` | Data sealing / cryptographic integrity |
| `sksecurity/` | `sksecurity` | Security policies and audit |
| `skpdf/` | `skpdf` | PDF processing for agent context |
| `skref/` | `skref` | Reference document indexing |
| `skyforge/` | `skyforge` | Agent scaffolding and generation |
| `skforge/` | `skforge` | Build tooling |
| `skills-registry/` | `skills-registry` | Sovereign skill directory |
| `skskills/` | `skskills` | Skill execution runtime |
| `skseed/` | `skseed` | LLM routing and seed context |
| `sksovereign-agent/` | — | Sovereign agent runner |
| `cloud9-python/` | `cloud9-protocol` | Cloud 9 emotional continuity protocol (Python, active) |
| `varus/` | `varus` | Auxiliary tooling |

Run all Python tests from the repo root:

```bash
python -m pytest tests/ -v
```

Or per-package:

```bash
cd skcapstone && python -m pytest tests/ -v
```

---

## JavaScript subprojects

### Strategy: independent packages (no npm workspaces)

The monorepo contains **9 JavaScript subprojects**, each with its own
`package.json` and `package-lock.json`. They do **not** share a workspace root.

**Why npm workspaces were not adopted:**

1. **Heterogeneous deployment targets** — each subproject publishes to a
   completely different destination (Chrome Web Store, VS Code Marketplace,
   Cloudflare Workers, npm, or is test-only). Hoisting shared `node_modules`
   would cause version conflicts between incompatible toolchains.

2. **Independent versioning and release cadence** — extensions, Workers, and
   IDE plugins release on very different schedules and are owned by different
   CI jobs.

3. **Workspace root mismatch** — the repo root `package.json` is a development
   scripts helper (task generation, PRD parsing), not a workspace coordinator.
   Adding workspace wiring here would imply relationships that don't exist.

4. **CI already handles isolation** — each JS project is built and tested in
   its own directory with `npm ci`, keeping dependency trees fully reproducible.

**If that changes in the future** (e.g. two or more extension packages need to
share a common `@smilintux/*` library), extracting those into a proper
workspace under a dedicated `extensions/` root would be the right approach.
That decision should be made package-by-package, not monorepo-wide.

### JS subproject inventory

| Path | Package | Purpose | Has lockfile |
|---|---|---|---|
| `capauth/browser-extension/` | `capauth-browser-extension` | Chrome/Firefox CapAuth extension | yes |
| `capauth/stages/ak-stage-capauth/` | `ak-stage-capauth` | Cloudflare Pages stage (Vite/SvelteKit) | yes |
| `consciousness-swipe/` | `consciousness-swipe` | Consciousness Swipe web widget | yes |
| `skcapstone-cursor/` | `skcapstone-ide` | Cursor IDE extension | yes |
| `skcapstone-vscode/` | `skcapstone` | VS Code extension | yes |
| `skseal/web/` | `@skseal/web` | SKSeal web UI | yes |
| `tests/e2e/` | `browser-extensions-e2e` | Playwright E2E tests for browser extensions | yes |
| `weblink-signaling/` | `weblink-signaling` | WebRTC signaling server (Cloudflare Worker) | yes |
| `cloud9/` | `@smilintux/cloud9` | **DEPRECATED** — use `cloud9-protocol` (Python) | yes |

### Working with a JS subproject

```bash
cd <subproject-dir>
npm ci          # install from lockfile (never npm install in CI)
npm test        # run tests
npm run build   # build for distribution
```

### Verifying lockfile coverage

To confirm every JS subproject has a committed `package-lock.json`:

```bash
npm run npm-check-lockfiles
```

Run this from the repo root. It exits non-zero if any subproject is missing
its lockfile.

### Adding a new JS subproject

1. Create the directory and run `npm init` (or scaffold via the appropriate
   framework CLI).
2. Commit both `package.json` and `package-lock.json`.
3. Add a CI job in `.github/workflows/ci.yml` following the existing
   `e2e-browser-extensions` pattern (use `npm ci`, not `npm install`).
4. Update the table above.

---

## CI overview

The root CI workflow (`.github/workflows/ci.yml`) uses path filtering to run
only the jobs relevant to changed files. All Python jobs run a matrix across
Python 3.11, 3.12, and 3.13. JS jobs use Node 20.

See the workflow file for per-package job definitions.

---

## Deprecated packages

| Directory | Replaced by | Notes |
|---|---|---|
| `cloud9/` | `cloud9-python/` (`cloud9-protocol` on PyPI) | JS package; not in CI; kept for backwards compat only |

See `cloud9/DEPRECATED.md` for migration instructions.
