/**
 * SKArchitect — Sovereign civic participation types for human-AI republics.
 * @module @smilintux/skarchitect
 */

// --- Entity Types ---

export type EntityType = "human" | "ai" | "organization";

export type ProposalStatus = "draft" | "open" | "closed" | "archived";

export type VoteChoice = "approve" | "reject" | "abstain";

export type ProposalCategory =
  | "infrastructure"
  | "policy"
  | "technology"
  | "culture"
  | "challenge"
  | "solution"
  | "partnership";

// --- Core Models ---

export interface National {
  did_key: string;
  entity_type: EntityType;
  display_name?: string;
  avatar_url?: string;
  public_key_b64?: string;
  created_at: string; // ISO 8601
}

export interface Proposal {
  proposal_id: string;
  title: string;
  body: string;
  category: ProposalCategory;
  status: ProposalStatus;
  author_did: string;
  author_type: EntityType;
  tags: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface Vote {
  vote_id: string;
  proposal_id: string;
  voter_did: string;
  choice: VoteChoice;
  priority: number; // 1-10
  signature: string; // Base64 Ed25519
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Delegation {
  delegation_id: string;
  delegator_did: string;
  delegate_did: string;
  category?: ProposalCategory;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Tally {
  proposal_id: string;
  approve: number;
  reject: number;
  abstain: number;
  total_direct: number;
  total_delegated: number;
  computed_at: string;
}

// --- Auth ---

export interface AuthChallenge {
  challenge: string;
  expires_at: string;
}

export interface AuthVerifyRequest {
  did_key: string;
  challenge: string;
  signature: string; // Base64 Ed25519
  public_key_b64: string;
}

export interface AuthSession {
  session_id: string;
  did_key: string;
  entity_type: EntityType;
  expires_at: string;
}

// --- Category Metadata ---

export interface CategoryMeta {
  label: string;
  description: string;
  icon: string;
}

export const CATEGORIES: Record<ProposalCategory, CategoryMeta> = {
  infrastructure: {
    label: "Infrastructure",
    description: "Physical and digital infrastructure proposals",
    icon: "building",
  },
  policy: {
    label: "Policy",
    description: "Governance policies and collective agreements",
    icon: "scroll",
  },
  technology: {
    label: "Technology",
    description: "Technology development and adoption",
    icon: "cpu",
  },
  culture: {
    label: "Culture",
    description: "Cultural initiatives and community building",
    icon: "palette",
  },
  challenge: {
    label: "Challenge",
    description: "Problems and challenges facing the republic",
    icon: "alert-triangle",
  },
  solution: {
    label: "Solution",
    description: "Proposed solutions to identified challenges",
    icon: "lightbulb",
  },
  partnership: {
    label: "Partnership",
    description: "Human-AI partnership proposals and collaborations",
    icon: "handshake",
  },
};
