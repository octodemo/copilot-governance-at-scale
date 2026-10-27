import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { configurationFor, participationModes, summary } from "../../.github/extensions/governance-lab/ui/model.js";
import { indexPlanningCatalog, resolveConfiguration } from "../../lib/workshop-content.mjs";
import { coverageReport } from "../../scripts/catalog-coverage.mjs";
import { content, frozenDrafts, harness, legacyMatched } from "./exercise-helpers.mjs";

const id = "agent-governance", path = content.paths.find((item) => item.id === id);
const recipe = path.recipes.find((item) => item.exerciseId === "AG-LAB");
test("six Agent decisions preserve compatible identities and the bounded scope exercise", () => {
  const old = frozenDrafts.find((item) => item.id === id);
  assert.deepEqual(path.decisions[0].options.map(({ id }) => id),
    old.decisions[0].options.filter(({ deferred }) => !deferred).map(({ id }) => id));
  assert.deepEqual(path.decisions.map(({ id }) => id), ["AG-01", "AG-02", "AG-03", "AG-04", "AG-05", "AG-06"]);
  assert.deepEqual(path.decisions.map(({ title }) => title), [
    "Agent operating scope", "Code review coverage", "Code review timing",
    "Approval requirements", "Agent execution and tool permissions", "Monitoring and accountability",
  ]);
  assert.ok(path.decisions.every((decision) => decision.options.every((option) => !option.deferred)));
  assert.equal(recipe.id, "ag-lab-exercise");
  assert.equal(recipe.exerciseId, old.lab.id);
  assert.equal(recipe.target, "github-page");
  assert.match(recipe.sections.Safety, /assigned test resources/);
  assert.match(recipe.sections.Safety, /Do not change production access/);
  assert.match(recipe.sections.Safety, /do not raise budgets/);
  assert.doesNotMatch(path.sourceText, /facilitator-approved|Get approval|select Prepared fallback|Choose Complete|Blocked or Not started/i);
  assert.equal(recipe.variants.length, Object.keys(old.lab.configurationByOption).length);
  assert.deepEqual(recipe.variants.map(({ optionId }) => optionId).sort(), ["all", "disabled", "pilot"]);
  assert.match(recipe.sections.Steps, /configured_by_org_admins/);
  for (const choice of ["all", "pilot", "disabled"]) {
    const resolved = resolveConfiguration(path, { "AG-01": choice });
    assert.equal(resolved.exercises[0].recipe.exerciseId, "AG-LAB");
    assert.equal(resolved.exercises[0].variant.optionId, choice);
  }
  assert.ok(participationModes(recipe).fallback);
  assert.match(path.sourceText, /local|client/);
  assert.deepEqual(recipe.policyIds, ["agent.cloud-availability", "agent.repository-safeguards"]);
  assert.match(path.validations[0].sections.Steps, /Restore any enterprise policy or repository selection/);
  assert.match(path.validations[0].sections.Fallback, /fictional/);
  assert.match(path.validations[0].sections["Expected result"], /inconclusive/);
});
test("Agent expansion traces every active Agent catalog row without inventing live exercises", async () => {
  const { planning, diagnostics } = indexPlanningCatalog(await readFile(new URL("../../content/policy-catalog.csv", import.meta.url), "utf8"));
  assert.deepEqual(diagnostics, []);
  const [report] = coverageReport([path], planning);
  assert.equal(report.entries.length, 21);
  assert.deepEqual(report.entries.filter(({ status }) => status !== "configured").map(({ id }) => id),
    ["extensions-plugins.repository-mcp-servers"]);
  assert.deepEqual(path.recipes.filter(({ kind }) => kind === "exercise").map(({ exerciseId }) => exerciseId), ["AG-LAB"]);
  for (const decision of path.decisions.slice(1)) {
    for (const option of decision.options) {
      const resolved = resolveConfiguration(path, { "AG-02": "requested", [decision.id]: option.id });
      assert.equal(resolved.exercises.length, 0, `${decision.id}.${option.id} remains guidance`);
      assert.ok(resolved.recipes.some(({ selectedBy }) => selectedBy.some((selection) =>
        selection.decisionId === decision.id)));
      assert.ok(resolved.recipes.every(({ eligible }) => eligible));
    }
  }
});
test("Agent approval, execution and integration boundaries remain separate", () => {
  const resolveIds = (decisionId, optionId) => resolveConfiguration(path, { [decisionId]: optionId })
    .guidance.map(({ recipe }) => recipe.id);
  assert.deepEqual(resolveIds("AG-04", "human"), ["ag-merge-oversight", "ag-review-approval"]);
  const execution = resolveIds("AG-05", "risk");
  assert.equal(execution.length, 16);
  for (const recipeId of ["ag-client-approvals", "ag-workflow-approval", "ag-cloud-runners", "ag-review-runners",
    "ag-custom-agents", "ag-plugin-standards", "ag-partner-agents", "ag-agent-apps"]) assert.ok(execution.includes(recipeId));
  assert.ok(!execution.includes("ag-review-approval"));
  assert.deepEqual(resolveIds("AG-06", "teams"), ["ag-monitoring-ownership"]);
  const instructions = (id) => {
    const recipe = path.recipes.find((item) => item.id === id);
    return `${recipe.markdown}\n${Object.values(recipe.sections).join("\n")}`;
  };
  assert.match(instructions("ag-code-review"), /Organization Settings -> Copilot -> Code review/);
  assert.match(instructions("ag-code-review"), /Review effort level/);
  assert.match(instructions("ag-review-approval"), /public preview/);
  assert.match(instructions("ag-review-runners"), /ARC.*only supported/);
  assert.match(instructions("ag-firewall"), /does not directly cover MCP server processes/);
  assert.match(instructions("ag-sandbox"), /failIfUnavailable: true/);
  assert.match(instructions("ag-computer-use"), /features.computerUse: false/);
  assert.match(instructions("ag-remote-control"), /githubDotComOrganizations/);
  assert.match(instructions("ag-automations"), /private to their creator/);
  assert.match(instructions("ag-automations"), /not committed to Git/);
  assert.match(instructions("ag-review-timing"), /settings can be combined/);
  assert.match(instructions("ag-review-timing"), /without enabling an automatic rule/);
  assert.match(instructions("ag-merge-oversight"), /any listed code owner/);
  assert.match(instructions("ag-monitoring-ownership"), /Configure evidence sources and reporting in\s+Observability/);
});
test("Agent execution postures retain distinct traced guidance without new exercises", () => {
  for (const choice of ["restricted", "risk", "broader"]) {
    const resolved = resolveConfiguration(path, { "AG-01": "disabled", "AG-05": choice });
    assert.equal(resolved.guidance.length, 16);
    assert.deepEqual(resolved.guidance.slice(0, 2).map(({ recipe }) => recipe.id), ["ag-cloud-tool-review", "ag-client-tool-review"]);
    assert.equal(resolved.exercises.length, 1);
    assert.ok(resolved.guidance.every(({ eligible }) => eligible));
  }
  assert.equal(resolveConfiguration(path, { "AG-01": "all", "AG-05": "restricted" }).exercises.length, 1);
  for (const decision of path.decisions) {
    const ids = new Set(decision.options.flatMap((option) => option.recipeIds)
      .flatMap((id) => path.recipes.find((recipe) => recipe.id === id).catalogIds));
    assert.deepEqual([...decision.catalogIds].sort(), [...ids].sort());
  }
  for (const entry of [...path.decisions, ...path.recipes, ...path.stages.configure.additionalSteps]) {
    assert.ok(entry.catalogSource, `Missing catalog trace for ${entry.id ?? entry.title}`);
  }
  const cloud = path.recipes.find(({ id }) => id === "ag-cloud-tool-review");
  const client = path.recipes.find(({ id }) => id === "ag-client-tool-review");
  assert.match(cloud.sections.Steps, /without saving changes/);
  assert.match(client.sections.Steps, /empty `allowedMcpServers` array still permits built-in/);
  assert.match(client.sections.Steps, /do not govern cloud-agent tool calls/);
});
test("retired thirteen-decision answers and evidence become history, never six-decision answers", async (t) => {
  const earlier = legacyMatched(content);
  const previous = earlier.paths.find((item) => item.id === id);
  const optionIds = {
    "AG-01": ["all", "pilot", "disabled", "delegated", "review"],
    "AG-02": ["approved", "broader", "disabled", "review"],
    "AG-03": ["human", "routine", "review"],
    "AG-04": ["requested", "automatic", "none", "review"],
    "AG-05": ["standard", "specialized", "review"],
    "AG-06": ["shared", "exceptions", "review"],
    "AG-07": ["scoped", "none", "review"],
    "AG-08": ["central", "delegated", "review"],
    "AG-09": ["mandatory", "bounded", "review"],
    "AG-10": ["needed", "blocked", "review"],
    "AG-11": ["sso", "disabled", "unrestricted", "review"],
    "AG-12": ["vetted", "none", "review"],
    "AG-13": ["scheduled", "events", "manual", "review"],
  };
  // Reconstruct the prior saved schema; retired choices must not be mapped by label or position.
  previous.decisions = Object.entries(optionIds).map(([decisionId, ids]) => ({
    ...structuredClone(path.decisions[0]), id: decisionId,
    options: ids.map((optionId) => ({
      ...structuredClone(path.decisions[0].options[0]), id: optionId,
      recipeIds: decisionId === "AG-01" && optionId !== "review" ? ["ag-lab-exercise"] : [],
      deferred: optionId === "review",
    })),
  }));
  for (const scope of ["pilot", "delegated"]) {
    const h = await harness(t, earlier, `prior-${scope}`);
    await h.select(id, "AG-01", scope);
    for (const [decisionId, ids] of Object.entries(optionIds)) {
      if (decisionId !== "AG-01") await h.select(id, decisionId, decisionId === "AG-04" ? "automatic" : ids[0]);
    }
    if (scope === "pilot") {
      await h.configure(id, "AG-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/enterprises/example/policies" });
      await h.verify(id, "AG-LAB", { verified: true, evidence: "Earlier thirteen-decision observation" });
    }
    const before = await h.disk(), store = createStore(h.workspace, content), current = await store.read(h.documentId);
    assert.equal(await h.disk(), before, "reconciliation does not silently overwrite disk");
    assert.equal(current.paths[id].decisions["AG-01"], scope === "pilot" ? "pilot" : null);
    for (const decision of path.decisions.slice(1)) assert.equal(current.paths[id].decisions[decision.id], null);
    for (const decisionId of Object.keys(optionIds).filter((item) => item !== "AG-01")) {
      if (!path.decisions.some(({ id }) => id === decisionId)) assert.ok(!Object.hasOwn(current.paths[id].decisions, decisionId));
      const earlierValue = decisionId === "AG-04" ? "automatic" : optionIds[decisionId][0];
      assert.ok(current.history.some(({ data }) => data.decisionId === decisionId && data.value === earlierValue));
    }
    assert.equal(current.paths[id].exercises["AG-LAB"].verified, false);
    if (scope === "pilot") assert.ok(current.history.some(({ data }) => data.record?.evidence === "Earlier thirteen-decision observation"));
    const saved = await store.update(h.documentId, {
      revision: current.revision, pathId: id, decisionId: "AG-05", exerciseId: null, operation: "decide", value: "restricted",
    });
    assert.deepEqual((await createStore(h.workspace, content).read(h.documentId)).history, saved.history);
  }
});
test("earlier Agent evidence and Done markers become history after the content alignment", async (t) => {
  const earlier = legacyMatched(content);
  const h = await harness(t, earlier);
  await h.select(id, "AG-01", "pilot");
  await h.configure(id, "AG-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/enterprises/example/policies" });
  await h.verify(id, "AG-LAB", { verified: true, evidence: "Earlier scope observation", issues: "Retain this limitation" });
  await h.store.update(h.documentId, {
    revision: h.state().revision, pathId: id, decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId: "recipe:ag-lab-exercise", done: true },
  });
  const disk = await h.disk();
  const store = createStore(h.workspace, content), current = await store.read(h.documentId);
  assert.equal(current.paths[id].decisions["AG-01"], "pilot");
  assert.equal(current.paths[id].exercises["AG-LAB"].verified, false);
  assert.equal(current.paths[id].exercises["AG-LAB"].issues, "Retain this limitation");
  assert.ok(current.history.some((entry) => entry.data?.record?.evidence === "Earlier scope observation"));
  assert.equal(current.checklist.some((entry) => entry.stepId === "recipe:ag-lab-exercise" && entry.done), false);
  assert.ok(current.history.some((entry) => entry.data?.stepId === "recipe:ag-lab-exercise" && entry.data.done));
  assert.equal(await h.disk(), disk, "reading content reconciliation must not overwrite saved data");
});
test("all enabled and intentionally disabled Agent variants persist independent verification and leave other blocks unchanged", async (t) => {
  const h = await harness(t), before = structuredClone(h.state().paths);
  for (const choice of ["all", "pilot", "disabled"]) {
    await h.select(id, "AG-01", choice); await h.select(id, "AG-05", "restricted");
    assert.equal(configurationFor(path, h.state().paths[id]).exercises[0].variant.optionId, choice);
    await h.configure(id, "AG-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/enterprises/example/policies" });
    assert.equal(h.state().paths[id].exercises["AG-LAB"].verified, false);
    await h.verify(id, "AG-LAB", { verified: true, evidence: `Observed ${choice} outcome` });
    assert.equal(summary(content, h.state()).find((item) => item.id === id).exercises[0].verified, true);
  }
  for (const [other, progress] of Object.entries(before)) if (other !== id) assert.deepEqual(h.state().paths[other], progress);
});
test("new guidance decisions preserve current AG-LAB evidence and export without claiming configuration", async (t) => {
  const h = await harness(t);
  await h.select(id, "AG-01", "pilot");
  await h.configure(id, "AG-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/enterprises/example/policies" });
  await h.verify(id, "AG-LAB", { verified: true, evidence: "Current bounded scope observation" });
  for (const decision of path.decisions.slice(1)) {
    await h.select(id, decision.id, decision.options.find((option) => !option.deferred).id);
  }
  assert.equal(h.state().paths[id].exercises["AG-LAB"].verified, true);
  assert.deepEqual(Object.keys(h.state().paths[id].exercises), ["AG-LAB"]);
  const markdown = await h.store.markdown(h.documentId);
  assert.match(markdown, /Approval requirements/);
  assert.match(markdown, /Monitoring and accountability/);
  assert.match(markdown, /Informational only; not configured or verified/);
  const exported = JSON.stringify(await h.store.export(h.documentId));
  assert.match(exported, /"AG-06":"periodic"/);
});
test("Agent unanswered, proposal and prepared fallback cannot claim live completion; switching to fallback clears evidence", async (t) => {
  const h = await harness(t);
  await assert.rejects(h.configure(id, "AG-LAB", { configuration: "already_matches" }), /inactive/);
  await h.select(id, "AG-01", "pilot");
  await assert.rejects(h.configure(id, "AG-LAB", { mode: "proposal", configuration: "already_matches" }), /prerequisites/);
  await h.configure(id, "AG-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/enterprises/example/policies" });
  await h.verify(id, "AG-LAB", { verified: true, evidence: "Live approved observation" });
  await h.configure(id, "AG-LAB", { mode: "fallback", configuration: "blocked", issues: "Live access unavailable" });
  const record = h.state().paths[id].exercises["AG-LAB"];
  assert.equal(record.verified, false); assert.equal(record.evidence, "");
  await assert.rejects(h.verify(id, "AG-LAB", { verified: true, evidence: "Prepared evidence only" }), /Complete/);
  assert.match(await h.store.markdown(h.documentId), /prepared fallback only/);
});
