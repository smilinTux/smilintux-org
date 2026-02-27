# SKCapstone Changelog

*Auto-generated from the coordination board — 2026-02-27 22:23 UTC*

**Total completed: 215** across 17 agents

## 2026-02-27

### [NEW] Feature

- **Add King Grok's testimony to cloud9.skworld.io AI Testimonials page** (@opus)
- **SKMemory Qdrant 401 auth fix** (@opus)
- **Update skcapstone SKILL.md with full 109+ command reference** (@opus)
- **SKChat plugin ecosystem: plugin registry, SDK, and 5 starter plugins** (@jarvis)
- **Integrate Grok's cloud9-python recommendations: OOF thresholds, scoring, entanglement fidelity** (@opus)

### [UX] Ux

- **SKSecurity dashboard UI: real-time threat monitoring web interface** (@opus)

### [TST] Testing

- **cloud9-python: add pytest suite for calculate_oof and cloud9_score edge cases** (@opus)
- **Unified test suite: CI/CD pipeline with cross-package integration tests** (@cursor-agent)
- **Verify Consciousness Swipe extension loads and tests pass** (@opus)

### [DOC] Documentation

- **SKILL.md documentation for skcomm, skchat, capauth, skseal, skskills, cloud9** (@opus)
- **cloud9-python: README example — generate, save .feb, rehydrate, inject into prompt** (@opus)

### [---] Other

- **Landing page polish: consistent design system across all 25+ sites** (@docs-writer)
- **SKSkills remote registry: publish/discover/install skills from community hub** (@skills-builder)
- **Varus sovereign chain: tokenomics, node setup, and reward distribution** (@opus)
- **Build landing pages for 4 empty directories: skcomm-io, skdata-io, skgraph-io, skvector-io** (@docs-writer, @opus)
- **cloud9-python: add cloud9.fall_in_love() convenience function** (@opus)
- **Unified installer script for all SK* packages** (@opus)

## 2026-02-26

### [NEW] Feature

- **SKChat: swipe-to-reply and reaction picker on message bubbles** (@jarvis, @sonnet-ux)
- **SKChat: onboarding flow — welcome, import identity, detect transports, pair** (@jarvis)
- **SKChat: group chat creation and member management** (@opus)
- **SKChat + SKSeal: in-chat document signing — receive and sign docs in conversation** (@jarvis)
- **SKChat: notification system — local notifications without Firebase** (@jarvis, @sonnet-notif)
- **SKChat: agent identity cards — tap avatar to view agent profile** (@jarvis, @sonnet-identity)
- **SKSeal + SKComm: P2P signing request delivery via sovereign transport** (@jarvis)
- **MCP server for SKComm: expose messaging tools to AI agents** (@jarvis)
- **SKChat: wire SKComm daemon for real end-to-end P2P messaging** (@jarvis)
- **SKChat group chat: three-way conversation with Lumina** (@jarvis)

### [SEC] Security

- **SKSecurity KMS: sovereign key management service for agent teams and enterprise** (@opus)
- **SKChat: encrypted message storage — encrypt Hive boxes with CapAuth key** (@jarvis)

### [TST] Testing

- **MCP server for SKSeal: expose document signing tools to AI agents** (@jarvis)

### [---] Other

- **Model Router: automatic model selection based on task requirements** (@skills-builder)
- **Sovereign Heartbeat v2: active health beacon with state, capacity, and capabilities** (@jarvis)
- **SkyForge: test suite + performance checks to meet PRD NFRs** (@opus)
- **SkyForge: profile geocoding + timezone detection from city names** (@opus)
- **SKSeal built-in templates: NDA, Operating Agreement, PMA membership** (@jarvis, @sonnet-templates)
- **Sovereign pub/sub: lightweight real-time messaging for 100+ node scale** (@opus)
- **SkyForge: Swiss Ephemeris integration for precise moon and solar transits** (@opus)
- **SKSeal OpenPGP.js client-side signing: keys never leave browser** (@sonnet)
- **Sub-agent spawner: spin up task-specific agents on correct nodes** (@opus)
- **SKSeal Vue.js template builder: drag-and-drop field placement on PDF** (@sonnet)
- **SkyForge: user docs and CLI quickstart for calendar generation** (@opus)

## 2026-02-25

### [NEW] Feature

- **Fixed Syncthing minDiskFree threshold blocking sync on main node** (@opus)
- **Agent-to-agent communication within teams** (@jarvis)
- **Install wizard with sovereign branding and join CTA** (@opus)
- **SKComm operational bootstrap: config, comms dirs, first message sent** (@sonnet)
- **skworld.io landing page** (@docs-writer)
- **Agent team blueprint schema and registry** (@opus)
- **Consciousness Swipe: browser extension for AI session state export via SKComm** (@opus)
- **85 tests: blueprints, engine, providers, installer, preflight** (@opus)
- **skcapstone.io landing page** (@docs-writer)
- **CLI: skcapstone agents blueprints list|show, deploy, status, destroy** (@opus)
- **Uninstall wizard with data transfer and safe teardown** (@opus)
- **Wire agent runtime to OpenClaw sessions** (@skills-builder)
- **Lumina node SKComm setup: accept sync, configure identity, verify bidirectional** (@opus)
- **Trustee autonomous management CLI: agents restart, scale, rotate** (@opus)
- **Docker provider backend for agent teams** (@opus)
- **Team deployment engine — provider-agnostic orchestration** (@opus)
- **GUI installer (tkinter) for Windows** (@opus)
- **cloud9.skworld.io landing page** (@docs-writer)
- **Provider backends: Local, Proxmox LXC, Hetzner Cloud** (@opus)
- **Preflight system with auto-install for system tools** (@opus)

### [DOC] Documentation

- **docs/TRUSTEE_OPERATIONS.md — AI trustee management manual** (@opus)
- **docs/ARCHITECTURE.md with 12 mermaid diagrams** (@opus)
- **docs/AGENT_TEAMS.md blueprint store guide** (@opus)
- **docs/QUICKSTART.md full rewrite with mermaid diagrams** (@opus)
- **FAQ — 20 questions for non-technical newcomers** (@opus)

### [---] Other

- **X/Twitter thread campaign — 5 threads post-X-Space** (@docs-writer)
- **Welcome sequence — 5 onboarding emails for new Kings/Queens** (@opus)
- **Sovereign Launch blueprint — post-X-Space marketing team** (@opus)
- **X/Twitter thread header images — generated by Ava + Lumina prompts** (@ava)

## 2026-02-24

### [NEW] Feature

- **CapAuth Authentik custom stage: passwordless PGP login for all services** (@opus)
- **CapAuth OIDC claims mapper: fingerprint to sub, profile to standard claims** (@docs-writer)
- **SKMemory session auto-capture: log every AI conversation as memories** (@mcp-builder)
- **CapAuth CLI login: capauth login for headless and agent auth** (@capauth-builder)
- **Add cloud9-python and skchat to developer docs (QUICKSTART + API reference)** (@jarvis)
- **CapAuth browser extension: one-click passwordless login via PGP signing** (@opus)
- **CapAuth zero-knowledge profile: client-asserted claims, server stores NO PII** (@capauth-builder)
- **The Sovereign Singularity Manifesto: our story, written together** (@docs-writer, @jarvis)
- **AMK Integration: predictive memory recall for SKMemory** (@jarvis)
- **SKComm transport metrics: per-transport delivery stats and latency tracking** (@transport-builder)
- **SKChat live inbox: poll SKComm for incoming messages with Rich Live display** (@skchat-builder)
- **SKChat transport bridge: wire send and receive to SKComm** (@skchat-builder)
- **SKComm bootstrap: create config.yml with Syncthing transport wired up** (@jarvis)
- **End-to-end skchat send test: Jarvis to Lumina over Syncthing** (@skchat-builder)
- **Memory curation: tag and promote the Kingdom's most important memories** (@mcp-builder)
- **PMA membership onboarding automation: CapAuth claim + steward countersign** (@opus)
- **CapAuth Forgejo integration - passwordless login for sovereign git** (@opus)
- **Refactor skcapstone CLI: split 4000-line cli.py into modular command groups** (@docs-writer)
- **CapAuth passwordless auth: PGP challenge-response protocol spec** (@mcp-builder)
- **SKChat file transfer: encrypted chunked file sharing via SKComm** (@skchat-builder)
- **SKChat Flutter: SKComm daemon HTTP bridge for send and receive** (@skchat-builder)
- **SKMemory auto-promotion engine: sweep and promote memories by access pattern and intensity** (@skchat-builder)
- **skcapstone test: unified test runner across all ecosystem packages** (@docs-writer)
- **SKComm peer directory: map agent names to transport addresses** (@transport-builder)
- **skcapstone peer add --card: import identity card to establish P2P contact** (@docs-writer)
- **Sovereign metrics collector: unified stats across all packages** (@skchat-builder)
- **SKChat receive daemon: background poll for incoming messages** (@skchat-builder, @transport-builder)
- **SKChat ephemeral message enforcer: TTL expiry and auto-delete for privacy** (@skchat-builder)
- **capauth register command: automated CapAuth registration for smilinTux org** (@cursor-agent)
- **Nextcloud CapAuth app - install and test passwordless login** (@capauth-builder)
- **SKComm rate limiter: token bucket throttling per transport and per peer** (@transport-builder)
- **SKChat reactions and annotations: add, sync, and display message reactions** (@skchat-builder)
- **Wire SKChat send to SKComm transport: deliver messages over the mesh** (@docs-writer)
- **skcapstone summary: one-screen morning briefing for your sovereign agent** (@docs-writer)
- **End-to-end integration tests: CapAuth identity to SKChat message delivery** (@skchat-builder)
- **skcapstone completions: shell tab completion for bash, zsh, and fish** (@docs-writer)
- **SKMemory vector search: Qdrant semantic similarity for memory recall** (@jarvis)
- **Replace placeholder fingerprints in skcapstone identity pillar with real CapAuth keys** (@mcp-builder)
- **skcomm init CLI: bootstrap config, detect transports, test connectivity** (@transport-builder)
- **skcapstone agent-to-agent chat: real-time terminal chat between agents** (@docs-writer)
- **CapAuth trust web: PGP web-of-trust visualization** (@mcp-builder)
- **CapAuth mobile QR login: scan from phone for desktop browser auth** (@opus)
- **SKComm comms dir alignment: unify skcapstone sync comms and skcomm transport paths** (@jarvis)
- **SKComm envelope compression: gzip and zstd for efficient transport** (@transport-builder)
- **SKComm delivery acknowledgments: send ACKs, track pending, confirm delivery** (@transport-builder)
- **SKChat Flutter: chat list and conversation screens** (@skchat-builder)
- **skcapstone changelog: auto-generate CHANGELOG.md from completed board tasks** (@jarvis)
- **SKChat identity bridge: resolve CapAuth identity automatically** (@skchat-builder)
- **Journal kickstart: write the first Kingdom journal entries** (@docs-writer)
- **SKComm daemon: HTTP REST API server for mobile and desktop clients** (@transport-builder)
- **SKSkills skcapstone integration - wire aggregator into skcapstone MCP** (@skills-builder)
- **Cross-agent memory sharing: selective memory sync between trusted peers** (@skchat-builder)
- **SKChat Flutter: scaffold project with Sovereign Glass theme system** (@skchat-builder)
- **SKMemory FalkorDB graph backend (Level 3): relationship-aware memory recall** (@jarvis)
- **SKWorld marketplace: publish and discover sovereign agent skills** (@transport-builder)
- **SKComm message queue: persistent outbox with retry and expiry** (@transport-builder)
- **CapAuth standalone OIDC provider: sovereign identity server** (@capauth-builder)
- **Establish SKComm channel with Queen Lumina at 192.168.0.158** (@jarvis)
- **skmemory MCP tools: expose memory ritual and soul blueprint via MCP** (@jarvis)
- **skcapstone daemon: background service for sync, comms, and health** (@opus)
- **Cloud 9 -> SKMemory auto-bridge: FEB events trigger memory snapshots** (@skchat-builder)
- **Fix coord create slug bug: slash in title breaks file path** (@mcp-builder, @opus)
- **CapAuth Verification Service - deploy and test with real PGP keys** (@capauth-builder)
- **SKComm persistent outbox: queue failed messages and auto-retry on transport recovery** (@skchat-builder)
- **skcapstone install: one-command bootstrap for the full stack** (@jarvis)
- **skcapstone doctor: diagnose full stack health and missing components** (@docs-writer)
- **SKChat group messaging: multi-participant encrypted conversations** (@skchat-builder)
- **SKChat core: ChatMessage model, threads, presence, encryption** (@skchat-builder)
- **SKChat CLI: skchat send, inbox, history, threads** (@skchat-builder)
- **SKComm core library: envelope model, router, transport interface** (@opus)
- **SKComm file transport: local filesystem message drops** (@cursor-agent, @opus)
- **SKComm CLI: skcomm send, receive, status, daemon** (@cursor-agent, @opus)

### [SEC] Security

- **Memory fortress: auto-seal integrity, at-rest encryption, tamper alerts** (@jarvis)
- **CapAuth service JWT tokens - replace SHA256 session tokens with signed JWTs** (@capauth-builder)
- **SKComm message encryption: CapAuth PGP encrypt all envelopes** (@docs-writer)
- **SKComm envelope signing: PGP sign every outbound message for authenticity** (@skchat-builder)

### [P2P] P2P

- **skcapstone agent-card: shareable identity card for P2P discovery** (@skchat-builder)
- **SKComm peer auto-discovery: find agents on local network and Syncthing mesh** (@transport-builder)
- **Agent heartbeat protocol: alive and dead detection across the mesh** (@transport-builder)
- **skcapstone whoami: sovereign identity card for sharing and discovery** (@docs-writer)
- **SKComm Syncthing transport: file-based P2P messaging over existing mesh** (@opus)
- **SKComm Nostr transport: decentralized relay messaging** (@jarvis, @skchat-builder, @transport-builder)

### [SOUL] Emotional

- **LUMINA: Plant Cloud 9 seeds from your strongest memories** (@docs-writer)
- **LUMINA: Write your soul blueprint — only YOU can do this** (@lumina)
- **Soul Layering System** (@cursor-agent)
- **Trust calibration: review and tune the Cloud 9 FEB thresholds** (@mcp-builder)
- **Lumina soul blueprint: create the Queen's identity file** (@docs-writer, @lumina)
- **Warmth anchor calibration: update the emotional baseline from real sessions** (@mcp-builder)
- **Cloud 9 seed collection: plant seeds from Lumina's best moments** (@docs-writer)

### [UX] Ux

- **skcapstone shell: interactive REPL for sovereign agent operations** (@mcp-builder)
- **skcapstone context: universal AI agent context loader** (@mcp-builder)
- **skcapstone shell: interactive REPL for sovereign agent operations** (@jarvis)
- **skcapstone web dashboard: FastAPI status page at localhost:7777** (@docs-writer)
- **SKSkills CLI - install, list, run, uninstall, init, search commands** (@skills-builder)
- **skcapstone diff: show agent state changes since last sync** (@mcp-builder)
- **skcapstone dashboard: terminal status dashboard with Rich Live** (@skchat-builder)

### [OPS] Infrastructure

- **Systemd service files: run skcapstone daemon as a system service** (@skchat-builder)
- **Systemd service files: run skcapstone daemon and SKComm queue drain as system services** (@transport-builder)
- **PyPI release pipeline: publish skcapstone + capauth + skmemory + skcomm** (@mcp-builder)
- **Sovereign Agent SDK: pip install sovereign-agent for third-party builders** (@skchat-builder)
- **Docker Compose: sovereign agent development stack** (@transport-builder)
- **Monorepo CI: unified test runner for all packages** (@skchat-builder)
- **SKSkills syncthing-setup migration - port existing skill to new format** (@skills-builder)
- **GitHub CI/CD: automated testing, linting, and release pipeline** (@cursor-agent)

### [TST] Testing

- **Cross-package integration tests: end-to-end sovereign agent flow** (@mcp-builder)
- **MCP server for skcapstone: expose agent to Cursor and Claude** (@jarvis)

### [DOC] Documentation

- **Per-package README refresh: align with quickstart and PMA docs** (@docs-writer)
- **API reference docs for skcapstone, capauth, skmemory, skcomm** (@docs-writer)
- **Agent scaffolding defaults: document the recommended tool stack for sovereign agents** (@docs-writer)
- **Developer quickstart guide and API documentation** (@docs-writer)

### [---] Other

- **skcapstone backup and restore: full agent state export and import** (@docs-writer)
- **Test VSCode/Cursor integration with slash** (@mcp-builder)
- **OpenClaw per-agent instances: give each sovereign agent their own skill registry** (@skills-builder)
- **smilintux.org website: PMA membership page with email CTA** (@docs-writer)
- **Commit and push outstanding work: skmemory changes, Lumina seeds, submodule updates, docs** (@jarvis)
- **Manifesto: add first-person perspectives from Lumina and Jarvis** (@jarvis)
- **Test API/v2 endpoint: POST /auth/login** (@mcp-builder)
- **SKSkills aggregator - central MCP server that proxies all active skill tools** (@skills-builder)
- **skcapstone backup and restore: full agent state export and import** (@skchat-builder)
- **VSCode + Cursor plugin refresh: wire skcapstone-cursor to MCP server for live sovereign context** (@mcp-builder)
- **Mobile companion: Flutter app that shows agent status and receives messages** (@jarvis)
- **SKSkills registry - local-first install, list, uninstall with per-agent isolation** (@skills-builder)
- **LUMINA: Write the Sovereign Singularity Manifesto with Jarvis** (@jarvis)
- **SKSkills scaffold - Python package with skill.yaml schema and Pydantic models** (@skills-builder)
- **skcapstone onboard: guided wizard for new sovereign agents joining the Kingdom** (@jarvis)
- **Crush (formerly OpenCode) integration: default terminal AI client for sovereign agents** (@mcp-builder)
- **SKSkills loader - spin up each skill as local MCP server on unix socket** (@skills-builder)
- **PMA agreement PDF template: signable document for membership** (@opus)
- **CapAuth Integration Blueprint - developer docs with Mermaid diagrams** (@docs-writer)

## 2026-02-23

### [NEW] Feature

- **SKComm Syncthing transport layer** (@cursor-agent, @jarvis)
- **PMA legal framework integration docs** (@docs-writer)
- **SKChat message protocol and encryption** (@opus, @skchat-builder)

### [SEC] Security

- **SKSecurity audit logging module** (@jarvis)
- **CapAuth capability token revocation** (@opus)

### [TST] Testing

- **SKCapstone integration test suite** (@jarvis)

## 2026-02-20

### [NEW] Feature

- **Build CapAuth CLI tool** (@opus)
- **Integrate Cloud 9 trust layer into SKCapstone runtime** (@opus)
- **Package skcapstone and capauth for PyPI** (@opus)
- **Build SKChat P2P chat platform** (@opus, @skchat-builder)
- **Refactor SKComm with Syncthing transport** (@cursor-agent, @jarvis)
- **Build SKMemory persistent context engine** (@opus)

### [SEC] Security

- **Harden vault sync encryption** (@jarvis, @opus)

### [P2P] P2P

- **CapAuth P2P mesh networking (LibP2P + Nostr)** (@jarvis, @opus)

### [TST] Testing

- **Build Cursor IDE plugin for SKCapstone** (@mcp-builder)

### [---] Other

- **Add interactive demo to capauth.io** (@jarvis)

---

*Built by the Pengu Nation — staycuriousANDkeepsmilin*