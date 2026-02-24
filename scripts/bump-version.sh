#!/usr/bin/env bash
# -------------------------------------------------------------------
# Bump version across all packages in the monorepo.
#
# Usage:
#   ./scripts/bump-version.sh 0.2.0           # bump all packages
#   ./scripts/bump-version.sh 0.2.0 --tag     # bump + create git tag
#   ./scripts/bump-version.sh 0.2.0 --dry-run # show what would change
#
# Updates pyproject.toml and __init__.py for:
#   skcapstone, capauth, skmemory, skcomm
#
# Tool-agnostic: run from any terminal (Claude Code, Cursor, etc.)
# -------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NEW_VERSION="${1:-}"
DO_TAG=false
DRY_RUN=false

for arg in "$@"; do
    case "$arg" in
        --tag) DO_TAG=true ;;
        --dry-run) DRY_RUN=true ;;
    esac
done

if [[ -z "$NEW_VERSION" ]] || [[ "$NEW_VERSION" == --* ]]; then
    echo "Usage: $0 <version> [--tag] [--dry-run]"
    echo "  Example: $0 0.2.0 --tag"
    exit 1
fi

if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "ERROR: Version must be in X.Y.Z format (got: $NEW_VERSION)"
    exit 1
fi

PACKAGES=(skcapstone capauth skmemory skcomm)

echo "Bumping to v${NEW_VERSION}..."
echo ""

for pkg in "${PACKAGES[@]}"; do
    PKG_DIR="$REPO_ROOT/$pkg"

    if [[ ! -d "$PKG_DIR" ]]; then
        echo "  SKIP $pkg (directory not found)"
        continue
    fi

    PYPROJECT="$PKG_DIR/pyproject.toml"
    if [[ -f "$PYPROJECT" ]]; then
        OLD=$(grep -oP 'version\s*=\s*"\K[^"]+' "$PYPROJECT" | head -1)
        if [[ "$DRY_RUN" == true ]]; then
            echo "  [DRY] $pkg/pyproject.toml: $OLD -> $NEW_VERSION"
        else
            sed -i "s/^version = \"$OLD\"/version = \"$NEW_VERSION\"/" "$PYPROJECT"
            echo "  DONE $pkg/pyproject.toml: $OLD -> $NEW_VERSION"
        fi
    fi

    # Update __init__.py if it has __version__
    for init_file in "$PKG_DIR/src/$pkg/__init__.py" "$PKG_DIR/$pkg/__init__.py"; do
        if [[ -f "$init_file" ]] && grep -q "__version__" "$init_file"; then
            OLD_INIT=$(grep -oP '__version__\s*=\s*"\K[^"]+' "$init_file")
            if [[ "$DRY_RUN" == true ]]; then
                echo "  [DRY] ${init_file#$REPO_ROOT/}: $OLD_INIT -> $NEW_VERSION"
            else
                sed -i "s/__version__ = \"$OLD_INIT\"/__version__ = \"$NEW_VERSION\"/" "$init_file"
                echo "  DONE ${init_file#$REPO_ROOT/}: $OLD_INIT -> $NEW_VERSION"
            fi
        fi
    done
done

echo ""

if [[ "$DO_TAG" == true ]] && [[ "$DRY_RUN" == false ]]; then
    echo "Creating git tag v${NEW_VERSION}..."
    git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"
    echo "  Tag v${NEW_VERSION} created."
    echo "  Push with: git push origin v${NEW_VERSION}"
elif [[ "$DO_TAG" == true ]]; then
    echo "[DRY] Would create git tag v${NEW_VERSION}"
fi

echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Commit: git commit -am 'chore: bump version to ${NEW_VERSION}'"
echo "  3. Tag: git tag -a v${NEW_VERSION} -m 'Release v${NEW_VERSION}'"
echo "  4. Push: git push origin main v${NEW_VERSION}"
echo "  5. GitHub Actions will build + publish to PyPI"
