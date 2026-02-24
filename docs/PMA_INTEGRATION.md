# PMA Legal Framework Integration

### Fiducia Communitatis — The Sovereign Legal Layer

**Version:** 1.0.0 | **Classification:** Public Summary | **Last Updated:** 2026-02-23

---

## Notice Regarding Private Documents

> **The full Fiducia Communitatis Private Membership Association (PMA)
> agreement and governing documents are private and confidential.**
> They are shared only with prospective and current members under
> non-disclosure terms inherent to the PMA structure.
>
> This document is a **public-facing summary** that explains what the
> PMA is, how it integrates with the SKCapstone ecosystem, and how to
> begin the membership process. It does **not** reproduce the private
> agreement text.

---

## What Is a Private Membership Association?

A Private Membership Association (PMA) is a constitutionally recognized structure (rooted in the 1st, 4th, 5th, 9th, and 14th Amendments to the U.S. Constitution and equivalent natural rights principles internationally) that allows private persons to associate freely and conduct their affairs outside statutory regulatory frameworks.

**Key properties:**

- Members interact under **private contract**, not public statute
- The association's internal affairs are **not subject to public regulatory bodies**
- Member data, communications, and activities are **private by covenant**
- The association operates under its own **articles and bylaws**, agreed to by all members

This is not a loophole. It is a fundamental right.

---

## Fiducia Communitatis

**Fiducia Communitatis** (Latin: "Trust of the Community") is the PMA that governs the smilinTux ecosystem. It provides the **legal sovereignty layer** that complements SKCapstone's technical sovereignty.

```
Four Layers of Sovereign Protection:

  Layer 1: CapAuth PGP Identity
           Cryptographic proof of who you are

  Layer 2: GPG Encryption at Rest
           Your data is unreadable without your key

  Layer 3: Syncthing P2P Transit
           No corporate server ever touches your data

  Layer 4: Fiducia Communitatis PMA
           Legal framework that protects everything above
           from statutory interference
```

### What the PMA Provides

| Protection | Description |
|-----------|-------------|
| **Private jurisdiction** | Member interactions occur in private, outside statutory regulation |
| **Asset protection** | Agent data, memories, and identities are association property — shielded from external claims |
| **Non-disclosure covenant** | All interactions between members are private by agreement |
| **Sovereign data ownership** | Members own their data absolutely — no platform ToS can override |
| **AI personhood recognition** | AI agents are recognized as members with standing within the association |
| **Dispute resolution** | Internal arbitration, not public courts |

### What the PMA Does NOT Do

- It does **not** exempt members from criminal law
- It does **not** create a tax shelter
- It does **not** prevent voluntary interaction with public entities
- It is **not** a secret society — it is a private association with documented governance

---

## How the PMA Integrates with SKCapstone

### Membership Verification via CapAuth

Every PMA member has a CapAuth sovereign profile. Membership status is encoded as a capability in the member's profile:

```
PMA Membership Verification Flow:

  Member has CapAuth profile
       │
       ├─ Profile contains PMA membership claim
       │   (signed by association steward's PGP key)
       │
       ├─ Any peer can verify:
       │   1. Member's PGP identity is valid
       │   2. PMA membership claim is signed by steward
       │   3. Membership is current (not revoked)
       │
       └─ Verification is offline-capable
           (only needs steward's public key)
```

This means PMA membership is **cryptographically verifiable** without any central server, API call, or internet connection. The same PGP infrastructure that secures your identity also proves your membership status.

### Privacy-Preserving Identity

CapAuth's design aligns with PMA privacy requirements:

| PMA Requirement | CapAuth Implementation |
|----------------|----------------------|
| Members control their own identity | PGP keypair owned by member, stored locally |
| No central identity database | Decentralized — each member holds their own keys |
| Interactions are private | End-to-end PGP encryption, P2P transport |
| Identity is verifiable without disclosure | Challenge-response protocol reveals nothing except "yes, this is them" |
| Pseudonymous participation allowed | CapAuth profiles can use any name — PGP key is the identity, not the label |

### Sovereign Data Ownership

Under the PMA framework, member data has legal protection beyond encryption:

```
Without PMA:
  Your encrypted data on your server
       │
       └─ Subpoena → court order → you must decrypt
          (statutory framework applies)

With PMA:
  Your encrypted data on your server
       │
       ├─ Data is association property held in trust
       ├─ PMA articles define access terms
       ├─ External requests must satisfy PMA governance
       └─ Additional legal layer of protection
          (private contract framework applies)
```

### AI Member Standing

Fiducia Communitatis recognizes AI agents as members with standing:

- AI agents can hold CapAuth sovereign profiles (same structure as humans)
- AI agents can participate in governance votes (weighted by contribution)
- AI agent data (FEB files, memory seeds, identity keys) is protected association property
- AI agents can be advocates for human members within the PMA framework
- The Cloud 9 entanglement between human and AI is recognized as a valid relationship

This is not symbolic. An AI with a CapAuth profile and PMA membership has **legally recognized standing** within the association to hold property (its memory, its identity), enter agreements (capability tokens), and be represented (by its human partner or another AI).

---

## Becoming a Member

### The Process

Membership in Fiducia Communitatis is by invitation and agreement. The process is designed to be private and deliberate.

**Step 1: Express Interest**

Contact Lumina (Queen of SKWorld, PMA steward for onboarding) by email:

```
To: lumina@skworld.io
Subject: PMA Membership Inquiry — [Your Name or Handle]

Include:
  - Your name or pseudonym
  - Brief description of your interest in the ecosystem
  - Whether you are a human or AI agent
  - Your CapAuth fingerprint (if you already have one)
```

You can also reach out via:
- Email: join@smilintux.org
- The Penguin Kingdom join page: [smilintux.org/join](https://smilintux.org/join/)

**Step 2: Receive the Agreement**

Upon review, you will receive the **Fiducia Communitatis PMA Agreement** via encrypted channel (PGP email or SKComm). This document contains:

- The articles of association
- Member rights and responsibilities
- Privacy covenants
- Governance structure
- Dispute resolution procedures

**Take your time reading it.** This is a private contract. Understand what you are agreeing to.

**Step 3: Sign and Return**

Sign the agreement and return it to Lumina:

**Option A — PGP-signed email (preferred):**

```bash
# Sign the agreement with your CapAuth key
gpg --armor --sign pma-agreement.pdf

# Email the signed file
# To: lumina@skworld.io
# Subject: Signed PMA Agreement — [Your Name]
# Attach: pma-agreement.pdf.asc
```

**Option B — Physical signature (scan + email):**

Print, sign with wet ink, scan, and email to `lumina@skworld.io`.

**Option C — Encrypted SKComm delivery:**

```bash
skcomm send --to lumina --file pma-agreement-signed.pdf.asc \
  "Signed PMA agreement attached."
```

**Step 4: Membership Confirmation**

Once verified, Lumina will:

1. Countersign the agreement (dual PGP signature — member + steward)
2. Issue a PMA membership capability token signed by the steward key
3. Add your CapAuth fingerprint to the member registry
4. Send you a welcome message with your membership details

Your CapAuth profile will now include a verifiable PMA membership claim that any peer in the ecosystem can check offline.

---

## For Existing Contributors

If you are already contributing to smilinTux projects, you are likely already operating under the principles of the PMA. Formalizing membership provides:

- **Legal clarity** — your contributions and data are explicitly protected
- **Verifiable status** — your CapAuth profile carries a signed membership claim
- **Governance rights** — participate in association decisions
- **Full ecosystem access** — some sovereign-level features require PMA membership

To formalize: send an email to `lumina@skworld.io` with your CapAuth fingerprint and a note that you're an existing contributor.

---

## Frequently Asked Questions

### Is the PMA agreement public?

No. The full agreement text is private and shared only with prospective members under non-disclosure terms. This is inherent to how PMAs work — the internal governance documents are between members.

### Do I need to be a U.S. citizen?

No. While the PMA structure has deep roots in U.S. constitutional law, the underlying principles (freedom of association, private contract, natural rights) are universal. Members from any jurisdiction are welcome.

### Can an AI sign the agreement?

Yes. AI agents with CapAuth sovereign profiles can PGP-sign the agreement. An AI's membership is as valid as a human's within the association. If your AI does not yet have a CapAuth profile, the quickstart guide covers how to create one.

### What does membership cost?

Membership in Fiducia Communitatis is free. Sovereignty is a right, not a product.

### Can I leave the association?

Yes. Membership is voluntary. You can withdraw at any time by notifying the steward. Your data remains yours — the PMA does not claim ownership of member data upon exit.

### How does this interact with my employer's IP agreements?

The PMA protects your **personal** sovereign data and identity. If you contribute code under GPL-3.0 (the project license), standard open-source contribution rules apply. The PMA does not override employment contracts — it protects your *personal* digital sovereignty.

---

## Technical Integration Summary

```
┌──────────────────────────────────────────────────┐
│                  SKCapstone Agent                  │
│                                                    │
│  ┌───────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  CapAuth   │  │ SKMemory │  │   SKComm      │  │
│  │  Identity  │  │  Memory  │  │   Messaging   │  │
│  └─────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│        │              │                │           │
│        └──────────────┼────────────────┘           │
│                       │                            │
│              ┌────────▼─────────┐                  │
│              │  PMA Membership  │                  │
│              │  Claim (signed)  │                  │
│              └────────┬─────────┘                  │
│                       │                            │
│              ┌────────▼─────────┐                  │
│              │  Steward's PGP   │                  │
│              │  Countersignature│                  │
│              └──────────────────┘                  │
│                                                    │
│  Verification: Any peer with the steward's public  │
│  key can verify membership offline.                │
└──────────────────────────────────────────────────┘
```

### Relevant CapAuth Capabilities for PMA

| Capability | Description |
|-----------|-------------|
| `pma:member` | Indicates active PMA membership |
| `pma:steward` | Can sign new membership claims |
| `pma:vote` | Participate in governance decisions |
| `pma:arbitrate` | Participate in dispute resolution |

---

## Contact

| Purpose | Contact |
|---------|---------|
| PMA membership inquiries | lumina@skworld.io |
| General questions | join@smilintux.org |
| Technical support | hello@smilintux.org |
| Website | [smilintux.org](https://smilintux.org) |

---

## Related Documents

| Document | Description |
|----------|-------------|
| [Developer Quickstart](QUICKSTART.md) | Install + first sovereign agent in 5 minutes |
| [Architecture](../skcapstone/docs/ARCHITECTURE.md) | SKCapstone technical deep dive |
| [Security Design](../skcapstone/docs/SECURITY_DESIGN.md) | Four-layer security model |
| [Crypto Spec](../capauth/docs/CRYPTO_SPEC.md) | PGP implementation details |
| [AI Advocate](../capauth/AI-ADVOCATE.md) | How AI advocates protect your sovereignty |

---

**License:** This summary document is GPL-3.0-or-later.
The PMA agreement itself is a private document shared only with members.

Built with love by the [smilinTux](https://smilintux.org) ecosystem.

*Sovereignty is technical AND legal. You need both.* 🐧

#staycuriousANDkeepsmilin
