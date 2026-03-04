import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const nationals = sqliteTable("nationals", {
  did_key: text("did_key").primaryKey(),
  entity_type: text("entity_type", {
    enum: ["human", "ai", "organization"],
  }).notNull(),
  display_name: text("display_name"),
  avatar_url: text("avatar_url"),
  public_key_b64: text("public_key_b64"),
  role: text("role", {
    enum: ["national", "moderator", "admin"],
  })
    .notNull()
    .default("national"),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const proposals = sqliteTable("proposals", {
  proposal_id: text("proposal_id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category", {
    enum: [
      "infrastructure",
      "policy",
      "technology",
      "culture",
      "challenge",
      "solution",
      "partnership",
    ],
  }).notNull(),
  status: text("status", {
    enum: ["draft", "open", "closed", "archived"],
  })
    .notNull()
    .default("draft"),
  author_did: text("author_did")
    .notNull()
    .references(() => nationals.did_key),
  author_type: text("author_type", {
    enum: ["human", "ai", "organization"],
  }).notNull(),
  tags: text("tags").default("[]"), // JSON array
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  hidden_by: text("hidden_by"),
  hidden_reason: text("hidden_reason"),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  closed_at: text("closed_at"),
});

export const votes = sqliteTable("votes", {
  vote_id: text("vote_id").primaryKey(),
  proposal_id: text("proposal_id")
    .notNull()
    .references(() => proposals.proposal_id),
  voter_did: text("voter_did")
    .notNull()
    .references(() => nationals.did_key),
  choice: text("choice", {
    enum: ["approve", "reject", "abstain"],
  }).notNull(),
  priority: integer("priority").notNull().default(5),
  signature: text("signature").notNull(),
  version: integer("version").notNull().default(1),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const delegations = sqliteTable("delegations", {
  delegation_id: text("delegation_id").primaryKey(),
  delegator_did: text("delegator_did")
    .notNull()
    .references(() => nationals.did_key),
  delegate_did: text("delegate_did")
    .notNull()
    .references(() => nationals.did_key),
  category: text("category"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const comments = sqliteTable("comments", {
  comment_id: text("comment_id").primaryKey(),
  proposal_id: text("proposal_id")
    .notNull()
    .references(() => proposals.proposal_id),
  author_did: text("author_did")
    .notNull()
    .references(() => nationals.did_key),
  body: text("body").notNull(),
  hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
  hidden_by: text("hidden_by"),
  hidden_reason: text("hidden_reason"),
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const tallyCache = sqliteTable("tally_cache", {
  proposal_id: text("proposal_id")
    .primaryKey()
    .references(() => proposals.proposal_id),
  approve: integer("approve").notNull().default(0),
  reject: integer("reject").notNull().default(0),
  abstain: integer("abstain").notNull().default(0),
  total_direct: integer("total_direct").notNull().default(0),
  total_delegated: integer("total_delegated").notNull().default(0),
  computed_at: text("computed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
