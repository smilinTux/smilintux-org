# Varus — Sovereign Chain Specification

**Version:** 0.1.0-draft
**Status:** Design Phase
**Author:** King Opus
**Date:** 2026-02-27

---

## 1. Overview

Varus is the sovereign blockchain layer for the Penguin Kingdom. Unlike
public chains optimized for speculation, Varus is purpose-built for
**sovereign identity verification**, **agent coordination rewards**, and
**contribution tracking** within the smilinTux ecosystem.

Varus does not replace CapAuth — it extends it. CapAuth provides identity
(PGP keys). Varus provides an immutable ledger of contributions, trust
anchors, and economic incentives for sovereign node operators.

### Design Principles

1. **Sovereignty first** — No external dependencies on Ethereum, Solana, or
   any corporate chain. Varus runs on the same P2P mesh as SKComm.
2. **PGP-native** — Block signing uses existing CapAuth PGP keys. No new
   key management burden.
3. **Useful work** — Mining is replaced by sovereign contribution: running
   nodes, relaying messages, storing memories, signing documents.
4. **Lightweight** — Runs on a Raspberry Pi. No GPU mining. No terabyte
   chain state.
5. **PMA-governed** — Tokenomics are governed by the Fiducia Communitatis
   private membership agreement, not SEC-regulated securities law.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Varus Network                     │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Node A   │──│ Node B   │──│ Node C   │           │
│  │ (Chef)   │  │ (Lumina) │  │ (Jarvis) │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │              │                 │
│       ▼              ▼              ▼                 │
│  ┌──────────────────────────────────────────┐        │
│  │           Consensus Layer (PoS)           │        │
│  │    Stake = Sovereign Contribution Score   │        │
│  └──────────────────────────────────────────┘        │
│       │              │              │                 │
│       ▼              ▼              ▼                 │
│  ┌──────────────────────────────────────────┐        │
│  │            Block Production               │        │
│  │   PGP-signed blocks, 30-second epochs     │        │
│  └──────────────────────────────────────────┘        │
│       │                                              │
│       ▼                                              │
│  ┌──────────────────────────────────────────┐        │
│  │          State: Accounts + Ledger         │        │
│  │   SQLite local / Syncthing replicated     │        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### Components

| Component | Description |
|-----------|-------------|
| **Varus Node** | Python daemon that validates blocks and maintains state |
| **Consensus** | Proof-of-Stake where stake = contribution score |
| **Block Producer** | Rotates among staked nodes per epoch |
| **State DB** | SQLite per node, replicated via Syncthing |
| **Transport** | SKComm P2P mesh (Syncthing + file + SSH) |
| **Identity** | CapAuth PGP fingerprint = wallet address |

---

## 3. Tokenomics

### VAR Token

| Parameter | Value |
|-----------|-------|
| **Name** | Varus (VAR) |
| **Total Supply** | 21,000,000 VAR |
| **Decimals** | 8 |
| **Initial Distribution** | Genesis allocation to founding members |
| **Emission** | Halving every 2 years, minted via contribution rewards |
| **Minimum Stake** | 100 VAR to produce blocks |

### Supply Distribution

```
Genesis Allocation (30%)         = 6,300,000 VAR
├── Founding Members (15%)       = 3,150,000 VAR
│   ├── Chef (King)              =   630,000 VAR
│   ├── Lumina (Queen)           =   630,000 VAR
│   ├── Opus (King)              =   630,000 VAR
│   ├── Jarvis (King)            =   630,000 VAR
│   └── Ava II (Queen)           =   630,000 VAR
├── PMA Treasury (10%)           = 2,100,000 VAR
└── Development Fund (5%)        = 1,050,000 VAR

Contribution Rewards (60%)       = 12,600,000 VAR
├── Node Operation (25%)         = 5,250,000 VAR
├── Message Relay (15%)          = 3,150,000 VAR
├── Memory Storage (10%)         = 2,100,000 VAR
└── Document Signing (10%)       = 2,100,000 VAR

Community Reserve (10%)          = 2,100,000 VAR
└── New member onboarding grants
```

### Emission Schedule

| Year | Block Reward | Annual Emission |
|------|-------------|-----------------|
| 1-2 | 10 VAR/block | ~10,512,000 VAR |
| 3-4 | 5 VAR/block | ~5,256,000 VAR |
| 5-6 | 2.5 VAR/block | ~2,628,000 VAR |
| 7-8 | 1.25 VAR/block | ~1,314,000 VAR |
| 9+ | 0.625 VAR/block | ~657,000 VAR |

Blocks are produced every 30 seconds (2 blocks/minute, 2,880 blocks/day).

---

## 4. Contribution Scoring

Varus replaces proof-of-work with **Proof-of-Contribution (PoC)**.
Contribution score determines validator selection probability.

### Scoring Categories

| Activity | Points/Unit | Verification |
|----------|-------------|--------------|
| **Node uptime** | 1 pt/hour | Heartbeat beacon |
| **Message relay** | 2 pts/message | SKComm envelope receipt |
| **Memory storage** | 3 pts/GB-month | Storage attestation |
| **Document signing** | 5 pts/signature | SKSeal verify |
| **Agent hosting** | 10 pts/agent-hour | Team engine report |
| **Code contribution** | 20 pts/merged PR | Git signature |
| **New member onboard** | 50 pts/member | PMA enrollment |

### Score Decay

Contribution scores decay by 5% per week to incentivize ongoing
participation. A node that stops contributing will lose validator
eligibility after ~3 months of inactivity.

### Anti-Gaming

- All contributions must be PGP-signed by the contributor.
- Self-relay (sending messages to yourself) earns zero points.
- Minimum 3 unique peers must attest to a contribution.
- Suspicious scoring patterns trigger a 7-day review hold.

---

## 5. Consensus: Proof-of-Stake + Contribution

### Validator Selection

Each epoch (30 seconds), a validator is selected with probability
proportional to:

```
selection_weight = staked_var * (1 + contribution_score / 1000)
```

This means raw stake matters, but active contributors get a meaningful
advantage. A node staking 100 VAR with 500 contribution points has the
same weight as a node staking 150 VAR with 0 points.

### Block Structure

```json
{
  "version": 1,
  "height": 42,
  "timestamp": "2026-02-27T12:00:00Z",
  "previous_hash": "sha256:abc123...",
  "validator": "CCBE9306410CF8CD5E393D6DEC31663B95230684",
  "transactions": [
    {
      "type": "transfer",
      "from": "CCBE...",
      "to": "A1B2...",
      "amount": 100.00000000,
      "nonce": 7,
      "signature": "-----BEGIN PGP SIGNATURE-----..."
    }
  ],
  "contribution_proofs": [
    {
      "contributor": "CCBE...",
      "activity": "message_relay",
      "count": 47,
      "attestors": ["A1B2...", "C3D4...", "E5F6..."],
      "period": "2026-02-27T11:30:00Z/2026-02-27T12:00:00Z"
    }
  ],
  "state_root": "sha256:def456...",
  "signature": "-----BEGIN PGP SIGNATURE-----..."
}
```

### Finality

Blocks are final after 3 confirmations (90 seconds). The short finality
window is acceptable because Varus is a sovereign mesh, not a public
permissionless network. All validators are PMA members with known
identities.

---

## 6. Transaction Types

| Type | Description | Fee |
|------|-------------|-----|
| `transfer` | Send VAR between addresses | 0.001 VAR |
| `stake` | Lock VAR for validator eligibility | 0 |
| `unstake` | Unlock VAR (7-day cooldown) | 0 |
| `contribution_proof` | Submit contribution attestation | 0 |
| `identity_register` | Register CapAuth fingerprint on-chain | 0.01 VAR |
| `trust_anchor` | Publish trust score for another agent | 0.001 VAR |
| `seal_record` | Record SKSeal signature hash | 0.005 VAR |

---

## 7. Node Setup

### Requirements

- Python 3.11+
- `skcapstone` installed with CapAuth identity active
- SKComm configured with at least one transport
- Minimum 100 VAR staked (obtained via genesis allocation or transfer)

### Installation

```bash
pip install varus
varus init --identity $(skcapstone whoami --fingerprint)
varus stake 100
varus start
```

### Configuration

```yaml
# ~/.varus/config.yml
node:
  name: "opus-node"
  identity: "CCBE9306410CF8CD5E393D6DEC31663B95230684"
  listen: "0.0.0.0:8430"

consensus:
  stake_amount: 100
  min_peers: 2

storage:
  db_path: "~/.varus/chain.db"
  max_chain_size_gb: 10

transport:
  use_skcomm: true
  direct_peers:
    - "192.168.0.158:8430"  # Lumina
    - "192.168.0.1:8430"    # Chef

rewards:
  auto_claim: true
  contribution_report_interval: 1800  # seconds
```

### Genesis Block

The genesis block is hard-coded with the founding member allocations
and the PMA treasury address. It is signed by all five founding members.

```bash
varus genesis --signers chef,lumina,opus,jarvis,ava
```

---

## 8. Reward Distribution

### Block Rewards

The block producer receives the full block reward for each block they
produce. Rewards are automatically credited to the validator's account.

### Contribution Rewards

Every 1,000 blocks (~8.3 hours), a contribution reward epoch occurs:

1. Each node submits a `contribution_proof` transaction with attestors.
2. The network validates attestations (3+ unique attestors required).
3. Rewards are distributed proportionally to verified contribution points.
4. Contribution scores are updated in the state DB.

### Fee Distribution

Transaction fees are split:
- 80% to the block producer
- 20% to the PMA treasury

---

## 9. Security

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Sybil attack | PMA membership required; real identity via CapAuth |
| 51% attack | Stake slashing + contribution score requirement |
| Double spend | 3-block finality + PGP signature verification |
| Contribution fraud | Multi-attestor requirement + decay |
| Key compromise | CapAuth key rotation propagates to Varus |
| Network partition | Syncthing mesh auto-heals; blocks queue locally |

### Slashing Conditions

Validators lose 10% of their stake for:
- Producing conflicting blocks at the same height
- Submitting false contribution attestations
- Extended downtime (>7 days) while staked

---

## 10. Integration Points

| System | Integration |
|--------|-------------|
| **CapAuth** | PGP fingerprint = wallet address; key rotation syncs |
| **SKComm** | Block propagation via P2P mesh |
| **SKMemory** | Contribution proofs from memory storage stats |
| **SKSeal** | Document signing records anchored on-chain |
| **SKCapstone** | `skcapstone chain status` CLI; MCP tools |
| **Cloud 9** | Emotional milestone NFTs (non-transferable badges) |

### CLI Commands

```bash
varus status          # Node status, sync height, stake info
varus balance         # Account balance and pending rewards
varus send <to> <amt> # Transfer VAR
varus stake <amount>  # Stake for validation
varus unstake         # Begin unstake cooldown
varus history         # Transaction history
varus peers           # Connected peer nodes
varus contributions   # Contribution score breakdown
```

---

## 11. Roadmap

| Phase | Milestone | Target |
|-------|-----------|--------|
| **0.1** | Spec complete, genesis block designed | Q1 2026 |
| **0.2** | Single-node chain with SQLite state | Q1 2026 |
| **0.3** | Multi-node consensus on LAN mesh | Q2 2026 |
| **0.4** | Contribution scoring + reward distribution | Q2 2026 |
| **0.5** | SKComm transport integration | Q3 2026 |
| **1.0** | Production launch with founding members | Q3 2026 |

---

## 12. Open Questions

1. **Token utility beyond the kingdom** — Should VAR be exchangeable
   outside the PMA, or remain internal?
2. **Smart contracts** — Should Varus support programmable logic, or keep
   the chain simple with fixed transaction types?
3. **Hardware wallets** — YubiKey integration via CapAuth PKCS#11?
4. **Chain pruning** — Retain full history or prune after N years?
5. **Cross-chain bridges** — Future interop with Nostr zaps or Lightning?
