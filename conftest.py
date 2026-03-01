"""Root conftest for the smilinTux monorepo integration tests.

Fixes skmemory import shadowing: the ``skmemory/`` project directory in
CWD is picked up as a namespace package before the editable install.
We insert the real package path at the front of sys.path so the actual
``skmemory`` package is found first.

NOTE: This sys.path hack is needed because the monorepo layout causes
Python to treat the ``skmemory/`` directory as an implicit namespace
package, shadowing the editable install.  If you run ``pip install -e
skmemory`` the package is on sys.path *after* CWD, so the bare directory
wins.  This insert ensures the real package is resolved first.  The hack
can be removed if the monorepo stops keeping sub-project directories in
the working directory (e.g. by using a src-layout or git submodules that
are not checked out at the top level).
"""

import sys
from pathlib import Path

_skmemory_pkg = str(Path(__file__).parent / "skmemory")
if _skmemory_pkg not in sys.path:
    sys.path.insert(0, _skmemory_pkg)
