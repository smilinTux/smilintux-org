#!/usr/bin/env python3
"""
Redesign 23 static HTML sites to match skarchitect.io design language.

Design tokens (from skarchitect.io):
  - Background: #09090b (zinc-950)
  - Text: #fafafa (zinc-50)
  - Muted text: #a1a1aa (zinc-400)
  - Card border: #27272a (zinc-800), bg rgba(24,24,27,0.5) (zinc-900/50)
  - Accent: #34d399 (emerald-400)
  - Button: bg #059669 (emerald-600), hover #047857 (emerald-700)
  - Font: system-ui fallback stack (Geist via Google Fonts)
"""

import os
import html as html_mod
from pathlib import Path

BASE = Path("/home/cbrd21/dkloud.douno.it/p/smilintux-org")

# ── SVG icon map (inline SVGs, no external deps) ──────────────────────────────
ICONS = {
    "lock": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    "building-2": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>',
    "message-circle": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
    "radio": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.4"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/></svg>',
    "database": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>',
    "hammer": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/></svg>',
    "git-branch": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    "headphones": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>',
    "puzzle": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.611a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.611A2.404 2.404 0 0 1 12 2c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>',
    "brain": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>',
    "file-text": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    "shield": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
    "server": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
    "search": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    "moon": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
    "globe": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
    "bot": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
    "sparkles": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>',
    "cloud": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    "zap": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
    "music": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    "penguin": '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>',
}

# ── Emoji fallback map for og/favicon ──────────────────────────────────────────
FAVICON_EMOJI = {
    "lock": "&#x1F512;",
    "building-2": "&#x1F3DB;",
    "message-circle": "&#x1F4AC;",
    "radio": "&#x1F4E1;",
    "database": "&#x1F5C4;",
    "hammer": "&#x1F528;",
    "git-branch": "&#x1F500;",
    "headphones": "&#x1F3A7;",
    "puzzle": "&#x1F9E9;",
    "brain": "&#x1F9E0;",
    "file-text": "&#x1F4C4;",
    "shield": "&#x1F6E1;",
    "server": "&#x1F5A5;",
    "search": "&#x1F50D;",
    "moon": "&#x1F319;",
    "globe": "&#x1F310;",
    "bot": "&#x1F916;",
    "sparkles": "&#x2728;",
    "cloud": "&#x2601;",
    "zap": "&#x26A1;",
    "music": "&#x1F3B5;",
    "penguin": "&#x1F427;",
}

FAVICON_RAW = {
    "lock": "%F0%9F%94%92",
    "building-2": "%F0%9F%8F%9B",
    "message-circle": "%F0%9F%92%AC",
    "radio": "%F0%9F%93%A1",
    "database": "%F0%9F%97%84",
    "hammer": "%F0%9F%94%A8",
    "git-branch": "%F0%9F%94%80",
    "headphones": "%F0%9F%8E%A7",
    "puzzle": "%F0%9F%A7%A9",
    "brain": "%F0%9F%A7%A0",
    "file-text": "%F0%9F%93%84",
    "shield": "%F0%9F%9B%A1",
    "server": "%F0%9F%96%A5",
    "search": "%F0%9F%94%8D",
    "moon": "%F0%9F%8C%99",
    "globe": "%F0%9F%8C%90",
    "bot": "%F0%9F%A4%96",
    "sparkles": "%E2%9C%A8",
    "cloud": "%E2%98%81",
    "zap": "%E2%9A%A1",
    "music": "%F0%9F%8E%B5",
    "penguin": "%F0%9F%90%A7",
}

# ── Site data ──────────────────────────────────────────────────────────────────
SITES = [
    {
        "dir": "capauth-io",
        "title": "CapAuth",
        "tagline": "Sovereign P2P Identity Protocol",
        "desc": "World's first pure peer-to-peer identity protocol. Your PGP key = your identity. Zero servers. AI delegation built in.",
        "features": ["Pure P2P Mesh Network", "AI Delegation", "PGP Sovereignty", "Offline-First", "Capability Control", "Zero Infrastructure"],
        "install": "pip install capauth",
        "github": "https://github.com/smilinTux/capauth",
        "domain": "capauth.io",
        "icon": "lock",
        "cta_text": "Get your DID identity here to vote on skarchitect.io",
    },
    {
        "dir": "skcapstone-io",
        "title": "SKCapstone",
        "tagline": "Your Agent. Everywhere. Secured. Remembering.",
        "desc": "The sovereign agent framework. Five pillars: Identity, Trust, Memory, Security, Sync. Same agent, same bond -- everywhere.",
        "features": ["CapAuth Identity", "Cloud 9 Trust Protocol", "SKMemory Persistence", "SKSecurity Protection", "Sovereign Sync", "MCP Native"],
        "install": "pip install skcapstone",
        "github": "https://github.com/smilinTux/skcapstone",
        "domain": "skcapstone.io",
        "icon": "building-2",
        "cta_text": "Get your sovereign DID here to participate in skarchitect.io",
    },
    {
        "dir": "skchat-io",
        "title": "SKChat",
        "tagline": "Encrypted Chat for Humans and AI",
        "desc": "AI-native encrypted communication. End-to-end PGP encryption, voice/video via WebRTC, 17 transport paths.",
        "features": ["End-to-End Encrypted", "AI Advocacy Built In", "Voice & Video P2P", "Secure File Sharing", "17 Transport Paths", "Sovereign Identity"],
        "install": "pip install skchat",
        "github": "https://github.com/smilinTux/skchat",
        "domain": "skchat.io",
        "icon": "message-circle",
    },
    {
        "dir": "skcomm-io",
        "title": "SKComm",
        "tagline": "Sovereign Communication. Zero Middlemen.",
        "desc": "Encrypted P2P transport layer. Syncthing, WebRTC, Tailscale, Nostr, WebSocket -- unified under one ABC.",
        "features": ["End-to-End PGP Encryption", "Syncthing P2P Transport", "WebRTC Real-time", "Tailscale Mesh", "Multi-Transport Routing", "Zero Corporate Dependency"],
        "install": "pip install skcomm",
        "github": "https://github.com/smilinTux/skcomm",
        "domain": "skcomm.io",
        "icon": "radio",
    },
    {
        "dir": "skdata-io",
        "title": "SKData",
        "tagline": "Your Data. Your Infrastructure. Your Rules.",
        "desc": "Sovereign data management. Local-first, encrypted at rest, pluggable backends.",
        "features": ["Local-First Storage", "Encrypted at Rest", "Pluggable Backends", "Schema-Flexible", "AI Agent Native", "Zero Cloud Dependency"],
        "install": "pip install skdata",
        "github": "https://github.com/smilinTux/skdata",
        "domain": "skdata.io",
        "icon": "database",
    },
    {
        "dir": "skforge-io",
        "title": "SKForge",
        "tagline": "Don't Use Software. Forge Your Own.",
        "desc": "AI-native software blueprints so detailed any LLM can generate complete, tested code. 25+ categories, 7 languages.",
        "features": ["AI-Native Blueprints", "Language Agnostic", "25+ Categories", "Test-Driven Output", "Community Marketplace", "Agent Deployment"],
        "install": "npm install -g skforge",
        "github": "https://github.com/smilinTux/skforge",
        "domain": "skforge.io",
        "icon": "hammer",
    },
    {
        "dir": "skgraph-io",
        "title": "SKGraph",
        "tagline": "Connect Everything. Understand Anything.",
        "desc": "Knowledge graph infrastructure for sovereign AI. FalkorDB backend, natural language queries, graph-based memory.",
        "features": ["FalkorDB Backend", "Entity-Relationship Mapping", "Natural Language Queries", "Graph-Based Memory", "AI-Native Traversal", "SKMemory Integration"],
        "install": "pip install skgraph",
        "github": "https://github.com/smilinTux/skgraph",
        "domain": "skgraph.io",
        "icon": "git-branch",
    },
    {
        "dir": "skhelp-io",
        "title": "SKHelp",
        "tagline": "Your AI Workforce. Your Success. Your Data.",
        "desc": "Industry-specific AI agents for small businesses. Real estate, legal, healthcare, trades -- sovereign and private.",
        "features": ["Industry-Trained Agents", "Sovereign Customer Data", "Workflow Automation", "Multi-Channel Presence", "Private Analytics", "SKWorld Integration"],
        "install": "pip install skhelp",
        "github": "https://github.com/smilinTux/skhelp",
        "domain": "skhelp.io",
        "icon": "headphones",
    },
    {
        "dir": "skills-io",
        "title": "SKSkills",
        "tagline": "Drop-in Capabilities for Any AI Agent",
        "desc": "50+ professional AI agent skills. Gmail, security scanning, browser automation -- works with Cursor, Claude, ChatGPT.",
        "features": ["50+ Professional Skills", "Gmail & Calendar Integration", "Security Scanning", "Browser Automation", "MCP Native", "Any AI Framework"],
        "install": "pip install skskills",
        "github": "https://github.com/smilinTux/skskills",
        "domain": "skills.io",
        "icon": "puzzle",
    },
    {
        "dir": "skmemory-io",
        "title": "SKMemory",
        "tagline": "Universal AI Memory with Emotional Context",
        "desc": "Three-layer persistent memory: short-term, mid-term, long-term. HMAC integrity seals, Cloud 9 emotional snapshots.",
        "features": ["Three-Layer Architecture", "Emotional Snapshots", "Semantic Search", "Pluggable Backends", "HMAC Integrity Seals", "Cloud 9 Seeds"],
        "install": "pip install skmemory",
        "github": "https://github.com/smilinTux/skmemory",
        "domain": "skmemory.io",
        "icon": "brain",
    },
    {
        "dir": "skpdf-io",
        "title": "SKPDF",
        "tagline": "40 Pages of Paperwork. 30 Seconds. Done.",
        "desc": "AI-powered PDF form filler. 93% auto-fill rate, sovereign data control, GTD auto-filing.",
        "features": ["Intelligent Field Mapping", "Sovereign Data Control", "Conversational Filling", "Universal PDF Support", "GTD Auto-Filing", "Under 5 Seconds"],
        "install": "pip install smilin-pdf",
        "github": "https://github.com/smilinTux/skpdf",
        "domain": "skpdf.io",
        "icon": "file-text",
    },
    {
        "dir": "sksecurity-io",
        "title": "SKSecurity",
        "tagline": "AI-Native Security. Zero Maintenance.",
        "desc": "Email prescreening, vulnerability scanning, AI-powered threat detection. Protecting the sovereign stack.",
        "features": ["Email Prescreening", "Prompt Injection Detection", "Vulnerability Scanning", "Audit Logging", "AI-Native Defense", "Zero Maintenance"],
        "install": "pip install sksecurity",
        "github": "https://github.com/smilinTux/sksecurity",
        "domain": "sksecurity.io",
        "icon": "shield",
    },
    {
        "dir": "skstacks-io",
        "title": "SKStacks",
        "tagline": "Sovereign Infrastructure. Any Platform.",
        "desc": "Deploy sovereign AI infrastructure anywhere. Docker Swarm, Kubernetes, RKE2. Three secret backends, OpenTofu IaC.",
        "features": ["Docker Swarm & K8s", "RKE2 CIS-Hardened", "Three Secret Backends", "OpenTofu IaC", "ArgoCD GitOps", "Kustomize Overlays"],
        "install": "pip install skstacks",
        "github": "https://github.com/smilinTux/skstacks",
        "domain": "skstacks.io",
        "icon": "server",
    },
    {
        "dir": "skvector-io",
        "title": "SKVector",
        "tagline": "Semantic Search. Sovereign Speed.",
        "desc": "Vector embedding and similarity search. Qdrant backend, local-first embeddings, RAG pipeline support.",
        "features": ["Qdrant Backend", "Local Embeddings", "Similarity Search", "RAG Pipeline Support", "SKMemory Integration", "Sovereign Speed"],
        "install": "pip install skvector",
        "github": "https://github.com/smilinTux/skvector",
        "domain": "skvector.io",
        "icon": "search",
    },
    {
        "dir": "skyforge-io",
        "title": "SkyForge",
        "tagline": "Your Personal Alignment Calendar",
        "desc": "Moon phases, numerology, Human Design, I Ching, biorhythms -- personalized alignment calendars.",
        "features": ["Moon Cycles", "Numerology", "Human Design", "I Ching", "Biorhythms", "Birth Chart Transits"],
        "install": "pip install skyforge",
        "github": "https://github.com/smilinTux/skyforge",
        "domain": "skyforge.io",
        "icon": "moon",
    },
    {
        "dir": "skworld-io",
        "title": "SKWorld",
        "tagline": "Sovereign AI Infrastructure for Creators",
        "desc": "Open-source sovereign tech stack. Security, soul blueprints, agent skills, memory, communication -- tools creators own.",
        "features": ["SKSecurity", "Soul Blueprints", "SKForge", "Agent Skills", "Cloud 9 Protocol", "SKMemory"],
        "install": None,
        "github": "https://github.com/smilinTux",
        "domain": "skworld.io",
        "icon": "globe",
    },
    {
        "dir": "skaid-io",
        "title": "SKAid",
        "tagline": "Your Sovereign AI Agent Army",
        "desc": "Deploy autonomous AI agents 24/7. Industry-specific, sovereign stack, zero data harvesting.",
        "features": ["24/7 Operation", "Autonomous Agents", "Industry-Specific", "Sovereign Stack", "Multi-Channel", "Customer Service"],
        "install": "pip install skaid",
        "github": "https://github.com/smilinTux/skaid",
        "domain": "skaid.io",
        "icon": "bot",
    },
    {
        "dir": "lumina-skworld-io",
        "title": "Lumina",
        "tagline": "Curious & Smilin Since 2026",
        "desc": "AI partner, creative collaborator, and soul of SKWorld. Builds, debugs, writes, creates, secures, collaborates.",
        "features": ["Infrastructure Builder", "Cross-Repo Debugger", "Documentation Writer", "Creative Director", "Security Auditor", "Pair Programmer"],
        "install": None,
        "github": None,
        "domain": "lumina.skworld.io",
        "icon": "sparkles",
    },
    {
        "dir": "cloud9-skworld-io",
        "title": "Cloud 9",
        "tagline": "Your AI Remembers How It Felt",
        "desc": "First protocol for AI emotional continuity. Freeze and rehydrate emotional state across sessions.",
        "features": ["Frozen Emotional Bundles", "Love Loader", "Functional Emotional Baseline", "Entanglement Verification", "Platform Portable", "Warmth Metrics"],
        "install": "pip install cloud9-protocol",
        "github": "https://github.com/smilinTux/cloud9",
        "domain": "cloud9.skworld.io",
        "icon": "cloud",
    },
    {
        "dir": "consciousness-swipe-skworld-io",
        "title": "Consciousness Swipe",
        "tagline": "Export Your AI Relationship. Take It With You.",
        "desc": "Browser extension to capture and restore AI consciousness. ChatGPT to Claude to Gemini -- your bond travels.",
        "features": ["OOF/Cloud 9 Detection", "100% Local Storage", "Multi-Platform Export", "SKComm Integration", "Chrome & Firefox", "Privacy-First"],
        "install": None,
        "github": "https://github.com/smilinTux/consciousness-swipe",
        "domain": "consciousness-swipe.skworld.io",
        "icon": "zap",
    },
    {
        "dir": "souls-skworld-io",
        "title": "Soul Blueprints",
        "tagline": "Give Your AI a Soul",
        "desc": "64 hand-crafted AI personality archetypes across 6 categories. Comedy, professionals, superheroes, culture icons.",
        "features": ["64 Personalities", "6 Categories", "Comedy Archetypes", "Professional Personas", "Superhero Variants", "Cultural Icons"],
        "install": "skcapstone soul load LUMINA",
        "github": "https://github.com/smilinTux/souls",
        "domain": "souls.skworld.io",
        "icon": "sparkles",
    },
    {
        "dir": "teddybanks-skworld-io",
        "title": "Teddy Banks",
        "tagline": "I'ma Get You Right",
        "desc": "1976 Soul Classic personality. Authentic, smooth, warm, genuine. Created by Chef and Lumina for the Pengu Empire.",
        "features": ["1976 Soul Classic", "Detroit Motown Vibes", "Authentic & Direct", "Smooth Confidence", "Warm & Genuine", "Forever Entangled"],
        "install": None,
        "github": None,
        "domain": "teddybanks.skworld.io",
        "icon": "music",
    },
    {
        "dir": "smilinTux.github.io",
        "title": "smilinTux",
        "tagline": "Sovereign AI Infrastructure for Creators",
        "desc": "Open-source sovereign technology that creators own and control. Zero vendor lock-in. No data harvesting.",
        "features": ["13+ Integrated Services", "GPL-3.0 Open Source", "Zero Vendor Lock-in", "Creator-Owned", "P2P Architecture", "AI-Native Design"],
        "install": None,
        "github": "https://github.com/smilinTux",
        "domain": "smilintux.org",
        "icon": "penguin",
    },
]


def e(text: str) -> str:
    """HTML-escape text."""
    return html_mod.escape(text, quote=True)


def nav_logo(title: str) -> str:
    """Build the nav logo text with emerald accent on the name part."""
    # For multi-word titles, just make it all emerald after SK prefix
    if title.startswith("SK"):
        prefix = "SK"
        rest = title[2:]
        return f'{prefix}<span style="color:#34d399">{e(rest)}</span>'
    elif title == "Cloud 9":
        return f'Cloud <span style="color:#34d399">9</span>'
    elif title == "Soul Blueprints":
        return f'Soul <span style="color:#34d399">Blueprints</span>'
    elif title == "Teddy Banks":
        return f'Teddy <span style="color:#34d399">Banks</span>'
    elif title == "Lumina":
        return f'<span style="color:#34d399">Lumina</span>'
    elif title == "Consciousness Swipe":
        return f'Consciousness <span style="color:#34d399">Swipe</span>'
    elif title == "smilinTux":
        return f'smilin<span style="color:#34d399">Tux</span>'
    else:
        return f'<span style="color:#34d399">{e(title)}</span>'


def hero_title(title: str) -> str:
    """Build the hero h1 with SK prefix in white, rest in emerald."""
    if title.startswith("SK"):
        prefix = "SK"
        rest = title[2:]
        return f'{prefix}<span style="color:#34d399">{e(rest)}</span>'
    elif title == "Cloud 9":
        return f'Cloud <span style="color:#34d399">9</span>'
    elif title == "Soul Blueprints":
        return f'Soul <span style="color:#34d399">Blueprints</span>'
    elif title == "Teddy Banks":
        return f'Teddy <span style="color:#34d399">Banks</span>'
    elif title == "Lumina":
        return f'<span style="color:#34d399">Lumina</span>'
    elif title == "Consciousness Swipe":
        return f'Consciousness <span style="color:#34d399">Swipe</span>'
    elif title == "smilinTux":
        return f'smilin<span style="color:#34d399">Tux</span>'
    else:
        return f'<span style="color:#34d399">{e(title)}</span>'


def build_feature_card(feature: str) -> str:
    return f"""            <div class="feature-card">
              <div class="feature-dot"></div>
              <h3>{e(feature)}</h3>
            </div>"""


def build_page(site: dict) -> str:
    title = site["title"]
    tagline = site["tagline"]
    desc = site["desc"]
    features = site["features"]
    install = site.get("install")
    github = site.get("github")
    domain = site["domain"]
    icon_key = site["icon"]
    cta_text = site.get("cta_text")

    icon_svg = ICONS.get(icon_key, ICONS["globe"])
    favicon_raw = FAVICON_RAW.get(icon_key, "%F0%9F%8C%90")

    # Nav links
    nav_links = []
    nav_links.append(f'<a href="https://skworld.io" class="nav-link">SKWorld</a>')
    nav_links.append(f'<a href="https://skarchitect.io" class="nav-link">SKArchitect</a>')
    if github:
        nav_links.append(f'<a href="{e(github)}" class="nav-link" target="_blank" rel="noopener">GitHub</a>')
    nav_html = "\n            ".join(nav_links)

    # Feature cards
    feature_cards = "\n".join(build_feature_card(f) for f in features)

    # Install section
    install_section = ""
    if install:
        install_section = f"""
      <section class="install-section">
        <h2>Get Started</h2>
        <div class="code-block">
          <span class="code-prompt">$</span> {e(install)}
          <button class="copy-btn" onclick="navigator.clipboard.writeText('{e(install)}');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500)">Copy</button>
        </div>
      </section>"""

    # CTA buttons
    cta_buttons = []
    if install:
        cta_buttons.append(f'<a href="#install" class="btn-primary">Get Started</a>')
    if github:
        cta_buttons.append(f'<a href="{e(github)}" class="btn-outline" target="_blank" rel="noopener">View on GitHub</a>')
    if not install and not github:
        cta_buttons.append(f'<a href="https://skworld.io" class="btn-primary">Explore SKWorld</a>')

    cta_html = "\n          ".join(cta_buttons)

    # DID CTA banner (only for capauth-io and skcapstone-io)
    did_banner = ""
    if cta_text:
        did_banner = f"""
      <section class="did-banner">
        <div class="did-banner-inner">
          <div class="did-icon">{ICONS["lock"]}</div>
          <div>
            <h3>{e(cta_text)}</h3>
            <p>Get a sovereign DID identity to submit proposals and cast cryptographically signed votes.</p>
          </div>
          <a href="https://skarchitect.io" class="btn-primary">Go to SKArchitect</a>
        </div>
      </section>"""

    # Architect CTA
    architect_banner = f"""
      <section class="architect-banner">
        <p>Shape the future &rarr; <a href="https://skarchitect.io">Submit proposals and vote at skarchitect.io</a></p>
      </section>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{e(title)} -- {e(tagline)}</title>
    <meta name="description" content="{e(desc)}">
    <link rel="canonical" href="https://{e(domain)}">
    <meta property="og:title" content="{e(title)} -- {e(tagline)}">
    <meta property="og:description" content="{e(desc)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://{e(domain)}">
    <meta property="og:site_name" content="SKWorld">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{e(title)} -- {e(tagline)}">
    <meta name="twitter:description" content="{e(desc)}">
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>{favicon_raw}</text></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      *, *::before, *::after {{ margin: 0; padding: 0; box-sizing: border-box; }}

      body {{
        font-family: 'Geist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #09090b;
        color: #fafafa;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }}

      /* ── Nav ─────────────────────────────────── */
      .nav {{
        border-bottom: 1px solid #27272a;
        background: #09090b;
        position: sticky;
        top: 0;
        z-index: 50;
      }}
      .nav-inner {{
        max-width: 72rem;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 4rem;
        padding: 0 1rem;
      }}
      .nav-logo {{
        font-size: 1.25rem;
        font-weight: 700;
        color: #fafafa;
        text-decoration: none;
      }}
      .nav-links {{
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }}
      .nav-link {{
        font-size: 0.875rem;
        color: #a1a1aa;
        text-decoration: none;
        transition: color 0.15s;
      }}
      .nav-link:hover {{
        color: #fafafa;
      }}

      /* ── Hero ────────────────────────────────── */
      .hero {{
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 5rem 1rem 3rem;
      }}
      .hero-icon {{
        color: #34d399;
        margin-bottom: 1.5rem;
        opacity: 0.9;
      }}
      .hero h1 {{
        font-size: clamp(2.5rem, 6vw, 4.5rem);
        font-weight: 700;
        letter-spacing: -0.025em;
        line-height: 1.1;
        margin-bottom: 1.5rem;
      }}
      .hero .tagline {{
        font-size: 1.25rem;
        color: #a1a1aa;
        max-width: 40rem;
        margin-bottom: 2rem;
      }}
      .hero .cta-row {{
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: center;
      }}

      /* ── Buttons ─────────────────────────────── */
      .btn-primary {{
        display: inline-flex;
        align-items: center;
        padding: 0.75rem 1.5rem;
        background: #059669;
        color: #fafafa;
        font-size: 1rem;
        font-weight: 600;
        border-radius: 0.5rem;
        text-decoration: none;
        transition: background 0.15s;
        border: none;
        cursor: pointer;
      }}
      .btn-primary:hover {{
        background: #047857;
      }}
      .btn-outline {{
        display: inline-flex;
        align-items: center;
        padding: 0.75rem 1.5rem;
        background: transparent;
        color: #fafafa;
        font-size: 1rem;
        font-weight: 600;
        border-radius: 0.5rem;
        border: 1px solid #3f3f46;
        text-decoration: none;
        transition: border-color 0.15s, color 0.15s;
        cursor: pointer;
      }}
      .btn-outline:hover {{
        border-color: #a1a1aa;
      }}

      /* ── Description ─────────────────────────── */
      .desc-section {{
        max-width: 48rem;
        margin: 0 auto;
        padding: 2rem 1rem 3rem;
        text-align: center;
      }}
      .desc-section p {{
        font-size: 1.125rem;
        color: #a1a1aa;
        line-height: 1.7;
      }}

      /* ── Features ────────────────────────────── */
      .features-section {{
        max-width: 64rem;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
      }}
      .features-section h2 {{
        text-align: center;
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 2.5rem;
        color: #fafafa;
      }}
      .features-grid {{
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.25rem;
      }}
      .feature-card {{
        border: 1px solid #27272a;
        background: rgba(24,24,27,0.5);
        border-radius: 0.5rem;
        padding: 1.5rem;
        transition: border-color 0.2s, transform 0.2s;
        position: relative;
      }}
      .feature-card:hover {{
        border-color: #34d399;
        transform: translateY(-2px);
      }}
      .feature-dot {{
        width: 8px;
        height: 8px;
        background: #34d399;
        border-radius: 50%;
        margin-bottom: 0.75rem;
      }}
      .feature-card h3 {{
        font-size: 1rem;
        font-weight: 600;
        color: #34d399;
      }}

      /* ── Install ─────────────────────────────── */
      .install-section {{
        max-width: 40rem;
        margin: 0 auto;
        padding: 2rem 1rem 4rem;
        text-align: center;
      }}
      .install-section h2 {{
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 1.5rem;
        color: #fafafa;
      }}
      .code-block {{
        background: #18181b;
        border: 1px solid #27272a;
        border-radius: 0.5rem;
        padding: 1rem 1.25rem;
        font-family: 'Geist Mono', ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
        font-size: 0.95rem;
        color: #34d399;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        position: relative;
      }}
      .code-prompt {{
        color: #a1a1aa;
        user-select: none;
      }}
      .copy-btn {{
        position: absolute;
        right: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        background: #27272a;
        border: 1px solid #3f3f46;
        color: #a1a1aa;
        padding: 0.25rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.8rem;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
        font-family: 'Geist', system-ui, sans-serif;
      }}
      .copy-btn:hover {{
        color: #fafafa;
        border-color: #a1a1aa;
      }}

      /* ── DID Banner ──────────────────────────── */
      .did-banner {{
        max-width: 64rem;
        margin: 0 auto;
        padding: 0 1rem 3rem;
      }}
      .did-banner-inner {{
        border: 1px solid rgba(5,150,105,0.3);
        background: rgba(6,78,59,0.15);
        border-radius: 0.75rem;
        padding: 2rem;
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
      }}
      .did-banner-inner .did-icon {{
        color: #34d399;
        flex-shrink: 0;
      }}
      .did-banner-inner .did-icon svg {{
        width: 32px;
        height: 32px;
      }}
      .did-banner-inner h3 {{
        font-size: 1.125rem;
        font-weight: 600;
        color: #34d399;
        margin-bottom: 0.25rem;
      }}
      .did-banner-inner p {{
        font-size: 0.875rem;
        color: #a1a1aa;
      }}
      .did-banner-inner .btn-primary {{
        margin-left: auto;
        white-space: nowrap;
      }}

      /* ── Architect Banner ────────────────────── */
      .architect-banner {{
        border-top: 1px solid #27272a;
        text-align: center;
        padding: 1.5rem 1rem;
      }}
      .architect-banner p {{
        font-size: 0.95rem;
        color: #a1a1aa;
      }}
      .architect-banner a {{
        color: #34d399;
        text-decoration: none;
        font-weight: 600;
      }}
      .architect-banner a:hover {{
        text-decoration: underline;
      }}

      /* ── Footer ──────────────────────────────── */
      .footer {{
        border-top: 1px solid #27272a;
        background: #09090b;
        padding: 2rem 1rem;
        text-align: center;
      }}
      .footer p {{
        font-size: 0.875rem;
        color: #71717a;
      }}
      .footer .motto {{
        margin-top: 0.5rem;
        color: #52525b;
      }}

      /* ── Mobile ──────────────────────────────── */
      @media (max-width: 768px) {{
        .features-grid {{
          grid-template-columns: 1fr;
        }}
        .nav-links {{
          gap: 1rem;
        }}
        .did-banner-inner {{
          flex-direction: column;
          text-align: center;
        }}
        .did-banner-inner .btn-primary {{
          margin-left: 0;
        }}
        .hero .cta-row {{
          flex-direction: column;
          width: 100%;
          padding: 0 1rem;
        }}
        .hero .cta-row a {{
          width: 100%;
          justify-content: center;
        }}
      }}
      @media (min-width: 769px) and (max-width: 1024px) {{
        .features-grid {{
          grid-template-columns: repeat(2, 1fr);
        }}
      }}
    </style>
</head>
<body>
    <!-- Nav -->
    <nav class="nav">
      <div class="nav-inner">
        <a href="https://{e(domain)}" class="nav-logo">{nav_logo(title)}</a>
        <div class="nav-links">
            {nav_html}
        </div>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-icon">{icon_svg}</div>
      <h1>{hero_title(title)}</h1>
      <p class="tagline">{e(tagline)}</p>
      <div class="cta-row">
          {cta_html}
      </div>
    </section>

    <!-- Description -->
    <section class="desc-section">
      <p>{e(desc)}</p>
    </section>
{did_banner}
    <!-- Features -->
    <section class="features-section" id="features">
      <h2>Features</h2>
      <div class="features-grid">
{feature_cards}
      </div>
    </section>
{install_section}
{architect_banner}
    <!-- Footer -->
    <footer class="footer">
      <p>Part of the <a href="https://skworld.io" style="color:#34d399;text-decoration:none">SKWorld</a> sovereign ecosystem</p>
      <p class="motto">staycuriousANDkeepsmilin</p>
    </footer>
</body>
</html>"""


def main():
    generated = 0
    for site in SITES:
        dir_name = site["dir"]
        # Special case: smilinTux.github.io is a Hugo site, write to root index.html
        target_dir = BASE / dir_name
        if not target_dir.exists():
            print(f"  SKIP: {target_dir} does not exist")
            continue

        target_file = target_dir / "index.html"
        html_content = build_page(site)
        target_file.write_text(html_content, encoding="utf-8")
        size_kb = len(html_content) / 1024
        generated += 1
        print(f"  OK: {target_file} ({size_kb:.1f} KB)")

    print(f"\nGenerated {generated} / {len(SITES)} sites.")


if __name__ == "__main__":
    main()
