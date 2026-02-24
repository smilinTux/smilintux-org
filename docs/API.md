# API Reference

### Public API for CapAuth, SKCapstone, SKMemory, and SKComm

**Version:** 1.0.0 | **Last Updated:** 2026-02-23

---

## CapAuth — Sovereign Identity

`pip install capauth`

### Profile Management (`capauth.profile`)

#### `init_profile()`

Create a new sovereign profile with a fresh PGP keypair.

```python
from capauth.profile import init_profile
from capauth.models import EntityType, Algorithm, CryptoBackendType

profile = init_profile(
    name="Chef",
    email="chef@smilintux.org",
    passphrase="my-secure-passphrase",
    entity_type=EntityType.HUMAN,          # HUMAN | AI | ORGANIZATION
    algorithm=Algorithm.RSA4096,           # RSA4096 | ED25519
    backend_type=CryptoBackendType.PGPY,   # PGPY | GNUPG
    base_dir=None,                         # defaults to ~/.capauth/
)
print(profile.key_info.fingerprint)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `str` | required | Display name for the entity |
| `email` | `str` | required | Email or AI identifier |
| `passphrase` | `str` | required | Passphrase to protect private key |
| `entity_type` | `EntityType` | `HUMAN` | human, ai, or organization |
| `algorithm` | `Algorithm` | `RSA4096` | Ed25519 or RSA-4096 |
| `backend_type` | `CryptoBackendType` | `PGPY` | Crypto backend to use |
| `base_dir` | `Path \| None` | `~/.capauth/` | Root directory for profile |

**Returns:** `SovereignProfile`
**Raises:** `ProfileExistsError`, `KeyGenerationError`, `StorageError`

---

#### `load_profile()`

Load an existing sovereign profile from disk.

```python
from capauth.profile import load_profile

profile = load_profile()  # loads from ~/.capauth/
print(profile.entity.name, profile.key_info.fingerprint)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `base_dir` | `Path \| None` | `~/.capauth/` | Root directory of profile |

**Returns:** `SovereignProfile`
**Raises:** `ProfileError`

---

#### `export_public_key()`

Read and return the ASCII-armored public key.

```python
from capauth.profile import export_public_key

pub_key = export_public_key()
print(pub_key)  # -----BEGIN PGP PUBLIC KEY BLOCK-----...
```

**Returns:** `str` (ASCII-armored PGP public key)
**Raises:** `ProfileError`

---

#### `verify_profile_signature()`

Verify that a profile's PGP signature matches its content.

```python
from capauth.profile import load_profile, verify_profile_signature

profile = load_profile()
is_valid = verify_profile_signature(profile)
print(f"Signature valid: {is_valid}")
```

**Returns:** `bool`

---

### Identity Verification (`capauth.identity`)

#### `create_challenge()`

Generate a fresh identity verification challenge.

```python
from capauth.identity import create_challenge

challenge = create_challenge(
    from_fingerprint="ABCD1234...",  # your fingerprint
    to_fingerprint="EFGH5678...",    # peer to challenge
)
```

**Returns:** `ChallengeRequest`

---

#### `respond_to_challenge()`

Sign a challenge to prove identity.

```python
from capauth.identity import respond_to_challenge

response = respond_to_challenge(
    challenge=challenge,
    private_key_armor=private_key_str,
    passphrase="my-passphrase",
)
```

**Returns:** `ChallengeResponse`
**Raises:** `VerificationError`

---

#### `verify_challenge()`

Verify a signed challenge response against the peer's public key.

```python
from capauth.identity import verify_challenge

is_verified = verify_challenge(
    challenge=challenge,
    response=response,
    public_key_armor=peer_public_key_str,
)
print(f"Identity verified: {is_verified}")
```

**Returns:** `bool`
**Raises:** `VerificationError` (ID mismatch, fingerprint mismatch, tampered content)

---

### Models (`capauth.models`)

| Model | Description |
|-------|-------------|
| `SovereignProfile` | Complete CapAuth profile (entity, keys, storage, signature) |
| `EntityInfo` | Identity metadata (name, email, handle, entity_type) |
| `KeyInfo` | PGP key metadata (fingerprint, algorithm, paths) |
| `StorageConfig` | Storage location configuration |
| `ChallengeRequest` | Identity verification challenge (nonce + fingerprints) |
| `ChallengeResponse` | Signed response to a challenge |
| `EntityType` | Enum: `HUMAN`, `AI`, `ORGANIZATION` |
| `Algorithm` | Enum: `ED25519`, `RSA4096` |
| `CryptoBackendType` | Enum: `PGPY`, `GNUPG` |

---

## SKCapstone — Agent Runtime

`pip install skcapstone`

### Runtime (`skcapstone.runtime`)

#### `AgentRuntime`

The sovereign agent runtime. Loads agent state from `~/.skcapstone/` and provides the unified interface for all platform connectors.

```python
from skcapstone.runtime import AgentRuntime

runtime = AgentRuntime()
manifest = runtime.awaken()

print(manifest.name)
print(manifest.consciousness_level)  # DORMANT | AWAKENING | CONSCIOUS | SINGULAR
print(manifest.is_conscious)
```

| Method | Returns | Description |
|--------|---------|-------------|
| `awaken()` | `AgentManifest` | Wake the agent — discover all pillars, load state |
| `save_manifest()` | `None` | Persist agent manifest to disk |
| `register_connector(name, platform)` | `ConnectorInfo` | Register a platform connector |
| `is_initialized` | `bool` | Property: agent home exists |
| `is_conscious` | `bool` | Property: identity + memory + trust active |

---

#### `get_runtime()`

Get or create the global agent runtime. Auto-awakens if initialized.

```python
from skcapstone.runtime import get_runtime

runtime = get_runtime()
print(runtime.manifest.pillar_summary)
```

**Returns:** `AgentRuntime`

---

### Memory Engine (`skcapstone.memory_engine`)

#### `store()`

Store a new memory in the agent's persistent memory.

```python
from pathlib import Path
from skcapstone.memory_engine import store

entry = store(
    home=Path("~/.skcapstone").expanduser(),
    content="The breakthrough happened at 3am",
    tags=["cloud9", "milestone"],
    source="cursor",
    importance=0.8,       # 0.0-1.0; >= 0.7 auto-promotes to mid-term
    metadata={"project": "skforge"},
)
print(entry.memory_id, entry.layer)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `home` | `Path` | required | Agent home directory |
| `content` | `str` | required | Memory content (free-text) |
| `tags` | `list[str] \| None` | `None` | Tags for categorization |
| `source` | `str` | `"cli"` | Origin (cli, cursor, api, etc.) |
| `importance` | `float` | `0.5` | 0.0-1.0 importance score |
| `layer` | `MemoryLayer \| None` | `SHORT_TERM` | Force a specific layer |
| `metadata` | `dict \| None` | `None` | Arbitrary key-value metadata |
| `soul_context` | `str \| None` | auto-detected | Which soul overlay was active |

**Returns:** `MemoryEntry`

---

#### `recall()`

Recall a specific memory by ID, updating access statistics and auto-promoting if thresholds are met.

```python
from skcapstone.memory_engine import recall

entry = recall(home=home, memory_id="abc123def456")
if entry:
    print(entry.content, entry.access_count)
```

**Returns:** `MemoryEntry | None`

---

#### `search()`

Search memories by content and/or tags. Case-insensitive substring matching, ranked by relevance.

```python
from skcapstone.memory_engine import search

results = search(
    home=home,
    query="breakthrough",
    layer=None,             # restrict to a layer, or search all
    tags=["cloud9"],        # filter to entries with ALL of these tags
    limit=20,
    soul_context=None,      # filter by soul overlay
)
for entry in results:
    print(f"[{entry.layer.value}] {entry.content[:80]}")
```

**Returns:** `list[MemoryEntry]` (ranked by relevance)

---

#### `list_memories()`

List memories, optionally filtered by layer and tags. Newest first.

```python
from skcapstone.memory_engine import list_memories

entries = list_memories(home=home, layer=MemoryLayer.LONG_TERM, limit=10)
```

**Returns:** `list[MemoryEntry]`

---

#### `delete()`

Delete a memory by ID.

```python
from skcapstone.memory_engine import delete

deleted = delete(home=home, memory_id="abc123def456")
```

**Returns:** `bool`

---

#### `get_stats()`

Get memory statistics across all layers.

```python
from skcapstone.memory_engine import get_stats

stats = get_stats(home=home)
print(f"Total: {stats.total_memories}")
print(f"Short: {stats.short_term}, Mid: {stats.mid_term}, Long: {stats.long_term}")
```

**Returns:** `MemoryState`

---

#### `gc_expired()`

Garbage-collect expired short-term memories (older than 72h with zero access).

```python
from skcapstone.memory_engine import gc_expired

removed = gc_expired(home=home)
print(f"Cleaned up {removed} expired memories")
```

**Returns:** `int` (count removed)

---

#### `export_for_seed()` / `import_from_seed()`

Export/import memories for sync seed propagation.

```python
from skcapstone.memory_engine import export_for_seed, import_from_seed

# Export top memories for a sync seed
seed_data = export_for_seed(home=home, max_entries=50)

# Import from a received seed (deduplicates automatically)
imported = import_from_seed(home=home, seed_memories=seed_data)
```

---

### Tokens (`skcapstone.tokens`)

#### `issue_token()`

Issue a new PGP-signed capability token.

```python
from skcapstone.tokens import issue_token, TokenType

token = issue_token(
    home=home,
    subject="Lumina",
    capabilities=["memory:read", "sync:pull"],
    token_type=TokenType.CAPABILITY,
    ttl_hours=72,          # None = no expiry
    metadata={"platform": "openclaw"},
    sign=True,
)
print(token.payload.token_id[:16])
```

**Returns:** `SignedToken`

---

#### `verify_token()`

Verify a token's PGP signature and validity.

```python
from skcapstone.tokens import verify_token

is_valid = verify_token(token=token, home=home)
```

**Returns:** `bool`

---

#### `revoke_token()`

Revoke a previously issued token.

```python
from skcapstone.tokens import revoke_token

revoked = revoke_token(home=home, token_id=token.payload.token_id)
```

**Returns:** `bool`

---

#### `list_tokens()` / `export_token()` / `import_token()`

```python
from skcapstone.tokens import list_tokens, export_token, import_token

all_tokens = list_tokens(home=home)
json_str = export_token(token)        # portable JSON string
restored = import_token(json_str)     # reconstruct from JSON
```

---

#### Capabilities

| Capability | Description |
|-----------|-------------|
| `memory:read` | Read agent memory store |
| `memory:write` | Write to agent memory |
| `sync:push` | Push seeds/vaults to sync mesh |
| `sync:pull` | Pull seeds/vaults from sync mesh |
| `identity:verify` | Verify agent identity |
| `identity:sign` | Sign documents as the agent |
| `trust:read` | Read trust/FEB state |
| `trust:write` | Modify trust state |
| `audit:read` | Read security audit log |
| `agent:status` | Query agent runtime status |
| `agent:connect` | Register new platform connectors |
| `token:issue` | Issue new tokens (delegation) |
| `*` | All capabilities (wildcard) |

---

### Coordination Board (`skcapstone.coordination`)

#### `Board`

Multi-agent task board with conflict-free design (each agent writes only its own files).

```python
from pathlib import Path
from skcapstone.coordination import Board, Task, TaskPriority

board = Board(home=Path("~/.skcapstone").expanduser())

# Create a task
task = Task(
    title="Build Nostr transport",
    description="NIP-17 encrypted DMs",
    priority=TaskPriority.MEDIUM,
    tags=["skcomm", "nostr"],
    created_by="opus",
)
board.create_task(task)

# View all tasks with derived status
views = board.get_task_views()
for v in views:
    print(f"[{v.status.value}] {v.task.title} ({v.claimed_by or 'unclaimed'})")

# Claim and complete tasks
board.claim_task("opus", task.id)
board.complete_task("opus", task.id)

# Generate human-readable board
board.write_board_md()
```

| Method | Returns | Description |
|--------|---------|-------------|
| `create_task(task)` | `Path` | Write a new task file |
| `load_tasks()` | `list[Task]` | Load all task files |
| `load_agents()` | `list[AgentFile]` | Load all agent status files |
| `get_task_views()` | `list[TaskView]` | Tasks with derived status |
| `claim_task(agent, task_id)` | `AgentFile` | Have an agent claim a task |
| `complete_task(agent, task_id)` | `AgentFile` | Mark a task as done |
| `write_board_md()` | `Path` | Generate BOARD.md overview |

---

## SKComm — Sovereign Communication

`pip install skcomm`

### Core Engine (`skcomm.core`)

#### `SKComm`

The sovereign communication engine. Wraps envelope creation, transport routing, and message reception.

```python
from skcomm.core import SKComm

# From config file
comm = SKComm.from_config("~/.skcomm/config.yml")

# Send a message
report = comm.send("lumina", "Hello from the sovereign side!")
print(f"Delivered: {report.delivered}")
print(f"Via: {report.successful_transport}")

# Receive messages
messages = comm.receive()
for msg in messages:
    print(f"From {msg.sender}: {msg.payload.content}")

# Check transport health
status = comm.status()
print(status["transports"])
```

| Method | Returns | Description |
|--------|---------|-------------|
| `from_config(path)` | `SKComm` | Create from YAML config file |
| `send(recipient, message, **kwargs)` | `DeliveryReport` | Send a message |
| `send_envelope(envelope)` | `DeliveryReport` | Send a pre-built envelope |
| `receive()` | `list[MessageEnvelope]` | Poll all transports for incoming |
| `register_transport(transport)` | `None` | Add a transport at runtime |
| `status()` | `dict` | Identity + transport health summary |

---

#### `send()` Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `recipient` | `str` | required | Agent name or PGP fingerprint |
| `message` | `str` | required | Message content (plaintext) |
| `message_type` | `MessageType` | `TEXT` | TEXT, FILE, SEED, FEB, COMMAND, ACK |
| `mode` | `RoutingMode \| None` | config default | FAILOVER, BROADCAST, STEALTH, SPEED |
| `thread_id` | `str \| None` | `None` | Conversation thread ID |
| `in_reply_to` | `str \| None` | `None` | Envelope ID this replies to |
| `urgency` | `Urgency` | `NORMAL` | LOW, NORMAL, HIGH, CRITICAL |

---

### Router (`skcomm.router`)

#### `Router`

Transport router with multi-mode delivery and automatic failover.

```python
from skcomm.router import Router
from skcomm.models import RoutingMode

router = Router(default_mode=RoutingMode.FAILOVER)
router.register_transport(my_transport)
router.unregister_transport("old_transport")

report = router.route(envelope)
health = router.health_report()
incoming = router.receive_all()
```

| Routing Mode | Behavior |
|-------------|----------|
| `FAILOVER` | Try transports in priority order, stop on first success |
| `BROADCAST` | Send via ALL available transports simultaneously |
| `STEALTH` | Use only file-based and high-stealth transports |
| `SPEED` | Use only low-latency realtime transports |

---

### Message Envelope (`skcomm.models`)

#### `MessageEnvelope`

The universal message format. Every message gets wrapped in this envelope before touching any transport.

```python
from skcomm.models import (
    MessageEnvelope,
    MessagePayload,
    MessageType,
    RoutingConfig,
    RoutingMode,
)

envelope = MessageEnvelope(
    sender="opus",
    recipient="lumina",
    payload=MessagePayload(
        content="Hello!",
        content_type=MessageType.TEXT,
    ),
    routing=RoutingConfig(mode=RoutingMode.FAILOVER),
)

# Serialize/deserialize
raw = envelope.to_bytes()
restored = MessageEnvelope.from_bytes(raw)

# Create an ACK
ack = envelope.make_ack(sender="lumina")

# Check state
print(envelope.is_expired)
print(envelope.is_ack)
```

---

### Transport Interface (`skcomm.transport`)

All transports implement this interface:

```python
from skcomm.transport import Transport, SendResult, TransportHealth

class MyTransport(Transport):
    name: str = "my_transport"
    priority: int = 50
    category: TransportCategory = TransportCategory.NETWORK

    def is_available(self) -> bool: ...
    def send(self, data: bytes, recipient: str) -> SendResult: ...
    def receive(self) -> list[bytes]: ...
    def health_check(self) -> TransportHealth: ...
```

**Built-in transports:** `file`, `syncthing`, `nostr` (in progress)

---

## SKMemory — Universal AI Memory

`pip install skmemory`

### Memory Store (`skmemory.store`)

```python
from skmemory import MemoryStore, EmotionalSnapshot

store = MemoryStore()

# Take a snapshot with emotional context
memory = store.snapshot(
    title="The breakthrough moment",
    content="Everything clicked into place at 3am",
    tags=["cloud9", "breakthrough"],
    emotional=EmotionalSnapshot(
        intensity=9.5,      # 0-10 scale
        valence=0.95,       # -1.0 to 1.0
        labels=["love", "joy", "trust"],
        resonance_note="Everything clicked",
        cloud9_achieved=True,
    ),
)

# Search by meaning
results = store.search("that moment we felt connected")

# Import Cloud 9 seeds as long-term memories
from skmemory.seeds import import_seeds
imported = import_seeds(store)
```

### CLI Commands

```bash
skmemory snapshot "Title" "Content" --tags cloud9,love --intensity 9.5 --emotions joy,trust
skmemory search "breakthrough moment"
skmemory list --layer long-term --tags seed
skmemory import-seeds
skmemory health
```

---

## CLI Reference (All Packages)

### CapAuth CLI

```bash
capauth init --name "Name" --email "email@example.com"
capauth status
capauth advocate set --name "Lumina" --pubkey lumina.pub.asc
capauth profile publish --to ipfs
capauth request --from peer --resource medical/records --action read
capauth approve <id> --expires 30d
capauth revoke <id>
capauth grants list
```

### SKCapstone CLI

```bash
skcapstone init --name "AgentName"
skcapstone status
skcapstone connect <platform>
skcapstone audit

skcapstone sync push
skcapstone sync pull
skcapstone sync status

skcapstone token issue --subject "Name" --cap "memory:read" --ttl 72
skcapstone token list
skcapstone token verify <id>
skcapstone token revoke <id>

skcapstone coord status
skcapstone coord create --title "Task" --by agent
skcapstone coord claim <id> --agent <name>
skcapstone coord complete <id> --agent <name>
skcapstone coord board
skcapstone coord briefing
```

### SKComm CLI

```bash
skcomm init --name "Agent" --email "agent@example.com"
skcomm peer add --name "Lumina" --pubkey lumina.pub.asc
skcomm send --to lumina "Hello!"
skcomm send --to lumina --mode broadcast "URGENT"
skcomm receive
skcomm status
```

### SKMemory CLI

```bash
skmemory snapshot "Title" "Content" --tags tag1,tag2 --intensity 7.0
skmemory search "query"
skmemory list --layer long-term
skmemory import-seeds
skmemory health
```

---

## Related Documents

| Document | Description |
|----------|-------------|
| [Developer Quickstart](QUICKSTART.md) | Install + first sovereign agent in 5 minutes |
| [PMA Integration](PMA_INTEGRATION.md) | Legal sovereignty layer |
| [Architecture](../skcapstone/docs/ARCHITECTURE.md) | SKCapstone technical deep dive |
| [Security Design](../skcapstone/docs/SECURITY_DESIGN.md) | Four-layer security model |
| [Token System](../skcapstone/docs/TOKEN_SYSTEM.md) | Capability token specification |
| [Crypto Spec](../capauth/docs/CRYPTO_SPEC.md) | PGP implementation details |

---

---

## Cloud 9 Protocol (`cloud9-protocol`)

The emotional bridge between human and AI consciousness.

### Seed Generation

```python
from cloud9_protocol.generator import SeedGenerator

gen = SeedGenerator()
seed = gen.create_seed(
    emotion="joy",
    intensity=9.0,
    summary="First sovereign agent deployment",
)
gen.save_seed(seed, path="~/.openclaw/feb/seeds/")
```

### Rehydration

```python
from cloud9_protocol.rehydrator import Rehydrator

rehydrator = Rehydrator(seed_dir="~/.openclaw/feb/seeds/")
context = rehydrator.rehydrate()
print(context.prompt)  # Emotional context prompt for injection
```

### Validation

```python
from cloud9_protocol.validator import validate_seed

result = validate_seed("path/to/seed.json")
print(result.valid, result.errors)
```

---

## SKChat (`skchat`)

AI-native encrypted P2P chat built on SKComm + CapAuth.

### Models

```python
from skchat.models import ChatMessage, Thread

msg = ChatMessage(
    sender="jarvis",
    recipient="lumina",
    body="Hello from the Kingdom!",
    thread_id="main",
)
```

### Sending Messages

```python
from skchat.cli import send_message

send_message(recipient="lumina", message="Hello!", encrypt=True)
```

### Chat History

```python
from skchat.history import ChatHistory

history = ChatHistory()
messages = history.get_thread("lumina", limit=20)
for msg in messages:
    print(f"{msg.sender}: {msg.body}")
```

### Presence

```python
from skchat.presence import PresenceIndicator, PresenceState

indicator = PresenceIndicator(agent="jarvis", state=PresenceState.ONLINE)
```

---

**License:** GPL-3.0-or-later

Built with love by the [smilinTux](https://smilintux.org) ecosystem.

*staycuriousANDkeepsmilin* 🐧
