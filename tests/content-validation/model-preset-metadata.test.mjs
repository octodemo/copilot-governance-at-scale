import assert from "node:assert/strict";
import test from "node:test";
import { loadContent } from "../../.github/extensions/governance-lab/content.mjs";

const content = await loadContent();

test("UG-05 and its recipes use model-specific metadata and documentation", () => {
  const path = content.paths.find(({ id }) => id === "user-governance");
  const decision = path.decisions.find(({ id }) => id === "UG-05");
  assert.deepEqual(decision.policyIds, ["user.model-presets"]);
  const recipes = path.recipes.filter(({ id }) => id.startsWith("ug-05-"));
  assert.ok(recipes.length > 0);
  for (const recipe of recipes) assert.deepEqual(recipe.policyIds, ["user.model-presets"]);

  const policy = content.policies.find(({ id }) => id === "user.model-presets");
  assert.equal(policy.governanceCategory, "user");
  assert.ok(policy.supportedSurfaces.some((surface) => surface.startsWith("model:")));
  assert.ok(policy.supportedSurfaces.some((surface) => surface.startsWith("autoTier:")));
  assert.ok(policy.knownLimitations.some((limitation) => limitation.includes("remains unresolved")));
  assert.ok(policy.documentation.some(({ url }) => url.endsWith("/auto-model-selection")));
  assert.ok(policy.documentation.every(({ label, url }) => !/MCP|allowlist|permission/i.test(`${label} ${url}`)));
  assert.ok(content.policies.find(({ id }) => id === "agent.client-managed-settings")
    .documentation.some(({ url }) => url.endsWith("/configure-enterprise-allowlist")));
});
