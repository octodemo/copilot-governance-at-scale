import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkshopMarkdown, resolveConfiguration, validatePolicyCatalog } from "../../lib/workshop-content.mjs";
import { content, harness } from "./exercise-helpers.mjs";
import { renderMarkdown } from "../../.github/extensions/governance-lab/ui/markdown.js";

const id = "observability";
const path = content.paths.find((item) => item.id === id);
const auditRecipe = path.recipes.find((item) => item.exerciseId === "OB-AUDIT");
const auditValidation = path.validations.find((item) => item.exerciseId === "OB-AUDIT");

test("Observability restores the metrics and OTel decisions with distinct Configure guidance", () => {
  assert.deepEqual(path.decisions.map((item) => item.id), ["OB-01", "OB-02", "OB-03", "OB-04", "OB-05", "OB-06"]);
  assert.deepEqual(path.recipes.map((item) => item.id), [
    "obs-metrics-access",
    "obs-org-metrics-access",
    "obs-usage-export",
    "obs-industry-comparison",
    "obs-industry-comparison-off",
    "obs-otel-settings",
    "obs-otel-identity",
    "obs-audit-review",
  ]);
  assert.deepEqual(path.validations.map((item) => item.exerciseId), ["OB-DASHBOARDS", "OB-USAGE-EXPORT", "OB-AUDIT"]);
  assert.deepEqual(path.decisions[0].options.map((option) => option.id), ["github-history", "periodic-export", "external-stream"]);
  assert.match(path.decisions[0].guidance, /snapshot.*one-off review/s);
  assert.match(path.decisions[0].guidance, /script or integration.*regularly/);
  const dashboardDecision = path.decisions.find(({ id }) => id === "OB-02");
  assert.match(dashboardDecision.guidance, /every organization owner the power to enable/);
  assert.match(dashboardDecision.guidance, /While this choice is delegated/);
  assert.match(dashboardDecision.guidance, /Delegation cannot be limited to selected organizations/);
  assert.doesNotMatch(dashboardDecision.guidance, /no further control/);
  assert.ok(path.decisions[0].options.every((option) => !/Navigate|script|streaming settings/i.test(option.markdown)));
  assert.ok(path.decisions.every((decision) => decision.options.every((option) => !/Navigate to|Create a custom role|managed-settings\.json|^\s*Enable or disable/i.test(option.markdown))));
  for (const variant of auditRecipe.variants) {
    assert.match(variant.sections.Steps, /Navigate to your \*\*\[Enterprise Settings -> Settings -> Audit log\]\(https:\/\/github\.com\/enterprises\/\{\{enterprise\.slug\}\}\/audit-log "fallback=https:\/\/github\.com\/settings\/enterprises"\)\*\*/);
    if (variant.optionId === "external-stream") assert.match(variant.sections.Steps, /Explore the available audit-log streaming options/);
    else assert.match(variant.sections.Steps, /Leave the streaming settings unchanged/);
    assert.doesNotMatch(variant.sections.Steps, /whether a stream is already configured|existing stream configuration/i);
  }
  assert.match(auditRecipe.sections.Safety, /This is for showcase purposes only/);
  assert.ok(resolveConfiguration(path, { "OB-01": "github-history" }).exercises.some((item) => item.recipe.exerciseId === "OB-AUDIT"));
  assert.ok(resolveConfiguration(path, {}).exercises.length === 0);
  assert.equal(Object.hasOwn(auditRecipe, "exerciseKind"), false);
  assert.equal(auditValidation.fields[0].id, "auditEvidence");
  assert.deepEqual(
    resolveConfiguration(path, { "OB-03": "delegated-viewers" }).guidance.map((item) => item.recipe.id),
    ["obs-metrics-access"],
  );
  assert.deepEqual(
    resolveConfiguration(path, { "OB-02": "enabled" }).exercises.map((item) => item.recipe.id),
    ["obs-org-metrics-access"],
  );
  assert.deepEqual(
    resolveConfiguration(path, { "OB-02": "disabled" }).guidance,
    [],
  );
  assert.deepEqual(
    resolveConfiguration(path, { "OB-04": "api-reports" }).exercises.map((item) => item.recipe.id),
    ["obs-usage-export"],
  );
  assert.deepEqual(
    resolveConfiguration(path, { "OB-05": "benchmarks-off" }).guidance.map((item) => item.recipe.id),
    ["obs-industry-comparison-off"],
  );
  assert.deepEqual(
    resolveConfiguration(path, { "OB-06": "identity-telemetry" }).guidance.map((item) => item.recipe.id),
    ["obs-otel-settings", "obs-otel-identity"],
  );
  assert.doesNotMatch(path.sourceText, /OB-(?:07|08|LAB)\b/);
  assert.match(path.decisions.find((item) => item.id === "OB-05").guidance, /only when Copilot dashboards are enabled/);
  assert.match(path.decisions.find((item) => item.id === "OB-06").guidance, /raw agent-session data.*deeper analysis/s);
});

test("every resolved Observability answer selects eligible recipes and its exact variant", () => {
  const expected = {
    "OB-01": {
      "github-history": ["obs-audit-review"],
      "periodic-export": ["obs-audit-review"],
      "external-stream": ["obs-audit-review"],
    },
    "OB-02": {
      enabled: ["obs-org-metrics-access"],
      disabled: ["obs-org-metrics-access"],
    },
    "OB-03": { owners: [], "delegated-viewers": ["obs-metrics-access"] },
    "OB-04": {
      "no-api": ["obs-usage-export"],
      "api-reports": ["obs-usage-export"],
      "api-everywhere": ["obs-usage-export"],
    },
    "OB-05": {
      "benchmarks-on": ["obs-industry-comparison"],
      "benchmarks-off": ["obs-industry-comparison-off"],
    },
    "OB-06": {
      "no-client-telemetry": [],
      "minimal-telemetry": ["obs-otel-settings"],
      "identity-telemetry": ["obs-otel-settings", "obs-otel-identity"],
    },
  };
  for (const decision of path.decisions) {
    for (const option of decision.options) {
      const result = resolveConfiguration(path, { [decision.id]: option.id });
      assert.deepEqual(result.recipes.map(({ recipe }) => recipe.id), option.deferred ? [] : expected[decision.id][option.id]);
      for (const entry of result.recipes) {
        assert.equal(entry.eligible, true, `${decision.id}.${option.id}`);
        if (entry.recipe.variantDecisionId) assert.equal(entry.variant.optionId, option.id);
      }
      for (const { validation } of result.exercises) {
        assert.equal(validation.variantDecisionId, decision.id);
        assert.equal(validation.activeVariant.optionId, option.id);
      }
    }
  }
});

test("dashboard variants give one concrete scope and API choices do not select opposite instructions", () => {
  const dashboardDecision = path.decisions.find((item) => item.id === "OB-02");
  assert.equal(dashboardDecision.title, "Enable Copilot Dashboards");
  assert.deepEqual(dashboardDecision.options.map((option) => [option.id, option.label]), [
    ["enabled", "Enable everywhere"],
    ["disabled", "Disable everywhere"],
  ]);
  assert.match(dashboardDecision.guidance, /Copilot usage metrics/);
  const apiDecision = path.decisions.find((item) => item.id === "OB-04");
  assert.equal(apiDecision.title, "Enable Copilot Metrics API");
  assert.match(apiDecision.question, /enable the Copilot metrics API/i);
  assert.match(apiDecision.guidance, /all organizations at once/);
  assert.deepEqual(apiDecision.options.map((option) => option.label), [
    "No, keep the API disabled",
    "Let organization owners decide",
    "Enable everywhere",
  ]);
  const dashboardSteps = {
    enabled: /Set `Copilot usage metrics` to `Enabled everywhere`/,
    disabled: /Set `Copilot usage metrics` to `Disabled everywhere`/,
  };
  for (const [answer, steps] of Object.entries(dashboardSteps)) {
    const entry = resolveConfiguration(path, { "OB-02": answer }).exercises[0];
    assert.match(entry.variant.sections.Steps, steps);
    assert.equal(entry.recipe.exerciseId, "OB-DASHBOARDS");
    assert.equal(entry.recipe.title, "Set Copilot dashboard availability");
    assert.equal(entry.recipe.target, "enterprise");
    assert.equal(entry.recipe.sections.Steps, undefined);
    assert.match(entry.variant.sections.Steps, /Billing & usage/);
    assert.doesNotMatch(entry.variant.sections.Steps, /Let organization owners decide|Organization Settings/);
  }
  for (const [answer, value] of Object.entries({
    "no-api": "Disabled",
    "api-reports": "Let organization owners decide",
    "api-everywhere": "Enabled everywhere",
  })) {
    const result = resolveConfiguration(path, { "OB-04": answer });
    assert.equal(result.guidance.length, 0);
    const exercise = result.exercises[0];
    assert.equal(exercise.recipe.exerciseId, "OB-USAGE-EXPORT");
    assert.equal(exercise.recipe.target, "enterprise");
    assert.match(exercise.variant.sections.Steps, /Set `Copilot metrics API`/);
    assert.doesNotMatch(exercise.variant.sections.Steps, /Set `Copilot usage metrics`/);
    assert.ok(exercise.variant.sections.Steps.includes(`to \`${value}\``));
    assert.equal(result.exercises.length, 1);
  }
  const off = resolveConfiguration(path, { "OB-05": "benchmarks-off" }).guidance[0].recipe;
  assert.match(off.sections.Steps, /Disable `Copilot metrics industry comparison`/);
  assert.doesNotMatch(off.sections.Steps, /Enable `Copilot metrics industry comparison`/);
  const identity = resolveConfiguration(path, { "OB-06": "identity-telemetry" }).guidance[1].recipe;
  assert.match(identity.sections.Steps, /from `false` to `true`/);
});

test("dashboard-dependent choices warn without changing answer resolution", () => {
  for (const decisionId of ["OB-03", "OB-05"]) {
    assert.match(path.decisions.find(({ id }) => id === decisionId).guidance, /> \[!WARNING\]\n> If you disabled Copilot dashboards/);
  }
  for (const [decisionId, optionId, recipeId] of [
    ["OB-03", "delegated-viewers", "obs-metrics-access"],
    ["OB-05", "benchmarks-on", "obs-industry-comparison"],
    ["OB-05", "benchmarks-off", "obs-industry-comparison-off"],
  ]) {
    const result = resolveConfiguration(path, { "OB-02": "disabled", [decisionId]: optionId });
    assert.equal(result.recipes.find(({ recipe }) => recipe.id === recipeId).eligible, true);
  }
});

test("impact and industry catalog coverage follows existing dashboard and comparison guidance", () => {
  assert.ok(path.decisions.find(({ id }) => id === "OB-02").catalogIds.includes("metrics.impact-dashboard"));
  assert.ok(path.recipes.find(({ id }) => id === "obs-org-metrics-access").catalogIds.includes("metrics.impact-dashboard"));
  assert.deepEqual(path.decisions.find(({ id }) => id === "OB-05").catalogIds, ["metrics.industry-comparisons"]);
  for (const [id, action] of [["obs-industry-comparison", "Enable"], ["obs-industry-comparison-off", "Disable"]]) {
    const recipe = path.recipes.find((recipe) => recipe.id === id);
    assert.deepEqual(recipe.catalogIds, ["metrics.industry-comparisons"]);
    assert.ok(recipe.sections.Steps.includes(`${action} \`Copilot metrics industry comparison\``));
  }
  assert.deepEqual(path.validations.map(({ exerciseId }) => exerciseId), ["OB-DASHBOARDS", "OB-USAGE-EXPORT", "OB-AUDIT"]);
});

test("Observability review edits keep minimal capture and remove redundant instructions", () => {
  assert.doesNotMatch(path.sourceText, /and save|, save,|Prepare the Copilot metrics API check|Leave existing dashboard access unchanged/);
  const role = path.recipes.find((recipe) => recipe.id === "obs-metrics-access");
  assert.equal((role.sections.Steps.match(/^\d+\./gm) ?? []).length, 4);
  const industry = path.recipes.find((recipe) => recipe.id === "obs-industry-comparison");
  assert.equal((industry.sections.Steps.match(/^\d+\./gm) ?? []).length, 2);
  assert.match(industry.sections.Steps, /> \[!NOTE\]\n> The setting affects dashboards/);
  for (const [answer, identity] of [["minimal-telemetry", false], ["identity-telemetry", true]]) {
    const { guidance } = resolveConfiguration(path, { "OB-06": answer });
    const minimal = guidance[0].recipe;
    assert.match(minimal.markdown, /This is for showcase purposes only/);
    assert.match(minimal.sections.Steps, /not whether traces, metrics, and events are collected/);
    for (const [index, { recipe }] of guidance.entries()) {
      const json = recipe.sections.Steps.match(/   ```json\n([\s\S]*?)\n   ```/)[1];
      const { telemetry } = JSON.parse(json);
      assert.equal(telemetry.enabled, true);
      assert.deepEqual(telemetry.capture, {
        identity: index === 1 && identity,
        prompts: false,
        responses: false,
        toolArguments: false,
        toolOutput: false,
        policyDetail: false,
      });
    }
  }
  for (const variant of auditRecipe.variants) {
    assert.doesNotMatch(variant.sections.Steps, /Do not change any setting|No streaming change|Do not configure a destination/);
  }
});

test("dashboard and viewer choices defer access checks and keep API access under its own policy", () => {
  assert.doesNotMatch(path.sourceText, /Usage metrics API endpoints require `Copilot usage metrics` to be `Enabled everywhere`/);
  assert.match(path.sourceText, /The Copilot metrics API policy controls access to these APIs/);
  const enabled = resolveConfiguration(path, {
    "OB-03": "delegated-viewers",
    "OB-02": "enabled",
    "OB-04": "no-api",
  });
  const role = enabled.guidance.find(({ recipe }) => recipe.id === "obs-metrics-access").recipe;
  assert.doesNotMatch(role.sections.Steps, /open the .*dashboard|check whether .*dashboard/i);
  assert.ok(enabled.recipes.findIndex(({ recipe }) => recipe.id === "obs-metrics-access")
    < enabled.recipes.findIndex(({ recipe }) => recipe.id === "obs-org-metrics-access"));
  const enabledValidation = enabled.exercises.find(({ recipe }) => recipe.exerciseId === "OB-DASHBOARDS").validation;
  assert.match(enabledValidation.sections.Steps, /Restore `Enabled everywhere`/);
  assert.doesNotMatch(enabledValidation.sections.Steps, /ask them to open the enterprise dashboard|sandbox has one user/);
  assert.doesNotMatch(enabled.exercises.find(({ recipe }) => recipe.exerciseId === "OB-USAGE-EXPORT").validation.sections.Steps,
    /Copilot usage metrics.*Enabled everywhere.*prerequisite[\s\S]*OB-02 choice/);

  const disabled = resolveConfiguration(path, {
    "OB-03": "delegated-viewers",
    "OB-02": "disabled",
    "OB-04": "no-api",
  });
  const disabledValidation = disabled.exercises.find(({ recipe }) => recipe.exerciseId === "OB-DASHBOARDS").validation;
  assert.doesNotMatch(disabledValidation.sections.Steps, /ask them to open the enterprise dashboard/);
  assert.doesNotMatch(disabled.exercises.find(({ recipe }) => recipe.exerciseId === "OB-USAGE-EXPORT").validation.sections.Steps,
    /Copilot usage metrics.*Enabled everywhere.*prerequisite[\s\S]*OB-02 choice/);
  const policy = content.policies.find(({ id: policyId }) => policyId === "observability.usage-metrics");
  assert.match(policy.prerequisites.join(" "), /enabled everywhere for dashboard access/);
  assert.match(policy.prerequisites.join(" "), /Copilot metrics API policy controls API access/);
});

test("verification distinguishes each dashboard, API scope and audit decision without Configure checks", () => {
  const validationFor = (decision, answer) => resolveConfiguration(path, { [decision]: answer }).exercises[0].validation;
  const dashboard = validationFor("OB-02", "enabled");
  const usage = validationFor("OB-04", "api-reports");
  assert.match(dashboard.sections.Steps, /Set it to `Disabled everywhere`/);
  assert.match(dashboard.sections.Steps, /Restore `Enabled everywhere`/);
  for (const answer of ["enabled", "disabled"]) {
    const steps = validationFor("OB-02", answer).sections.Steps;
    for (const suffix of ["/impact", "", "/code-generation"]) {
      assert.ok(steps.includes(`https://github.com/enterprises/{{enterprise.slug}}/insights/copilot${suffix} "fallback=`));
    }
    assert.match(steps, /You will not see usage data in this sandbox/);
    assert.match(steps, /Reload the three dashboards and compare/);
    assert.match(steps, /^1\. Open each dashboard/);
    assert.doesNotMatch(steps, /You can find|Remember:/);
  }
  assert.doesNotMatch(dashboard.sections.Steps, /Let organization owners decide|Organization Settings/);
  assert.match(dashboard.sections.Fallback, /Do not claim/);
  assert.match(usage.sections.Steps, /\/orgs\/\{\{organization\.slug\}\}\/copilot\/metrics\/reports\/organization-28-day\/latest/);
  assert.match(usage.sections.Steps, /\.download_links/);
  for (const steps of [usage.sections.Steps, validationFor("OB-04", "api-everywhere").sections.Steps]) {
    assert.match(steps, /Paste each link into your browser/);
    assert.match(steps, /jq -r '\.download_links\[\]' usage-report-links\.json/);
    assert.match(steps, /Alternatively, download every file from the terminal/);
  }
  assert.match(usage.sections.Steps, /curl --fail --location/);
  assert.match(usage.sections.Steps, /while IFS= read -r url/);
  assert.match(usage.sections.Steps, /head -n 1 copilot-usage-1\.ndjson \| jq \./);
  assert.doesNotMatch(usage.sections.Steps, /Remove the local reports and signed-link files/);
  assert.match(usage.sections.Fallback, /status and message/);
  const disabled = validationFor("OB-02", "disabled");
  assert.match(disabled.sections.Steps, /Set it to `Enabled everywhere`/);
  assert.match(disabled.sections.Steps, /Restore `Disabled everywhere`/);
  assert.match(disabled.sections.Steps, /dashboard indicates Copilot usage metrics are disabled/);
  assert.doesNotMatch(disabled.sections.Steps, /check whether the dashboard opens|three full UTC days/);
  const noApi = validationFor("OB-04", "no-api");
  assert.match(noApi.sections.Steps, /404 Error/);
  assert.doesNotMatch(noApi.sections.Steps, /YOUR-TEST-ENTERPRISE|Copilot usage metrics.*prerequisite/);
  assert.doesNotMatch(noApi.sections.Steps, /curl|while IFS/);
  assert.match(noApi.sections["Expected result"], /does not establish policy enforcement/);
  for (const answer of ["github-history", "periodic-export", "external-stream"]) {
    const audit = validationFor("OB-01", answer);
    assert.match(audit.sections.Steps, /> \[!TIP\]\n> If you do not see Copilot activity/);
    assert.match(audit.sections.Steps, /your \[Petstore workshop repository\]\(https:\/\/github\.com\/\{\{organization\.slug\}\}\/\{\{repository\.name\}\} "fallback=https:\/\/github\.com\/settings\/organizations"\)/);
    assert.match(audit.sections.Steps, /Copilot cloud agent session/);
    assert.doesNotMatch(audit.sections.Steps, /Do not create an agent run just to populate the audit log/);
  }
  const enterprise = validationFor("OB-04", "api-everywhere");
  assert.match(enterprise.sections.Steps, /\/enterprises\/\{\{enterprise.slug\}\}\/copilot/);
  assert.doesNotMatch(enterprise.sections.Steps, /\/orgs\//);
  assert.doesNotMatch(usage.sections.Steps, /\/enterprises\//);
  const auditExport = validationFor("OB-01", "periodic-export");
  assert.match(auditExport.sections.Steps, /--method GET --paginate --slurp/);
  assert.match(auditExport.sections.Steps, /include='all'/);
  assert.match(auditExport.sections.Steps, /phrase='action:copilot'/);
  assert.match(auditExport.sections.Steps, /phrase='actor:Copilot'/);
  assert.doesNotMatch(validationFor("OB-01", "github-history").sections.Steps, /gh api/);
  assert.match(validationFor("OB-01", "external-stream").sections["Expected result"], /External delivery and retention remain unverified/);
  assert.match(validationFor("OB-01", "external-stream").sections.Steps, /navigate to your \*\*\[Enterprise Settings -> Settings -> Audit log\]\([^)]*\)\*\* and explore the available streaming options/i);
  assert.doesNotMatch(validationFor("OB-01", "external-stream").sections.Steps, /check that it remains unchanged|review the streaming section/i);
  for (const recipe of path.recipes) {
    const steps = [recipe.sections.Steps, ...recipe.variants.map((variant) => variant.sections.Steps)].filter(Boolean).join("\n");
    assert.doesNotMatch(steps, /gh api|curl|check whether the dashboard opens|dashboard says/i);
  }
});

test("all Observability API commands use profile identifiers without scope variables", () => {
  assert.doesNotMatch(path.sourceText, /\$(?:ENTERPRISE|ORG)\b|^(?:\s*)(?:ENTERPRISE|ORG)=/m);
  const rendered = renderMarkdown(path.sourceText, { enterpriseSlug: "Lab-Enterprise", organizationSlug: "Lab-Org" });
  const commands = [...rendered.matchAll(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)].map(([, code]) => code).join("\n");
  assert.equal((commands.match(/\/enterprises\/Lab-Enterprise\/(?:copilot\/metrics\/reports\/enterprise-28-day\/latest|audit-log)/g) ?? []).length, 5);
  assert.equal((commands.match(/\/orgs\/Lab-Org\/copilot\/metrics\/reports\/organization-28-day\/latest/g) ?? []).length, 1);
  for (const [, code] of rendered.matchAll(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)) assert.doesNotMatch(code, /\{\{/);
  assert.match(renderMarkdown(path.sourceText, {}), /\/orgs\/YOUR-TEST-ORG\/copilot/);
  assert.match(renderMarkdown(path.sourceText, {}), /\/enterprises\/YOUR-TEST-ENTERPRISE\/audit-log/);
});

test("Observability content rejects unknown policies and unofficial catalog sources", () => {
  const invalidPolicy = path.sourceText.replace("**Policies:** observability.agent-activity", "**Policies:** unknown.policy");
  assert.ok(parseWorkshopMarkdown(invalidPolicy, { catalog: { policies: content.policies } }).diagnostics.some((item) => item.code === "E_POLICY_REF"));
  const catalog = { schemaVersion: 1, policies: structuredClone(content.policies) };
  catalog.policies[0].documentation[0].url = "https://example.test/unofficial";
  assert.ok(validatePolicyCatalog(catalog).some((item) => item.code === "E_SOURCE"));
});

test("audit inspection records a read-only settings review and structured validation evidence", async (t) => {
  const h = await harness(t);
  await h.select(id, "OB-01", "github-history");
  await h.configure(id, "OB-AUDIT", {
    configuration: "already_matches",
    settingsUrl: "https://github.com/enterprises/example/settings/audit-log",
  });
  await h.verify(id, "OB-AUDIT", {
    verified: true,
    evidence: "Reviewed the streaming settings and found no matching agent events.",
    evidenceFields: { auditEvidence: "Used actor:Copilot; no event appeared." },
  });
  const record = h.state().paths[id].exercises["OB-AUDIT"];
  assert.equal(record.verified, true);
  assert.match(record.evidence, /no matching agent events/i);
});
