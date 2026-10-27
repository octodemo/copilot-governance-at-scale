import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { parseWorkshopMarkdown, exerciseFingerprint } from "../../lib/workshop-content.mjs";
import { configurationFor, summary } from "../../.github/extensions/governance-lab/ui/model.js";
import { harness, content, accessV1Content, legacyMatched, legacyState } from "./exercise-helpers.mjs";

const synthetic = await loadContent({ root: fileURLToPath(new URL("./fixtures/content-format/valid/", import.meta.url)) });
const blockId = "example-block";
test("runtime loader rejects the same malformed sources as the independent CLI contract", async () => {
  await assert.rejects(loadContent({ root: fileURLToPath(new URL("./fixtures/content-format/invalid/", import.meta.url)) }),
    (error) => /E_FIELD/.test(error.message) && /E_RECIPE_REF/.test(error.message) && /E_VALIDATION_MISSING/.test(error.message));
});
test("two exercises retain independent configuration/evidence and shared guidance is deduplicated", async (t) => {
  const h = await harness(t, synthetic);
  await h.select(blockId, "EX-01", "mixed");
  await h.select(blockId, "EX-02", "ready");
  assert.equal(configurationFor(synthetic.paths[0], h.state().paths[blockId]).guidance.length, 1);
  await h.configure(blockId, "EX-FIRST", { configuration: "already_matches", settingsUrl: "https://github.com/example/sample", fields: { observation: "Prepared observation" } });
  await h.verify(blockId, "EX-FIRST", { verified: true, evidence: "First evidence" });
  await h.configure(blockId, "EX-SECOND", { configuration: "already_matches", fields: { interpretation: "Fictional interpretation" } });
  await h.verify(blockId, "EX-SECOND", { verified: true, evidence: "Second evidence", followUp: "Review sample" });
  assert.equal(summary(synthetic, h.state())[0].exercises.filter((entry) => entry.verified).length, 2);
  const first = structuredClone(h.state().paths[blockId].exercises["EX-FIRST"]);
  await h.configure(blockId, "EX-SECOND", { configuration: "blocked" });
  assert.deepEqual(h.state().paths[blockId].exercises["EX-FIRST"], first);
  assert.equal(h.state().paths[blockId].exercises["EX-SECOND"].verified, false);
  assert.ok(h.state().history.some((item) => item.reason.includes("Configuration changed")));
  const reloaded = await createStore(h.workspace, synthetic).read(h.documentId);
  assert.deepEqual(reloaded, h.state());
  const exported = await h.store.export(h.documentId);
  assert.equal(exported.version, 11);
  assert.equal(exported.summary[0].exercises.length, 2);
  assert.match(await h.store.markdown(h.documentId), /EX\\-FIRST/);
  assert.match(await h.store.markdown(h.documentId), /EX\\-SECOND/);
});

test("unrelated decisions preserve evidence; relevant changes archive only affected exercises", async (t) => {
  const h = await harness(t, synthetic);
  await h.select(blockId, "EX-01", "mixed"); await h.select(blockId, "EX-02", "ready");
  await h.configure(blockId, "EX-SECOND", { configuration: "already_matches", fields: { interpretation: "Example" } });
  await h.verify(blockId, "EX-SECOND", { verified: true, evidence: "Sample evidence", followUp: "Next action" });
  const second = structuredClone(h.state().paths[blockId].exercises["EX-SECOND"]);
  await h.select(blockId, "EX-02", "review");
  assert.deepEqual(h.state().paths[blockId].exercises["EX-SECOND"], second);
  await h.select(blockId, "EX-01", "notes");
  assert.equal(summary(synthetic, h.state())[0].exercises.length, 0);
  assert.equal(summary(synthetic, h.state())[0].guidance.length, 1);
  assert.ok(h.state().history.length);
  await assert.rejects(h.configure(blockId, "EX-SECOND"), /inactive/);
  await h.select(blockId, "EX-01", "no-action");
  assert.equal(summary(synthetic, h.state())[0].guidance.length, 0);
  assert.match(await h.store.markdown(h.documentId), /No applicable exercises/);
  await h.select(blockId, "EX-01", "review");
  assert.equal(summary(synthetic, h.state())[0].decisions[0].deferred, true);
});

test("inactive summaries omit untouched defaults but retain note-only records and archived exercise work", async (t) => {
  const h = await harness(t, synthetic);
  assert.deepEqual(summary(synthetic, h.state())[0].inactiveExerciseIds, []);
  assert.doesNotMatch(await h.store.markdown(h.documentId), /Inactive exercises/);
  await h.select(blockId, "EX-01", "mixed");
  await h.select(blockId, "EX-02", "ready");
  await h.configure(blockId, "EX-FIRST", { issues: "Retained note without configuration" });
  await h.configure(blockId, "EX-SECOND", { configuration: "already_matches", fields: { interpretation: "Fictional interpretation to retain" } });
  await h.select(blockId, "EX-01", "no-action");
  const progress = h.state().paths[blockId];
  assert.equal(progress.exercises["EX-FIRST"].issues, "Retained note without configuration");
  assert.equal(progress.exercises["EX-SECOND"].configuration, "not_started");
  assert.equal(progress.exercises["EX-SECOND"].fields.interpretation, "");
  assert.deepEqual(summary(synthetic, h.state())[0].inactiveExerciseIds, ["EX-FIRST", "EX-SECOND"]);
  assert.deepEqual((await h.store.export(h.documentId)).summary[0].inactiveExerciseIds, ["EX-FIRST", "EX-SECOND"]);
  assert.match(await h.store.markdown(h.documentId), /Inactive exercises \(not counted\): EX\\-FIRST, EX\\-SECOND/);
});

test("strict request identity, prerequisites, form values, fallback and stale saves are enforced", async (t) => {
  const h = await harness(t, synthetic);
  await h.select(blockId, "EX-01", "inspect");
  await assert.rejects(h.configure(blockId, "EX-FIRST", { configuration: "already_matches", settingsUrl: "https://github.com/example/sample", fields: { observation: "Example" } }), /prerequisites/);
  await h.select(blockId, "EX-02", "ready");
  await assert.rejects(h.configure(blockId, "EX-FIRST", { fields: { unexpected: "bad" } }), /authored form/);
  await assert.rejects(h.configure(blockId, "EX-FIRST", { configuration: "already_matches", mode: "proposal" }), /prerequisites/);
  await assert.rejects(h.verify(blockId, "EX-FIRST", { verified: true, evidence: "Not configured" }), /Complete/);
  const input = { revision: h.state().revision, pathId: blockId, decisionId: "EX-02", exerciseId: null, operation: "decide", value: "ready" };
  const { exerciseId, ...missing } = input;
  await assert.rejects(h.store.update(h.documentId, missing), /explicit/);
  await assert.rejects(h.store.update(h.documentId, { ...input, exerciseId: "EX-FIRST" }), /explicit exercise/);
  const pair = await Promise.allSettled([h.store.update(h.documentId, input), h.store.update(h.documentId, input)]);
  assert.equal(pair.filter((item) => item.status === "fulfilled").length, 1);
  assert.match(pair.find((item) => item.status === "rejected").reason.message, /another panel/);
});

test("variant-only fallback saves and reloads while other selected variants reject it", async (t) => {
  const source = structuredClone(synthetic), catalog = { policies: source.policies };
  const path = source.paths.find((item) => item.id === blockId);
  const variants = path.decisions.find((item) => item.id === "EX-01").options.filter((option) => !option.deferred)
    .map((option) => `#### Variant: ${option.id}

##### Steps

Compare this fictional example.

##### Expected result

Only the limited example is checked.
${option.id === "inspect" ? `

##### Fallback

Read the prepared fictional observation instead.` : ""}`).join("\n\n");
  const parsed = parseWorkshopMarkdown(path.sourceText.replace(
    /### Exercise: EX-FIRST[\s\S]*?(?=### Exercise: EX-SECOND)/,
    `### Exercise: EX-FIRST\n**Variant decision:** EX-01\n\n${variants}\n\n`,
  ), { catalog });
  assert.deepEqual(parsed.diagnostics, []);
  source.paths[source.paths.indexOf(path)] = parsed.block;
  for (const recipe of parsed.block.recipes.filter((item) => item.kind === "exercise")) {
    recipe.fingerprint = exerciseFingerprint(parsed.block, recipe, catalog);
  }
  const h = await harness(t, source);
  await h.select(blockId, "EX-01", "inspect");
  await h.select(blockId, "EX-02", "ready");
  await h.configure(blockId, "EX-FIRST", { mode: "fallback", configuration: "blocked", issues: "Read prepared evidence only" });
  assert.equal(h.state().schema[blockId].exercises["EX-FIRST"].fallback, true);
  assert.equal(h.state().paths[blockId].exercises["EX-FIRST"].mode, "fallback");
  assert.equal(h.state().paths[blockId].exercises["EX-FIRST"].verified, false);
  assert.deepEqual(JSON.parse(await h.disk()), h.state());
  assert.deepEqual(await createStore(h.workspace, source).read(h.documentId), h.state());
  await assert.rejects(h.verify(blockId, "EX-FIRST", { verified: true, evidence: "Prepared, not live evidence" }), /Complete/);

  await h.select(blockId, "EX-01", "mixed");
  const before = await h.disk();
  await assert.rejects(h.configure(blockId, "EX-FIRST", { mode: "fallback" }), /participation mode/);
  assert.equal(await h.disk(), before, "a different variant's fallback must not authorize this save");
  assert.equal(h.state().paths[blockId].exercises["EX-FIRST"].mode, "sandbox");
});

test("source edits invalidate matching exercise only; Understand edits preserve completion", async (t) => {
  const h = await harness(t, synthetic);
  await h.select(blockId, "EX-01", "mixed"); await h.select(blockId, "EX-02", "ready");
  await h.configure(blockId, "EX-FIRST", { configuration: "already_matches", settingsUrl: "https://github.com/example/sample", fields: { observation: "Example" } });
  await h.verify(blockId, "EX-FIRST", { verified: true, evidence: "Evidence" });
  const changed = structuredClone(synthetic), catalog = { policies: synthetic.policies };
  changed.paths[0] = parseWorkshopMarkdown(synthetic.paths[0].sourceText.replace("Read this fictional example.", "Understand changed."), { catalog }).block;
  for (const recipe of changed.paths[0].recipes.filter((item) => item.kind === "exercise")) recipe.fingerprint = exerciseFingerprint(changed.paths[0], recipe, catalog);
  assert.equal((await createStore(h.workspace, changed).read(h.documentId)).paths[blockId].exercises["EX-FIRST"].verified, true);
  changed.paths[0].validations[0].sections["Expected result"] = "An intentionally different check.";
  const recipe = changed.paths[0].recipes.find((item) => item.exerciseId === "EX-FIRST");
  recipe.fingerprint = exerciseFingerprint(changed.paths[0], recipe, catalog);
  const stale = await createStore(h.workspace, changed).read(h.documentId);
  assert.equal(stale.paths[blockId].exercises["EX-FIRST"].verified, false);
  assert.ok(stale.history.some((item) => item.reason.includes("source changed")));
  assert.equal(JSON.parse(await h.disk()).paths[blockId].exercises["EX-FIRST"].verified, true, "reading migration must not write");
});

test("version-11 inspection records survive removal of the retired kind field", async (t) => {
  const h = await harness(t);
  const path = content.paths.find((item) => item.id === "access-management");
  const recipe = path.recipes.find((item) => item.exerciseId === "AM-LAB");
  const validation = path.validations.find((item) => item.exerciseId === "AM-LAB");
  const option = path.decisions.find((item) => item.id === "AM-02").options.find((item) => !item.deferred);
  await h.select(path.id, "AM-02", option.id);
  const values = (fields) => Object.fromEntries(fields.map((field) => [field.id, field.required ? "Observed in the sandbox" : ""]));
  await h.configure(path.id, recipe.exerciseId, {
    configuration: "already_matches", settingsUrl: "https://github.com/organizations/example/settings/copilot",
    fields: values(recipe.fields),
  });
  await h.verify(path.id, recipe.exerciseId, {
    verified: true, evidence: "Observed in the sandbox", evidenceFields: values(validation.fields),
  });

  const formerState = structuredClone(h.state());
  for (const pathSchema of Object.values(formerState.schema)) {
    for (const definition of Object.values(pathSchema.exercises)) definition.kind = "inspection";
  }
  await h.write(formerState);
  await h.refresh();
  assert.equal(h.state().paths[path.id].exercises[recipe.exerciseId].verified, true);
  assert.equal(h.state().paths[path.id].exercises[recipe.exerciseId].evidence, "Observed in the sandbox");
  assert.ok(Object.values(h.state().schema).every((pathSchema) =>
    Object.values(pathSchema.exercises).every((definition) => !Object.hasOwn(definition, "kind"))));

  await h.configure(path.id, recipe.exerciseId, { issues: "Retained after schema migration" });
  const saved = JSON.parse(await h.disk());
  assert.ok(Object.values(saved.schema).every((pathSchema) =>
    Object.values(pathSchema.exercises).every((definition) => !Object.hasOwn(definition, "kind"))));
  assert.equal(saved.paths[path.id].exercises[recipe.exerciseId].verified, true);
  assert.deepEqual(saved.history, []);
});

function preSplitContent() {
  const merged = structuredClone(accessV1Content), moved = merged.paths.find((path) => path.id === "access-management");
  const user = merged.paths.find((path) => path.id === "user-governance");
  user.decisions.unshift(...moved.decisions); user.recipes.push(...moved.recipes); user.validations.push(...moved.validations);
  merged.paths = merged.paths.filter((path) => path !== moved);
  return merged;
}
async function preSplitProgress(t) {
  const h = await harness(t, preSplitContent());
  await h.select("user-governance", "AM-01", "pilot");
  await h.select("user-governance", "AM-02", "central");
  await h.configure("user-governance", "AM-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/orgs/example/settings/copilot" });
  await h.verify("user-governance", "AM-LAB", { verified: true, evidence: "Observed assignment", issues: "Kept note" });
  return h;
}

test("v9 progress for decisions and exercises moved to another block relocates without losing evidence", async (t) => {
  const h = await preSplitProgress(t);
  const state = await createStore(h.workspace, accessV1Content).read(h.documentId);
  assert.equal(state.paths["access-management"].decisions["AM-01"], "pilot");
  assert.equal(state.paths["access-management"].decisions["AM-02"], "central");
  for (const id of ["AM-01", "AM-02"]) assert.equal(Object.hasOwn(state.paths["user-governance"].decisions, id), false);
  assert.equal(state.paths["access-management"].exercises["AM-LAB"].verified, true);
  assert.equal(state.paths["access-management"].exercises["AM-LAB"].evidence, "Observed assignment");
  assert.ok(!state.history.some((item) => /Inactive/.test(item.reason)));
  assert.deepEqual(summary(accessV1Content, state).find((path) => path.id === "user-governance").inactiveExerciseIds, []);
  assert.equal(JSON.parse(await h.disk()).paths["user-governance"].exercises["AM-LAB"].verified, true, "reading must not write");
});

test("moved exercises with changed sources archive evidence under their new block", async (t) => {
  const h = await preSplitProgress(t);
  const changed = structuredClone(accessV1Content);
  changed.paths.find((path) => path.id === "access-management").recipes.find((item) => item.exerciseId === "AM-LAB").fingerprint = `sha256:${"0".repeat(64)}`;
  const state = await createStore(h.workspace, changed).read(h.documentId);
  const record = state.paths["access-management"].exercises["AM-LAB"];
  assert.equal(record.verified, false);
  assert.equal(record.issues, "Kept note");
  const archived = state.history.find((item) => item.reason.includes("source changed"));
  assert.deepEqual([archived.data.pathId, archived.data.fromPathId, archived.data.record.evidence], ["access-management", "user-governance", "Observed assignment"]);
});

for (const version of [2, 3, 4, 5, 6, 7, 8]) test(`known main v${version} migrates read-only, preserves evidence, and writes v11 only on save`, async (t) => {
  const h = await harness(t, legacyMatched());
  const previous = legacyState(version, true);
  await h.write(previous);
  const before = await h.disk();
  const current = await h.refresh();
  assert.equal(current.version, 11); assert.equal(current.revision, 7);
  assert.equal(await h.disk(), before);
  assert.equal(current.paths["access-management"].exercises["AM-LAB"].verified, true);
  assert.ok(current.history.length);
  await h.select("access-management", "AM-03", "idp");
  assert.equal(JSON.parse(await h.disk()).version, 11);
  assert.equal(h.state().paths["access-management"].exercises["AM-LAB"].verified, true, "unrelated decision does not invalidate access evidence");
});

test("legacy unresolved prerequisites remain historical without manufacturing completion", async (t) => {
  const matched = legacyMatched();
  matched.paths.find((path) => path.id === "access-management").recipes.find((item) => item.exerciseId === "AM-LAB").requiresDecisions.push("AM-03");
  const h = await harness(t, matched);
  const old = legacyState(8, true);
  old.paths["user-governance"].decisions["UG-04"] = "review";
  await h.write(old);
  const state = await h.refresh();
  assert.equal(state.paths["access-management"].exercises["AM-LAB"].verified, false);
  assert.equal(state.history[0].data.paths["user-governance"].lab.verified, true);
});

for (const version of [3, 4, 5, 6]) test(`original divergent v${version} preserves active work and archives superseded or retired work`, async (t) => {
  const h = await harness(t, legacyMatched()), baseline = legacyState(8, true);
  const user = baseline.paths["user-governance"];
  user.decisions = { "UG-01": "pilot", "UG-02": "central", "UG-03": "monitor" };
  baseline.paths["billing-cost-control"].decisions = { "BC-01": "central", "BC-02": "monitor", "BC-03": "organization" };
  const original = { version, revision: 4, paths: Object.fromEntries(Object.entries(baseline.paths).slice(0, version - 1)), legacyProgress: null };
  await h.write(original); const before = await h.disk();
  const state = await h.refresh();
  assert.equal(await h.disk(), before);
  assert.equal(state.paths["access-management"].exercises["AM-LAB"].verified, true);
  assert.equal(state.paths["billing-cost-control"].exercises["BC-LAB"], undefined);
  assert.ok(Object.values(state.paths["billing-cost-control"].decisions).every((value) => value === null));
  assert.equal(state.history[0].data.archivedBillingProgress.lab.verified, true);
  assert.equal(state.history[0].data.archivedDecisions["UG-03"], "monitor");
  for (const [id, exerciseId, minimum] of [["agent-governance", "AG-LAB", 4], ["context-management", "CM-LAB", 5]]) {
    assert.equal(state.paths[id].exercises[exerciseId].verified, version >= minimum);
  }
  assert.equal(state.paths.observability.exercises["OB-LAB"], undefined);
  assert.equal(Boolean(state.history[0].data.paths.observability?.lab?.verified), version >= 6);
  const hybrid = structuredClone(original);
  hybrid.archivedDecisions = {};
  await h.write(hybrid);
  await assert.rejects(h.refresh(), /Preserve the file/);
});

test("v1 foundation participation is preserved without becoming policy decisions or new completion", async (t) => {
  const h = await harness(t);
  const original = { version: 1, revision: 2, paths: Object.fromEntries(["user-governance", "agent-governance", "context-management", "observability"].map((id) =>
    [id, { understood: true, decision: "sandbox", configuration: "changed", verified: true, evidence: "Earlier foundation exercise" }])) };
  await h.write(original);
  const state = await h.refresh();
  assert.equal(state.history[0].data.legacyProgress.version, 1);
  for (const progress of Object.values(state.paths)) {
    assert.ok(Object.values(progress.decisions).every((value) => value === null));
    assert.ok(Object.values(progress.exercises).every((record) => !record.verified && record.configuration === "not_started"));
  }
});

test("legacy completion requires the immutable mechanically migrated semantics, not just the exercise ID", async (t) => {
  const h = await harness(t);
  await h.write(legacyState(8, true));
  const changed = legacyMatched(), path = changed.paths.find((item) => item.id === "access-management"), recipe = path.recipes.find((item) => item.exerciseId === "AM-LAB");
  path.validations.find((item) => item.exerciseId === "AM-LAB").sections["Expected result"] = "A substantively different verification outcome.";
  recipe.fingerprint = exerciseFingerprint(path, recipe, { policies: changed.policies });
  const result = await createStore(h.workspace, changed).read(h.documentId);
  assert.equal(result.paths["access-management"].exercises["AM-LAB"].verified, false);
  assert.equal(result.paths["access-management"].exercises["AM-LAB"].configuration, "not_started");
  assert.equal(result.history[0].data.paths["user-governance"].lab.verified, true);
  assert.equal(result.paths["agent-governance"].exercises["AG-LAB"].verified, true);
  assert.equal(JSON.parse(await h.disk()).version, 8);
});

test("unknown versions, corrupt JSON, snapshot corruption and control-only evidence never overwrite files", async (t) => {
  const h = await harness(t, legacyMatched());
  for (const bad of ["{broken", { version: 100 }, { ...legacyState(8), paths: {} }]) {
    await h.write(bad); const before = await h.disk();
    await assert.rejects(h.refresh(), /Preserve the file/); assert.equal(await h.disk(), before);
  }
  await h.write(legacyState(8, true)); await h.refresh();
  await assert.rejects(h.verify("access-management", "AM-LAB", { verified: true, evidence: "\u0000" }), /removing control/);
  const state = await h.refresh();
  state.schema["access-management"].exercises["AM-LAB"].fingerprint = "not-a-fingerprint";
  await h.write(state); const before = await h.disk();
  await assert.rejects(h.refresh(), /Preserve the file/); assert.equal(await h.disk(), before);
});

function preRenumberContent(combined) {
  const previous = structuredClone(accessV1Content);
  const accessIds = { "AM-01": "UG-01", "AM-02": "UG-02", "AM-03": "UG-04", "AM-04": "UG-05", "AM-LAB": "UG-LAB",
    "am-02": "ug-02", "am-03": "ug-04", "am-04": "ug-05", "am-lab": "ug-lab" };
  const userIds = { "UG-01": "UG-06", "UG-02": "UG-07", "UG-03": "UG-08", "UG-04": "UG-09", "UG-05": "UG-10",
    "ug-01": "ug-06", "ug-02": "ug-07", "ug-03": "ug-08", "ug-04": "ug-09", "ug-05": "ug-10" };
  for (const path of previous.paths) {
    const replacements = path.id === "access-management" ? accessIds : path.id === "user-governance" ? userIds : {};
    const pattern = new RegExp(Object.keys(replacements).join("|") || "(?!)", "g");
    Object.assign(path, JSON.parse(JSON.stringify(path).replace(pattern, (id) => replacements[id])));
    if (path.id === "access-management") path.recipes.find((recipe) => recipe.kind === "exercise").fingerprint = `sha256:${"1".repeat(64)}`;
  }
  if (combined) {
    const access = previous.paths.find((path) => path.id === "access-management");
    const user = previous.paths.find((path) => path.id === "user-governance");
    user.decisions.unshift(...access.decisions); user.recipes.push(...access.recipes); user.validations.push(...access.validations);
    previous.paths = previous.paths.filter((path) => path !== access);
  }
  return previous;
}

for (const combined of [false, true]) test(`renumbered v9 ${combined ? "combined" : "split"} blocks preserve choices without reusing evidence or confusing UG IDs`, async (t) => {
  const h = await harness(t, preRenumberContent(combined));
  const access = combined ? "user-governance" : "access-management";
  for (const [id, option] of [["UG-01", "pilot"], ["UG-02", "central"], ["UG-04", "idp"], ["UG-05", "gated"]]) await h.select(access, id, option);
  for (const [id, option] of [["UG-06", "organizations"], ["UG-07", "vetted"], ["UG-08", "vetted"], ["UG-09", "stable"]]) await h.select("user-governance", id, option);
  await h.configure(access, "UG-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/orgs/example/settings/copilot", issues: "Keep this note" });
  await h.verify(access, "UG-LAB", { verified: true, evidence: "Historical evidence" });
  const before = await h.disk(), store = createStore(h.workspace, accessV1Content);
  const migrated = await store.read(h.documentId);
  assert.deepEqual(migrated.paths["access-management"].decisions, { "AM-01": "pilot", "AM-02": "central", "AM-03": "idp", "AM-04": "gated" });
  assert.deepEqual(migrated.paths["user-governance"].decisions, { "UG-01": "organizations", "UG-02": "vetted", "UG-03": "vetted", "UG-04": "stable", "UG-05": null });
  assert.equal(migrated.paths["access-management"].exercises["AM-LAB"].verified, false);
  assert.equal(migrated.paths["access-management"].exercises["AM-LAB"].issues, "Keep this note");
  assert.ok(migrated.history.some((item) => item.data.exerciseId === "UG-LAB" && item.data.record?.evidence === "Historical evidence"));
  assert.equal(await h.disk(), before, "migration reads must not write");
  const saved = await store.update(h.documentId, { revision: migrated.revision, pathId: "access-management", decisionId: "AM-03", exerciseId: null, operation: "decide", value: "custom" });
  assert.deepEqual(await store.read(h.documentId), saved, "saved renumbered records must not be remapped again");
});

const retiredFourQuestionOptions = {
  "AM-01": ["pilot", "organization", "enterprise-teams", "enterprise-users", "mixed", "review"],
  "AM-02": ["central", "delegate", "review"],
  "AM-03": ["custom", "idp", "review"],
  "AM-04": ["self-service", "gated", "review"],
};
function replaceDecisionSnapshot(state, pathId, definitions, values) {
  state.schema[pathId].decisions = Object.fromEntries(Object.entries(definitions).map(([id, options]) => [id, [...options]]));
  state.paths[pathId].decisions = Object.fromEntries(Object.keys(definitions).map((id) => [id, values[id] ?? null]));
  return state;
}

test("superseded four-question Access answers with shared option IDs are retained in history", async (t) => {
  const h = await harness(t);
  const saved = replaceDecisionSnapshot(structuredClone(h.state()), "access-management", retiredFourQuestionOptions,
    { "AM-01": "review", "AM-02": "review", "AM-03": "idp", "AM-04": "review" });
  await h.write(saved);
  const migrated = await h.refresh();
  assert.deepEqual(migrated.paths["access-management"].decisions,
    Object.fromEntries(content.paths.find((path) => path.id === "access-management").decisions.map(({ id }) => [id, null])));
  const archived = migrated.history.filter((item) => item.reason.startsWith("Superseded decision"));
  assert.deepEqual(archived.map(({ data }) => [data.pathId, data.decisionId, data.value]),
    Object.entries(saved.paths["access-management"].decisions).map(([id, value]) => ["access-management", id, value]));
});

test("earlier UG access IDs are archived instead of being renamed into replacement questions", async (t) => {
  const h = await harness(t);
  const definitions = {
    "UG-01": retiredFourQuestionOptions["AM-01"],
    "UG-02": retiredFourQuestionOptions["AM-02"],
    "UG-04": retiredFourQuestionOptions["AM-03"],
    "UG-05": retiredFourQuestionOptions["AM-04"],
  };
  const values = { "UG-01": "review", "UG-02": "review", "UG-04": "idp", "UG-05": "review" };
  const saved = replaceDecisionSnapshot(structuredClone(h.state()), "user-governance", definitions, values);
  await h.write(saved);
  const migrated = await h.refresh();
  assert.ok(Object.values(migrated.paths["access-management"].decisions).every((value) => value === null));
  assert.ok(Object.values(migrated.paths["user-governance"].decisions).every((value) => value === null));
  assert.deepEqual(migrated.history.filter((item) => item.reason.startsWith("Superseded decision"))
    .map(({ data }) => [data.pathId, data.decisionId, data.value]),
  Object.entries(values).map(([id, value]) => ["user-governance", id, value]));
});

test("seven-question migration archives retired AM-04 before shifting AM-05 regardless of key order", async (t) => {
  const sevenQuestionOptions = {
    "AM-01": content.paths.find((path) => path.id === "access-management").decisions.find((item) => item.id === "AM-01").options.map((item) => item.id),
    "AM-02": content.paths.find((path) => path.id === "access-management").decisions.find((item) => item.id === "AM-02").options.map((item) => item.id),
    "AM-03": content.paths.find((path) => path.id === "access-management").decisions.find((item) => item.id === "AM-03").options.map((item) => item.id),
    "AM-04": ["yes", "no", "review"],
    "AM-05": ["approval", "automatic", "admin-only", "review"],
    "AM-06": ["block", "allow", "review"],
    "AM-07": ["automated", "manual", "keep", "review"],
  };
  const cases = [
    { order: ["AM-04", "AM-05"], values: { "AM-04": "review", "AM-05": "approval" } },
    { order: ["AM-05", "AM-04"], values: { "AM-04": "review", "AM-05": "approval" } },
    { order: ["AM-05", "AM-04"], values: { "AM-04": "review", "AM-05": null } },
  ];
  for (const [index, scenario] of cases.entries()) {
    const h = await harness(t, content, `seven-question-${index}`);
    const order = [...scenario.order, ...Object.keys(sevenQuestionOptions).filter((id) => !scenario.order.includes(id))];
    const definitions = Object.fromEntries(order.map((id) => [id, sevenQuestionOptions[id]]));
    const saved = replaceDecisionSnapshot(structuredClone(h.state()), "access-management", definitions, {
      ...scenario.values, "AM-06": "block", "AM-07": "automated",
    });
    await h.write(saved);
    const migrated = await h.refresh();
    assert.equal(migrated.paths["access-management"].decisions["AM-04"], scenario.values["AM-05"] ?? null);
    assert.equal(migrated.paths["access-management"].decisions["AM-05"], "block");
    assert.equal(migrated.paths["access-management"].decisions["AM-06"], "automated");
    assert.ok(migrated.history.some((item) => item.reason.startsWith("Superseded decision") &&
      item.data.pathId === "access-management" && item.data.decisionId === "AM-04" && item.data.value === "review"));
  }
});
