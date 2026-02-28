"""Root conftest for the smilinTux monorepo integration tests.

Fixes skmemory import shadowing: the ``skmemory/`` project directory in
CWD is picked up as a namespace package before the editable install.
We insert the real package path at the front of sys.path so the actual
``skmemory`` package is found first.
"""

import sys
from pathlib import Path

_skmemory_pkg = str(Path(__file__).parent / "skmemory")
if _skmemory_pkg not in sys.path:
    sys.path.insert(0, _skmemory_pkg)
