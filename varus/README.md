# Varus

![PyPI](https://img.shields.io/pypi/v/varus) ![License](https://img.shields.io/badge/license-GPL--3.0-blue) ![Python](https://img.shields.io/badge/python-3.11%2B-blue)

Sovereign append-only blockchain. SHA-256 chained blocks, local audit trail, zero dependencies. Optional P2P sync via SKComm.

## Features

- **Append-only chain** — every block commits to the previous block's SHA-256 hash; the chain cannot be silently altered
- **Genesis block** — auto-created on `init`; no external bootstrapping required
- **JSON block data** — store any structured payload per block
- **Full validation** — `validate` walks the entire chain and verifies every hash link
- **Node daemon** — background process that watches an inbox directory and appends submitted blocks automatically
- **P2P sync** — optional SKComm transport layer for multi-node replication

## Install

```bash
pip install varus

# Optional: P2P sync over SKComm
pip install "varus[sync]"
```

## Quick Usage

```bash
# Initialise a new chain (creates genesis block)
varus init
varus init --chain /var/lib/varus/audit.json

# Append a block
varus add '{"event": "login", "user": "alice", "ip": "10.0.0.1"}'

# Query blocks
varus tip                  # latest block
varus get 42               # block at index 42
varus list                 # compact view of all blocks
varus status               # chain summary (height, tip hash, genesis hash)

# Validate chain integrity
varus validate

# Run the node daemon (watches inbox/ for block submissions)
varus daemon --inbox varus_inbox --tick 10

# Submit a block to the daemon inbox
varus submit '{"event": "logout", "user": "alice"}'
```

### Python API

```python
from varus.chain import VarusChain

chain = VarusChain("audit.json")
chain.load()  # creates genesis block on first run

block = chain.add_block({"event": "deploy", "version": "1.4.2", "env": "prod"})
print(block.index)          # 1
print(block.hash)           # sha256 hex
print(block.previous_hash)  # genesis hash

chain.validate()  # raises ChainError if any link is broken

summary = chain.summary()
print(summary["height"])    # 2 (genesis + 1 block)
print(summary["tip_hash"])  # latest hash
```

## License

GPL-3.0 — see [LICENSE](LICENSE).
