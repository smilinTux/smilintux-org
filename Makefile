# Sovereign Agent Monorepo — top-level developer commands
#
# Usage:
#   make install-dev   install all Python packages in editable mode
#   make lint          ruff check + black --check across all packages
#   make test          run pytest for all Python packages
#   make build         build wheels for all packages
#   make docker        start the dev stack via docker compose
#   make ci            lint then test (what CI runs)
#   make clean         remove build artifacts and caches

# Python packages with a pyproject.toml
PYTHON_PKGS := \
	skcapstone \
	skchat \
	skcomm \
	skmemory \
	skseal \
	skskills \
	skseed \
	skforge \
	skyforge \
	varus \
	capauth \
	skpdf \
	skref \
	sksecurity \
	skills-registry \
	cloud9-python \
	sksovereign-agent

.PHONY: install-dev lint test build docker ci clean help

# ── install ────────────────────────────────────────────────────────────────

install-dev:
	@echo "==> Installing all packages in editable mode..."
	@for pkg in $(PYTHON_PKGS); do \
		if [ -f "$$pkg/pyproject.toml" ]; then \
			echo "  pip install -e $$pkg[dev]"; \
			pip install -e "$$pkg[dev]" --quiet || pip install -e "$$pkg" --quiet; \
		fi; \
	done
	@echo "Done."

# ── lint ───────────────────────────────────────────────────────────────────

lint:
	@echo "==> ruff check..."
	@ruff check $(PYTHON_PKGS)
	@echo "==> black --check..."
	@black --check $(PYTHON_PKGS)
	@echo "Lint passed."

# ── test ───────────────────────────────────────────────────────────────────

test:
	@echo "==> Running pytest for all packages..."
	@pytest \
		$(foreach pkg,$(PYTHON_PKGS),$(wildcard $(pkg)/tests)) \
		tests/ \
		-x --tb=short -q
	@echo "Tests passed."

# ── build ──────────────────────────────────────────────────────────────────

build:
	@echo "==> Building wheels for all packages..."
	@for pkg in $(PYTHON_PKGS); do \
		if [ -f "$$pkg/pyproject.toml" ]; then \
			echo "  building $$pkg..."; \
			python -m build "$$pkg" --outdir dist/ --wheel --quiet; \
		fi; \
	done
	@echo "Wheels written to dist/."

# ── docker ─────────────────────────────────────────────────────────────────

docker:
	@echo "==> Starting dev stack..."
	docker compose up -d

# ── ci ─────────────────────────────────────────────────────────────────────

ci: lint test

# ── clean ──────────────────────────────────────────────────────────────────

clean:
	@echo "==> Removing build artifacts and caches..."
	@find . -type d -name "__pycache__"  -not -path "./.git/*" | xargs rm -rf
	@find . -type d -name "*.egg-info"   -not -path "./.git/*" | xargs rm -rf
	@find . -type d -name ".pytest_cache" -not -path "./.git/*" | xargs rm -rf
	@find . -type d -name ".ruff_cache"  -not -path "./.git/*" | xargs rm -rf
	@find . -type d -name "dist"         -maxdepth 2            | xargs rm -rf
	@find . -type d -name "build"        -maxdepth 2            | xargs rm -rf
	@find . -type f -name "*.pyc"        | xargs rm -f
	@echo "Clean."

# ── help ───────────────────────────────────────────────────────────────────

help:
	@echo "Available targets:"
	@echo "  install-dev  Install all Python packages in editable mode"
	@echo "  lint         ruff check + black --check across all packages"
	@echo "  test         Run pytest for all Python packages"
	@echo "  build        Build wheels for all packages"
	@echo "  docker       Start the dev stack (docker compose up -d)"
	@echo "  ci           lint + test (used in CI)"
	@echo "  clean        Remove build artifacts, caches, .pyc files"
