import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { content } from "./exercise-helpers.mjs";
import { renderMarkdown } from "../../.github/extensions/governance-lab/ui/markdown.js";

test("every block numbers its decisions sequentially in authored order", () => {
  for (const path of content.paths) {
    const prefix = path.decisions[0].id.split("-")[0];
    assert.deepEqual(path.decisions.map(({ id }) => id),
      path.decisions.map((_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`), path.id);
    const prose = path.sourceText.split("\n").filter((line) => !/^#{1,6} |^\*\*[^*]+:\*\*/.test(line)).join("\n");
    assert.doesNotMatch(prose, /\bquestion \d+\b|\b(?:AM|UG|BC|AG|CM|OB)-(?:\d{2}|LAB)\b/, path.id);
  }
});

test("single-user copy is consistent outside Agent Governance", () => {
  for (const path of content.paths.filter(({ id }) => id !== "agent-governance")) {
    assert.doesNotMatch(path.sourceText,
      /assigned test|assigned organization-owned|other participants|shared sandbox|facilitator|test user|other users' data/i, path.id);
  }
});

test("source pointers, warnings and US spelling use the shared conventions", () => {
  for (const path of content.paths) {
    assert.doesNotMatch(path.sourceText, /^(?:Documentation:|Sources:)|^\*\*Warning\*\*\s*:/gmi, path.id);
    assert.doesNotMatch(path.sourceText, /(?:^|> )For more [^\n]*, see|- for more info, see our/gmi, path.id);
    assert.doesNotMatch(path.sourceText, /^- \[[^\n]+\]\(https:\/\/docs\.github\.com\//gm, path.id);
    assert.doesNotMatch(path.sourceText, /\b(?:behaviour|analyse|standardise|capitalised|acknowledgement)\b/, path.id);
    for (const label of ["Copilot usage metrics", "Copilot metrics API", "AI credits paid usage",
      "Let organizations decide", "View Enterprise Copilot Metrics", "Review effort level",
      "Automatically request Copilot code review", "Allow automations"]) {
      assert.ok(!path.sourceText.includes(`**${label}**`), `${path.id}: ${label}`);
    }
  }
});

test("confirmed documentation mappings use their verified Enterprise Cloud versions", () => {
  const catalog = readFileSync(new URL("../../content/policy-catalog.json", import.meta.url), "utf8");
  const verifiedExamples = {
    "access-management": "billing/concepts/product-billing/github-copilot-licenses",
    "user-governance": "copilot/tutorials/optimize-ai-usage",
    "billing-cost-control": "billing/reference/supported-payment-methods",
    "agent-governance": "copilot/tutorials/roll-out-at-scale/govern-at-scale/govern-for-adoption",
    "context-management": "copilot/concepts/prompting-and-context/custom-instructions",
    observability: "copilot/how-tos/administer-copilot/view-impact-dashboard",
    catalog: "copilot/concepts/customizations/agent-skills",
  };
  for (const [id, suffix] of Object.entries(verifiedExamples)) {
    const source = id === "catalog" ? catalog : content.paths.find((path) => path.id === id).sourceText;
    assert.ok(source.includes(`https://docs.github.com/en/enterprise-cloud@latest/${suffix}`), id);
    assert.ok(!source.includes(`https://docs.github.com/en/${suffix}`), id);
  }
});

test("code fences in steps remain nested under their list items", () => {
  for (const path of content.paths) {
    for (const item of [...path.recipes, ...path.validations]) {
      for (const sections of [item.sections, ...(item.variants ?? []).map(({ sections }) => sections)]) {
        if (!sections?.Steps) continue;
        let fenced = false;
        for (const line of sections.Steps.split("\n")) {
          if (!/^\s*```/.test(line)) continue;
          assert.match(line, /^ {3,}```/, `${path.id}: ${item.id ?? item.exerciseId}`);
          fenced = !fenced;
        }
        assert.equal(fenced, false);
      }
    }
  }
  const billing = content.paths.find(({ id }) => id === "billing-cost-control");
  const reporting = billing.recipes.find(({ id }) => id === "bc-user-visibility");
  const rendered = renderMarkdown(reporting.sections.Steps);
  assert.match(rendered, /<li[^>]*>[\s\S]*<pre/);
  assert.match(rendered, /2026-10-01/);
});

test("intentionally time-bound workshop wording is preserved", () => {
  for (const id of ["access-management", "user-governance", "billing-cost-control"]) {
    assert.match(content.paths.find((path) => path.id === id).sourceText, /\bcurrently\b/);
  }
  const billing = content.paths.find(({ id }) => id === "billing-cost-control").sourceText;
  assert.match(billing, /This Universe 26, we announced/);
  assert.match(billing, /START_DATE='2026-10-01'\n   END_DATE='2026-10-31'/);
});

test("User Governance introduces policy states and explains mixed ownership at enterprise scope", () => {
  const user = content.paths.find(({ id }) => id === "user-governance");
  const understand = user.sourceText.split("## Understand")[1].split("## Decisions")[0];
  assert.match(understand, /enable a feature, disable it, or let organizations decide/);
  assert.match(understand, /Generally available \(GA\)/);
  assert.match(understand, /Preview features do not follow the feature default/);
  assert.match(understand, /pre-GA models are outside the model default/);
  const ownership = user.decisions.find(({ id }) => id === "UG-01");
  assert.match(ownership.options.find(({ id }) => id === "mixed").markdown, /Organization owners manage the policies delegated to them/);
  assert.doesNotMatch(ownership.question + ownership.guidance, /Feature- and Model|Enterprise Owners|AI Policy Decision Makers/);
  assert.equal(user.decisions.find(({ id }) => id === "UG-02").title, "Default model availability");
  assert.equal(user.decisions.find(({ id }) => id === "UG-03").title, "Default client & feature availability");
  assert.match(user.decisions.find(({ id }) => id === "UG-05").question, /chosen for your enterprise/);
  const models = user.stages.configure.additionalSteps.find(({ catalogIds }) => catalogIds.includes("models-features.model-access-for-enterprise-teams"));
  assert.match(models.markdown, /opted in to the enterprise teams preview for model access/);
});
