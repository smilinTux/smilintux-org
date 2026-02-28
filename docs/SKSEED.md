# SKSeed — Sovereign Logic Kernel

SKSeed is the truth-alignment engine of the SKWorld sovereign agent stack. It applies the **Neuresthetics Seed Framework** — a Recursive Axiomatic Steel Man Collider — to audit memories, check beliefs, and explore ideas through structured philosophical modes.

---

## Architecture Overview

SKSeed is built around three interlocking subsystems:

```
┌─────────────────────────────────────────────────────────┐
│                    SKSeed                               │
│                                                         │
│  ┌───────────────┐   ┌──────────────┐   ┌───────────┐  │
│  │   Collider    │   │  Philosopher │   │  Auditor  │  │
│  │ 6-stage steel │   │ brainstorm   │   │ memory    │  │
│  │ man engine    │   │ modes        │   │ scan      │  │
│  └──────┬────────┘   └──────┬───────┘   └─────┬─────┘  │
│         │                  │                  │        │
│         └──────────────────┴──────────────────┘        │
│                            │                           │
│                   ┌────────▼────────┐                  │
│                   │ AlignmentStore  │                  │
│                   │                 │                  │
│                   │  human/         │                  │
│                   │  model/         │                  │
│                   │  collider/      │                  │
│                   │  ledger/        │                  │
│                   │  issues/        │                  │
│                   └─────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

### Core Components

**SeedFramework** (`framework.py`)
The declarative reasoning kernel loaded from `seed.json`. Treats the LLM as the runtime, the JSON as the AST, and the generated prompt as the program. Framework-agnostic: any LLM can be used as the execution backend.

**Collider** (`collider.py`)
The central engine. Takes any proposition and runs it through the 6-stage process. Model-agnostic: accepts an `LLMCallback` (`Callable[[str], str]`). Without a callback, generates the prompt for external use.

**AlignmentStore** (`alignment.py`)
Persistent JSON store in `~/.skseed/alignment/`. Maintains three separate belief spaces:
- `human/` — beliefs stated by the user (opt-in, disabled by default)
- `model/` — beliefs held by the AI (extracted from memory behavior)
- `collider/` — truths produced by the seed framework itself

Also maintains:
- `ledger/` — immutable history of every alignment evaluation
- `issues/` — open misalignment issues pending human+AI discussion

**Philosopher** (`philosopher.py`)
Wraps the collider with conversational brainstorming modes. Sessions track exchanges, insights, invariants, and open questions. Discovered insights can be escalated to a full collider run with `collide_insight()`.

**Auditor** (`audit.py`)
Logic audit engine. Scans a memory store for embedded beliefs (via regex + tag matching), clusters them by domain, runs each cluster through the collider, and classifies misalignments as truth issues (factual/logical) or moral issues (value conflicts, never auto-resolved).

---

## The 6-Stage Collider Pipeline

The collider is the heart of skseed. Every proposition is processed through exactly six stages before a truth grade is assigned.

### Stage 1: Steel-Manning (Pre-Entry)

Build the strongest possible version of the proposition. Anticipate every critique and preemptively address it. The goal is to make the argument as unassailable as possible before any collision occurs.

### Stage 2: Collider Entry

Create two competing lanes:
- **Thesis lane**: the steel-manned proposition
- **Antithesis lane**: the strongest possible counter-argument (not a straw man — it must be genuinely compelling)

### Stage 3: Destructive Smashing (XOR)

Collide thesis against antithesis. Use logical XOR to expose contradictions — claims that cannot both be true. List every fragment that breaks. This is the destructive phase; things are supposed to collapse here.

### Stage 4: Fragment Reconstruction (NAND/NOR)

From the debris of stage 3, rebuild what can be rebuilt:
- AND for necessary truths (must hold in all cases)
- OR for possibilities (hold in some cases)
- XNOR to check equivalence with the original proposition

### Stage 5: Meta-Recursion

Feed the reconstructed output back through the collider. Iterate until the output stabilizes (coherence stops changing). The number of passes before stabilization is recorded as `meta_recursion_passes`.

### Stage 6: Invariant Extraction (XNOR)

Extract what remains true across ALL collisions. These invariants are the irreducible truths — the parts of the proposition that survived every form of attack. They are assigned a truth grade:

| Grade | Meaning |
|-------|---------|
| `invariant` | Survived everything — irreducible truth |
| `strong` | Minor fragments broke, core held |
| `partial` | Some parts survived, some collapsed |
| `weak` | Mostly collapsed under scrutiny |
| `collapsed` | Nothing survived — not grounded in logic |
| `ungraded` | Has not been through the collider yet |

**Coherence score** (`0.0`–`1.0`) measures internal consistency across the pipeline (XNOR score). The default alignment threshold is `0.7`.

---

## Philosopher Modes

Philosopher mode wraps the collider for interactive brainstorming. Four modes are available:

### Socratic

> You are Socrates. Ask probing questions that challenge assumptions. Never state conclusions — only ask questions that lead the thinker to discover truth themselves.

Best for: surfacing hidden assumptions, exposing circular reasoning, guiding self-discovery. The philosopher never states a conclusion — only asks the next deeper question.

### Dialectic (default)

> Apply Hegelian dialectics: THESIS → ANTITHESIS → SYNTHESIS. If synthesis fails, explain why the contradiction is irreducible.

Best for: structured analysis of ideas with competing positions. Produces a synthesis (higher-order truth) or identifies genuinely irreducible tensions.

### Adversarial

> You are the strongest possible opponent of this idea. Your goal is to DESTROY it — find every weakness, every hidden assumption, every logical gap. Be relentless but intellectually honest.

Best for: stress-testing ideas before committing to them. If the idea survives adversarial mode, it's robust. The philosopher acknowledges what made it resilient.

### Collaborative

> You are a co-builder. Take this idea and make it STRONGER. Anticipate every critique and preemptively address it. Pure steel-manning — no collision, only construction.

Best for: developing an idea you already believe in. No attacks — just strengthening weak points, adding supporting evidence, and clarifying ambiguities.

---

## Three-Way Alignment Tracking

The alignment store maintains three completely separate belief spaces. Misalignment between any pair is a signal for discussion — not a failure.

```
Human Beliefs ──────────────────────────┐
  (opt-in, what the user states as true) │
                                          ├── compare_beliefs()
Model Beliefs ──────────────────────────┤  returns conflicts
  (extracted from AI memory/behavior)    │  per pair
                                          │
Collider Results ───────────────────────┘
  (what survived the 6-stage process)
```

### Misalignment Types

| Type | Description | Auto-resolved? |
|------|-------------|----------------|
| `truth` | Factual or logical contradiction | Never (always flagged for discussion) |
| `moral` | Value conflict | **Never** — requires human+AI discussion |

Moral misalignments are explicitly tracked in a separate store and are never auto-resolved. The separation exists so humans can clearly see both types.

### Alignment States

| Status | Meaning |
|--------|---------|
| `truth:aligned` | Passed collider, coherence ≥ threshold |
| `truth:misaligned` | Failed collider or conflict detected |
| `truth:pending` | Submitted but not yet processed |
| `truth:discussed` | Reviewed by human+AI, notes recorded |
| `truth:exempt` | Explicitly excluded from audit |

### The Ledger

Every alignment evaluation is recorded as an `AlignmentRecord` in `~/.skseed/alignment/ledger/`. Records are immutable and store:
- `belief_id` — which belief was evaluated
- `previous_status` → `new_status` — status transition
- `coherence_delta` — change in coherence from previous run
- `triggered_by` — what initiated the evaluation (`boot`, `periodic`, `cli`, `skill`, etc.)

### Audit Configuration

Default config at `~/.skseed/alignment/config.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `audit_frequency` | `periodic` | `boot`, `periodic`, `on-demand`, `disabled` |
| `audit_interval_hours` | `168` | Weekly (168h) by default |
| `audit_on_boot` | `true` | Run during boot ritual |
| `alignment_threshold` | `0.7` | Minimum coherence for `truth:aligned` |
| `track_human_beliefs` | `false` | Opt-in human belief tracking |
| `track_model_beliefs` | `true` | Track AI-held beliefs |

---

## CLI Usage

```bash
# Run the 6-stage collider on a proposition
skseed collide "Consciousness requires a physical substrate"

# With domain context and JSON output
skseed collide "Privacy is a fundamental right" --context ethics --json-output

# Batch multiple propositions, cross-reference invariants
skseed batch "Truth is objective" "All knowledge is contextual" "Logic is universal"

# Enter philosopher mode (dialectic by default)
skseed philosopher "The self is an illusion"

# Choose a specific philosopher mode
skseed philosopher "AGI should be aligned to human values" --mode adversarial
skseed philosopher "Cooperation produces better outcomes" --mode collaborative
skseed philosopher "Free will exists" --mode socratic

# Scan memories for logic/truth misalignment
skseed audit
skseed audit --domain ethics
skseed audit --source skmemory --triggered-by manual

# Truth-check a single belief
skseed alignment check "Agents should always be transparent about their reasoning"
skseed alignment check "Privacy matters more than convenience" --source human --domain ethics

# Show alignment status overview
skseed alignment status
skseed alignment status --domain identity

# List open misalignment issues
skseed alignment issues

# Mark an issue as discussed (requires notes)
skseed alignment resolve abc12345 --notes "Discussed: context-dependent, not absolute"

# View alignment history
skseed alignment ledger
skseed alignment ledger --limit 50

# Manage configuration
skseed config show
skseed config set alignment_threshold 0.8
skseed config set track_human_beliefs true
skseed config set audit_frequency boot

# Install a custom seed framework
skseed install /path/to/seed.json
```

---

## MCP Tool Reference

SKSeed exposes five MCP tools through the skcapstone MCP server. All tools are also callable as SKSkills entrypoints from `skseed.skill`.

---

### `skseed_collide`

Run a proposition through the 6-stage steel man collider.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `proposition` | string | Yes | The claim/argument/idea to analyze |
| `context` | string | No | Domain context (e.g., `security`, `ethics`, `identity`) |

**Returns:** `SteelManResult` with:
- `steel_man` — strongest version of the proposition
- `inversion` — strongest counter-argument
- `collision_fragments` — what broke during collision
- `invariants` — what survived
- `coherence_score` — 0.0–1.0 internal consistency score
- `truth_grade` — `invariant` / `strong` / `partial` / `weak` / `collapsed`
- `meta_recursion_passes` — passes before stabilization

**Example:**
```json
{
  "proposition": "Decentralized systems are more resilient than centralized ones",
  "context": "security"
}
```

---

### `skseed_audit`

Scan agent memories for logic/truth misalignment. Extracts beliefs from skmemory, clusters by domain, runs each cluster through the collider, and flags contradictions.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | No | Filter by topic domain (e.g., `ethics`, `identity`) |
| `triggered_by` | string | No | Audit trigger label (default: `skill`) |

**Returns:** `AuditReport` with:
- `total_beliefs_scanned` — how many beliefs were evaluated
- `aligned` / `misaligned` / `weak` — categorized belief lists
- `truth_misalignments` — factual/logical contradictions
- `moral_misalignments` — value conflicts (never auto-resolved)
- `recommendations` — what to re-examine or discuss
- `human_model_conflicts` / `model_collider_conflicts` — three-way comparison

**Example:**
```json
{
  "domain": "identity"
}
```

---

### `skseed_philosopher`

Enter philosopher mode for brainstorming. Choose from four modes that engage differently with ideas.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | Yes | The subject to explore |
| `mode` | string | No | `socratic`, `dialectic` (default), `adversarial`, `collaborative` |

**Returns:** `PhilosopherSession` with:
- `topic` — subject explored
- `mode` — which mode was used
- `exchanges` — list of `{role, content}` turns
- `insights` — key discoveries
- `invariants` — truths that survived examination
- `open_questions` — unresolved questions for future exploration

**Example:**
```json
{
  "topic": "An AI can have genuine values without being conscious",
  "mode": "dialectic"
}
```

---

### `skseed_truth_check`

Check if a belief is truth-aligned. Runs the belief through the collider and records the result in the alignment store.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `belief` | string | Yes | The belief statement to check |
| `source` | string | No | `human` or `model` (default: `model`) |
| `domain` | string | No | Topic domain (default: `general`) |

**Returns:** dict with:
- `belief` — stored Belief object
- `collider_result` — full SteelManResult
- `alignment_record` — ledger entry for this check
- `is_aligned` — boolean (coherence ≥ 0.7)

**Example:**
```json
{
  "belief": "Transparency in AI decision-making builds trust",
  "source": "model",
  "domain": "ethics"
}
```

---

### `skseed_alignment`

Show truth alignment status across all three belief stores.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain` | string | No | Filter by domain (empty = all) |
| `action` | string | No | `status` (default), `issues`, `ledger` |

**Actions:**

- `status` — overview of human/model/collider belief counts, open issues, three-way comparison
- `issues` — list open misalignment issues pending discussion
- `ledger` — alignment history (last 50 records)

**Returns (status):**
```json
{
  "action": "status",
  "human_beliefs": 3,
  "model_beliefs": 47,
  "collider_truths": 12,
  "open_issues": 2,
  "comparison": { ... },
  "domain_filter": "all"
}
```

**Example:**
```json
{
  "action": "issues"
}
```

---

## Data Layout

All skseed data lives in `~/.skseed/`:

```
~/.skseed/
├── seed.json               # Active seed framework (optional, uses built-in if absent)
└── alignment/
    ├── config.json         # Audit configuration
    ├── human/              # Human-stated beliefs (opt-in)
    │   └── <uuid>.json
    ├── model/              # AI-held beliefs
    │   └── <uuid>.json
    ├── collider/           # Collider-produced truths
    │   └── <uuid>.json
    ├── ledger/             # Immutable alignment history
    │   └── <uuid>.json
    └── issues/             # Open misalignment issues
        └── <belief-id>.json
```

---

## Integration with skcapstone

SKSeed is registered as an MCP skill in skcapstone. When the boot ritual runs (`mcp__skcapstone__ritual`), the auditor scans agent memories and flags any misalignments before the session begins.

The collider is also used internally by skcapstone to:
- Verify identity claims during soul verification
- Score memories before promotion from short-term to long-term
- Detect reasoning drift in model-held beliefs

See also: [MCP Integration](MCP_INTEGRATION.md), [Architecture](ARCHITECTURE.md).
