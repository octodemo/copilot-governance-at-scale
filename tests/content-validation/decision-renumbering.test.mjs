import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { exerciseFingerprint } from "../../lib/workshop-content.mjs";
import { content, harness, legacyState } from "./exercise-helpers.mjs";

const previousIds = {
  "agent-governance": { "AG-01": "AG-01", "AG-02": "AG-04", "AG-03": "AG-14",
    "AG-04": "AG-15", "AG-05": "AG-16", "AG-06": "AG-17" },
  "context-management": { "CM-01": "CM-02", "CM-02": "CM-01" },
  observability: { "OB-01": "OB-03", "OB-02": "OB-06", "OB-03": "OB-05",
    "OB-04": "OB-07", "OB-05": "OB-08", "OB-06": "OB-04" },
};
function beforeRenumbering() {
  const previous = structuredClone(content);
  for (const path of previous.paths) {
    const ids = previousIds[path.id];
    if (!ids) continue;
    for (const decision of path.decisions) decision.id = ids[decision.id] ?? decision.id;
    for (const recipe of path.recipes) {
      recipe.requiresDecisions = recipe.requiresDecisions.map((id) => ids[id] ?? id);
      recipe.requiresAnswers = recipe.requiresAnswers.map((answer) => ({ ...answer, decisionId: ids[answer.decisionId] ?? answer.decisionId }));
      recipe.variantDecisionId = ids[recipe.variantDecisionId] ?? recipe.variantDecisionId;
    }
    for (const validation of path.validations) validation.variantDecisionId = ids[validation.variantDecisionId] ?? validation.variantDecisionId;
    for (const recipe of path.recipes.filter(({ kind }) => kind === "exercise")) {
      recipe.fingerprint = exerciseFingerprint(path, recipe, { schemaVersion: 1, policies: content.policies });
      if (recipe.exerciseId === "AG-LAB") {
        // AG-01 is unchanged; its earlier source differs only in presentation.
        recipe.fingerprint = "sha256:57d94edb78963c90f1e61d4394f4af6831ebc8fe44a4a7ad82561d0a523885fe";
      }
    }
  }
  return previous;
}

test("display-order renumbering preserves every prior answer without remapping current schemas", async (t) => {
  const previous = beforeRenumbering();
  // Try every option, not just one signature-compatible answer on each question.
  const count = Math.max(...previous.paths.flatMap((path) => path.decisions.map((decision) => decision.options.length)));
  for (let optionIndex = 0; optionIndex < count; optionIndex++) {
    const h = await harness(t, previous, `answers-${optionIndex}`);
    const expected = {};
    for (const path of previous.paths.filter(({ id }) => previousIds[id])) {
      expected[path.id] = {};
      for (const decision of path.decisions) {
        const option = decision.options[optionIndex % decision.options.length];
        await h.select(path.id, decision.id, option.id);
        const currentId = Object.entries(previousIds[path.id]).find(([, oldId]) => oldId === decision.id)?.[0] ?? decision.id;
        expected[path.id][currentId] = option.id;
      }
    }
    const original = await h.disk(), store = createStore(h.workspace, content);
    const migrated = await store.read(h.documentId);
    assert.equal(await h.disk(), original, "migration must be read-only until the next successful write");
    for (const [pathId, answers] of Object.entries(expected)) assert.deepEqual(migrated.paths[pathId].decisions, answers);
    assert.deepEqual(migrated.paths["access-management"], h.state().paths["access-management"]);
    assert.ok(!migrated.history.some(({ reason }) => /Inactive decision/.test(reason)));
    const saved = await store.update(h.documentId, { revision: migrated.revision, pathId: "observability",
      decisionId: "OB-02", exerciseId: null, operation: "decide", value: "disabled" });
    assert.deepEqual(await store.read(h.documentId), saved, "a persisted current schema must not be remapped again");
  }
});

test("renumbered choices retain exercise notes and archive stale evidence and Done markers", async (t) => {
  const h = await harness(t, beforeRenumbering());
  for (const [pathId, decisionId, value, exerciseId, settingsUrl] of [
    ["context-management", "CM-01", "shared", "CM-LAB", "https://github.com/example/sample"],
    ["observability", "OB-06", "enabled", "OB-DASHBOARDS", "https://github.com/enterprises/example"],
    ["observability", "OB-07", "api-everywhere", "OB-USAGE-EXPORT", "https://github.com/enterprises/example"],
    ["observability", "OB-03", "github-history", "OB-AUDIT", "https://github.com/enterprises/example/audit-log"],
    ["agent-governance", "AG-01", "pilot", "AG-LAB", "https://github.com/enterprises/example/policies"],
  ]) {
    await h.select(pathId, decisionId, value);
    await h.configure(pathId, exerciseId, { configuration: "already_matches", settingsUrl,
      issues: `Issue for ${exerciseId}`, followUp: `Follow-up for ${exerciseId}` });
    await h.verify(pathId, exerciseId, { verified: true, evidence: `Earlier evidence for ${exerciseId}`,
      ...(exerciseId === "OB-AUDIT" ? { evidenceFields: { auditEvidence: "Observed an audit event" } } : {}) });
    await h.store.update(h.documentId, { revision: h.state().revision, pathId, decisionId: null, exerciseId: null,
      operation: "checklist", value: { stepId: `verify:${exerciseId}`, done: true } });
    await h.refresh();
  }
  const store = createStore(h.workspace, content), migrated = await store.read(h.documentId);
  for (const [pathId, exerciseId] of [["context-management", "CM-LAB"],
    ["agent-governance", "AG-LAB"],
    ...["OB-DASHBOARDS", "OB-USAGE-EXPORT", "OB-AUDIT"].map((id) => ["observability", id])]) {
    const record = migrated.paths[pathId].exercises[exerciseId];
    assert.equal(record.verified, false);
    assert.equal(record.evidence, "");
    assert.equal(record.issues, `Issue for ${exerciseId}`);
    assert.equal(record.followUp, `Follow-up for ${exerciseId}`);
    assert.ok(migrated.history.some(({ data }) => data.exerciseId === exerciseId &&
      data.record?.evidence === `Earlier evidence for ${exerciseId}`));
    assert.ok(migrated.history.some(({ data }) => data.stepId === `verify:${exerciseId}` && data.done));
    assert.ok(!migrated.checklist.some(({ stepId, done }) => stepId === `verify:${exerciseId}` && done));
  }
  assert.equal(migrated.paths["context-management"].decisions["CM-02"], "shared");
  assert.equal(migrated.paths.observability.decisions["OB-02"], "enabled");
  assert.match(await store.markdown(h.documentId), /Earlier evidence for CM\\-LAB/);
});

test("frozen v8 Context answers migrate while unrelated retired Observability answers stay historical", async (t) => {
  const h = await harness(t), previous = legacyState(8, true);
  previous.paths["context-management"].decisions["CM-01"] = "scoped";
  previous.paths["context-management"].decisions["CM-02"] = "combined";
  await h.write(previous);
  const state = await h.refresh();
  assert.equal(state.paths["context-management"].decisions["CM-01"], "combined");
  assert.equal(state.paths["context-management"].decisions["CM-02"], "scoped");
  assert.ok(Object.values(state.paths.observability.decisions).every((answer) => answer === null));
  assert.ok(state.history.some(({ data }) => data.paths?.observability?.decisions["OB-01"] === "adoption"));
});
