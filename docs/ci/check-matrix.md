# Workflow check matrix

Evidence baseline: default branch `master`, commit
`275a5c6dd38ebd05725dce51862c354b2661f127`.

This matrix records every job in `.github/workflows` at that baseline and the
repository path or external action it targets. “Absent path” means the path is
not present in the Git tree at that commit; it is not a test failure and must
not be hidden with `|| true`.

## Baseline inventory and verdicts

| Workflow | Job(s) | Target / install extra | Evidence verdict |
|---|---|---|---|
| `ci.yml` | `detect-changes` | 17 package filters plus browser E2E | Stale monorepo inventory: only `skills-registry`, `skseed`, and `varus` are present as owned directories. |
| `ci.yml` | `capauth`, `skcomms`, `skchat`, `skmemory`, `sksecurity`, `cloud9`, `skpdf`, `skseal`, `skref`, `skyforge`, `skforge`, `skskills`, `sksovereign-agent` | Same-named absent paths; mostly `.[dev]` (`skcomms` also `all`; `skchat` also `cli`) | Structurally invalid: working directory does not exist. |
| `ci.yml` | `skcapstone` | `skcapstone`, `.[dev]` and optional extras | `skcapstone` is a gitlink, not repository-owned source; checkout does not initialize it. Structurally invalid. |
| `ci.yml` | `skills-registry` | `skills-registry`, `.[dev]` | Owned path and declared extra; retained. Baseline test guard masked an empty suite, although tests exist; repaired to run tests unconditionally. |
| `ci.yml` | `skseed` | `skseed`, `.[dev]` | Owned path and declared extra; retained. |
| `ci.yml` | `varus` | `varus`, baseline install `.` | Owned path; `dev` is declared and required for pytest/ruff. Repaired to install `.[dev]` plus the undeclared check tool `pytest-cov`. |
| `ci.yml` | `integration` | Installs 16 package paths; tests in `tests/integration` | Structurally invalid because 13 required package paths are absent. Removed rather than masking package-import failures. |
| `ci.yml` | `coverage` | Artifacts from package jobs | Coupled to stale package matrix and allowed “no data” as success. Removed; retained jobs still emit XML artifacts. |
| `ci.yml` | `e2e-browser-extensions` | `tests/e2e`; fixtures require absent `consciousness-swipe` and `capauth/browser-extension` | Test directory exists, both products under test do not. Structurally invalid; removed. |
| `ci.yml` | `all-tests` | Results of all jobs | Rebuilt over the three owned checks. Skipped path-filtered jobs remain neutral; failures fail the gate. |
| `consciousness-swipe.yml` | `build` | absent `consciousness-swipe`, npm | Trigger and working directory are absent. Workflow removed. |
| `deploy-pages.yml` | `changes`, three `deploy-*` jobs | `skpdf-io`, `skhelp-io`, `skmemory-io`; Pages actions | Paths exist (`skhelp-io` and `skmemory-io` are gitlinks). Deployment workflow retained unchanged; not executed by this card. |
| `deploy-signaling.yml` | `deploy` | `weblink-signaling`, npm | Owned path exists. Deployment workflow retained unchanged; not executed by this card. |
| `extensions.yml` | build/test/publish for VS Code and Cursor; `test-nvim` | `skcapstone-vscode`, `skcapstone-cursor`, `skcapstone-nvim`; npm/Make | All targets exist. Retained unchanged. Publish jobs remain tag-gated. |
| `release.yml` | `test` | 16 package paths with `.[dev]` | Stale monorepo release gate: 13 paths absent and `varus/[dev]` was valid but never reachable after earlier failures. Replaced with owned `skseed` and `varus` tests. |
| `release.yml` | `resolve` | global and 15 per-package tag families | Global and split-package releases were not truthful for this Git tree. Restricted to `skseed-v*` and `varus-v*`. |
| `release.yml` | 15 `publish-*` jobs | package directories, build/twine, package tokens | Thirteen target absent directories; `skseed` and `varus` retained. No release was run. |
| `skstacks-ansible.yml` | `ansible-lint`, `molecule` | absent `skstacks/v2/platform/rke2/ansible`; ansible/molecule extras | Trigger and target absent. Workflow removed. |
| `skstacks-k8s.yml` | `kustomize-validate` | absent `skstacks/v2/platform/kubernetes`; downloaded kubectl/kubeconform | Trigger and target absent. Workflow removed. |
| `.forgejo/workflows/ansible-lint.yml` | `ansible-lint-rke2`, `ansible-lint-swarm`, `molecule-rke2-common`, `molecule-rke2-server`, `ansible-summary` | absent `skstacks/v2/platform/{rke2,swarm}/ansible`; `ansible-core`, `ansible-lint`, `yamllint`, `molecule`, `molecule-plugins[docker]`, collections | Every source target is absent after `c4cc352`; even the guarded Swarm job is not a meaningful repository check. Workflow removed. |
| `.forgejo/workflows/skcapstone.yml` | `test` | `skcapstone`, `.[dev]`, best-effort `../skseed`, `pytest-cov`, `coverage`, `mypy` | `skcapstone` is an unconfigured gitlink: this repository has no `.gitmodules`, and checkout cannot materialize it. The `|| true` also masked the `skseed` install. Workflow removed; the split repository owns this check. |

## Current check ownership

| Repository path | CI checks | Install contract |
|---|---|---|
| `skills-registry` | Source Ruff; pytest with coverage XML | `.[dev]` |
| `skseed` | pytest on Python 3.11–3.13; source Ruff on 3.12; coverage XML | `.[dev]` plus `pytest-cov` |
| `varus` | pytest on Python 3.11–3.13; source Ruff on 3.12; coverage XML | `.[dev]` plus `pytest-cov` |
| `skcapstone-vscode`, `skcapstone-cursor`, `skcapstone-nvim` | Existing editor-extension build/test jobs | npm / Make contracts unchanged |
| `weblink-signaling`; static site paths | Existing deploy jobs | Deployment contracts unchanged and outside local validation |

## Scope and rollback

Only stale path and missing check-tool assumptions were changed. No meaningful
owned check was disabled, and no release, deployment, credential use, provider
canary, service mutation, merge, release, or deployment was performed. The
candidate branch was pushed only to deliver pull request 3 for review.

Local evidence: all five retained workflow files parse with PyYAML; a static
working-directory scan found no absent target; `compileall` passed for the
three owned Python sources; `skseed` passed 263 tests and `varus` passed 72.
Existing package debt is not masked: `skills-registry` has 3 failing
publish-response tests out of 134, and source Ruff reports pre-existing
findings in all three packages. A
combined root invocation also demonstrated duplicate `tests` package names,
so checks deliberately remain isolated by package working directory.

Rollback is a normal revert of the workflow and matrix changes in this card.
That restores the historical monorepo assumptions; it does not restore the
absent repositories.
