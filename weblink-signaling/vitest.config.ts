import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        // Disable per-test storage isolation so DO storage persists across
        // request boundaries within a test (required for rate-limiting tests
        // where the DO may hibernate and be re-created between requests).
        // Tests are isolated by using unique room names (different DO instances).
        isolatedStorage: false,
      },
    },
  },
});
