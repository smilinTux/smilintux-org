"""Make varus importable from tests without installation.

NOTE: This sys.path hack is only needed when running ``pytest`` without
first installing the package in dev mode (``pip install -e .``).  If you
have run ``pip install -e .`` in the varus directory, this insert is
redundant but harmless.  It is kept so that ``pytest`` works out of the
box from a fresh checkout without any pip install step.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
