# AGENTS.md (smilintux-org)

The smilinTux organization hub: org README and marketing, the public sites (`*-io`, `cloud9-skworld-io`),
editor extensions (`skcapstone-vscode`, `skcapstone-cursor`, `skcapstone-nvim`), and a few Python
packages that live here (`skseed`, `varus`, `skills-registry`, `skarchitect`). Overview:
[README.md](./README.md). This file follows
[AGENT_INSTRUCTIONS_STANDARD](https://github.com/smilinTux/sk-standards/blob/main/standards/AGENT_INSTRUCTIONS_STANDARD.md).
There is no `CLAUDE.md` or `.windsurfrules`: every agent reads this file.

## Source of truth and invariants

- **Most SK packages are not here.** Each has its own repo under `github.com/smilinTux/` (skcapstone,
  skmemory, skchat, capauth, ...). `skcapstone`, `skhelp-io` and `skmemory-io` are gitlinks
  (submodule pointers), not code in this repo: change them in their own repos.
- **Packages owned here:** `skseed/`, `varus/`, `skills-registry/`, `skarchitect/` (Python) and
  `skarchitect-io/` (Next.js). Nested `AGENTS.md` files in `skarchitect/` and `skarchitect-io/`
  add their own rules.

## Commands

CI is `.github/workflows/ci.yml` (path-filtered, one job per package directory), plus
`extensions.yml`, `consciousness-swipe.yml`, `deploy-pages.yml`, `deploy-signaling.yml`,
`release.yml` and the `skstacks-*` workflows. For the packages owned here CI runs, from the package
directory:

```bash
# skseed (same shape for varus, which installs with `pip install -e .`)
pip install -e ".[dev]"
python -m pytest tests/ -v --tb=short --cov=skseed
pip install ruff && ruff check skseed/
# skills-registry
pip install -e ".[dev]" && ruff check skills_registry/ && python -m pytest tests/ -v --tb=short
# skcapstone-vscode (extensions.yml)
npm ci --ignore-scripts && npm run compile && npm run lint
```

Do not rely on `make ci`: the package list in `Makefile` still names packages that moved to their
own repos, so `make lint` fails on the missing directories. Use the per-package commands above.

## Start here

1. [README.md](./README.md): the product map and CI badges.
2. `.github/workflows/ci.yml`: which directories CI actually tests.
3. `Makefile`: the local developer commands.
4. [CONTRIBUTING.md](./CONTRIBUTING.md): how to contribute.

## Rules

- **Writing style:** no em dashes (U+2014) and no en dashes (U+2013) in anything you write: code,
  comments, docs, commits, PR bodies. Use commas, parentheses, colons or a new sentence. Hyphens are
  fine. Older files still contain them; do not add more.
- **Branch and commit:** never commit to `master`. Branch, commit as soon as a fast check passes and
  before any long verification, then open a PR.
- **Attribution:** a `Co-Authored-By` trailer names the agent that actually did the work, or is
  left out. Never one you cannot evidence.
- **Coordination:** run `skcapstone coord briefing` at the start of a session; claim work with
  `skcapstone coord claim <id> --agent <you>`.
- **Generated files:** `CHANGELOG.md` is generated from the skcapstone coordination board; add a
  short dated entry by hand only for changes that never had a board card.

## Privacy

This repo is public. Never put host names, LAN or tailnet IPs, estate names, personal names or data,
credentials or API keys in code, docs, tests, fixtures, commits or the sites. Use placeholders.
Enforced by review only.

## Hazards

- **Stale CI jobs:** `ci.yml` and `release.yml` still carry jobs for directories that moved out
  (`capauth/`, `skcomms/`, ...) or are gitlinks; `master` has been red for a while. A red check on a
  docs-only change is usually that, not your diff. Open PR #3 prunes them.
- **`skarchitect-io/local.db` is tracked**: never write real data into it.
- **Do not edit inside a gitlink directory** (`skcapstone/`, `skhelp-io/`, `skmemory-io/`): commits
  there belong to their own repos.

## See also

- [skcapstone](https://github.com/smilinTux/skcapstone): agent framework and coordination board.
- [sk-standards](https://github.com/smilinTux/sk-standards): `SK_REPO_DOC_STANDARD`,
  `AGENT_INSTRUCTIONS_STANDARD`.
