import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { configurationChecklist, summary, totalConfigurationSteps, verificationChecklist } from "../../.github/extensions/governance-lab/ui/model.js";
import { harness } from "./exercise-helpers.mjs";

const content = await loadContent({ root: fileURLToPath(new URL("./fixtures/content-format/valid/", import.meta.url)) });
const pathId = "example-block";
async function mark(h, stepId, done = true, revision = h.state().revision) {
  await h.store.update(h.documentId, { revision, pathId, decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId, done } });
  return h.refresh();
}

test("Done persists and exports as a personal task marker, never exercise evidence", async (t) => {
  const h = await harness(t, content);
  await h.select(pathId, "EX-01", "mixed");
  await h.select(pathId, "EX-02", "ready");
  const exercises = structuredClone(h.state().paths[pathId].exercises);
  await mark(h, "recipe:shared-notes");
  await mark(h, "recipe:first-exercise");
  assert.deepEqual(h.state().paths[pathId].exercises, exercises);
  const reloaded = await createStore(h.workspace, content).read(h.documentId);
  assert.equal(reloaded.checklist.filter((item) => item.done).length, 2);
  const exported = await h.store.export(h.documentId);
  assert.equal(exported.summary[0].checklist.filter((item) => item.done).length, 2);
  assert.ok(exported.summary[0].exercises.every((item) => !item.verified && item.configuration === "not_started"));
  assert.match(await h.store.markdown(h.documentId), /Done is a personal task marker/);
  assert.match(await h.store.markdown(h.documentId), /- \[x\] Shared notes/);
  await mark(h, "recipe:shared-notes", false);
  assert.equal(summary(content, h.state())[0].checklist.find((item) => item.id === "recipe:shared-notes").done, false);
});

test("Verify Done needs only eligibility, stays separate from evidence, and invalidates with relevant choices", async (t) => {
  const h = await harness(t, content);
  await assert.rejects(mark(h, "verify:EX-FIRST"), /inactive|prerequisites/);
  await h.select(pathId, "EX-01", "mixed");
  await h.select(pathId, "EX-02", "ready");
  const records = structuredClone(h.state().paths[pathId].exercises);
  await mark(h, "verify:EX-FIRST");
  assert.deepEqual(h.state().paths[pathId].exercises, records);
  assert.equal(verificationChecklist(content.paths[0], h.state().paths[pathId], h.state().checklist)[0].done, true);
  const reloaded = await createStore(h.workspace, content).read(h.documentId);
  assert.equal(reloaded.checklist[0].stepId, "verify:EX-FIRST");
  const exported = await h.store.export(h.documentId);
  assert.equal(exported.summary[0].verificationChecklist[0].done, true);
  assert.ok(exported.summary[0].checklist.every((task) => !task.done));
  assert.ok(exported.summary[0].exercises.every((item) => !item.verified && !item.evidence));
  assert.match(await h.store.markdown(h.documentId), /Personal verification checklist/);
  await mark(h, "verify:EX-FIRST", false);
  assert.equal(h.state().checklist[0].done, false);
  await mark(h, "verify:EX-FIRST");
  await h.configure(pathId, "EX-FIRST", { settingsUrl: "https://github.com/example/changed-target" });
  assert.ok(!h.state().checklist.some((item) => item.stepId === "verify:EX-FIRST"));
  await mark(h, "verify:EX-FIRST");
  await h.select(pathId, "EX-02", "review");
  assert.ok(!h.state().checklist.some((item) => item.stepId === "verify:EX-FIRST"));
  assert.ok(h.state().history.some((item) => item.data.stepId === "verify:EX-FIRST" && item.data.done));
});

test("only affected checklist markers move to history after choices, targets or source changes", async (t) => {
  const h = await harness(t, content);
  await h.select(pathId, "EX-01", "mixed");
  await h.select(pathId, "EX-02", "ready");
  await mark(h, "recipe:first-exercise");
  await mark(h, "recipe:second-exercise");
  await h.select(pathId, "EX-02", "review");
  assert.equal(h.state().checklist.length, 1);
  assert.equal(h.state().checklist[0].stepId, "recipe:second-exercise");
  assert.ok(h.state().history.some((item) => item.data.stepId === "recipe:first-exercise"));
  await h.configure(pathId, "EX-SECOND", { fields: { interpretation: "Changed target observation" } });
  assert.equal(h.state().checklist.length, 0);
  await mark(h, "recipe:shared-notes");
  const changed = structuredClone(content);
  changed.paths[0].recipes[0].fingerprint = `sha256:${"0".repeat(64)}`;
  const stale = await createStore(h.workspace, changed).read(h.documentId);
  assert.equal(stale.checklist.length, 0);
  assert.ok(stale.history.some((item) => item.data.stepId === "recipe:shared-notes"));
  assert.equal(JSON.parse(await h.disk()).checklist.length, 1, "reconciliation reads must not write");
});

test("Additional steps are independent tasks and renames cannot inherit Done", async (t) => {
  const source = structuredClone(content);
  source.paths[0].stages.configure.additionalSteps = [{ title: "Fictional baseline", markdown: "1. Read the fictional baseline." }];
  const h = await harness(t, source);
  await mark(h, "additional:Fictional baseline");
  await h.select(pathId, "EX-01", "review");
  assert.equal(configurationChecklist(source.paths[0], h.state().paths[pathId], h.state().checklist)[0].done, true);
  source.paths[0].stages.configure.additionalSteps[0].title = "Renamed baseline";
  const changed = await createStore(h.workspace, source).read(h.documentId);
  assert.equal(changed.checklist.length, 0);
  assert.equal(changed.history[0].data.title, "Fictional baseline");
});

test("v9 migrates explicitly without inferring Done or modifying disk; malformed v9/v10 is rejected", async (t) => {
  const h = await harness(t, content);
  await h.select(pathId, "EX-01", "mixed");
  await h.select(pathId, "EX-02", "ready");
  await h.configure(pathId, "EX-FIRST", { settingsUrl: "https://github.com/example/sample", fields: { observation: "Existing observation" }, configuration: "already_matches" });
  await h.verify(pathId, "EX-FIRST", { verified: true, evidence: "Existing evidence" });
  const { checklist, profile, ...previous } = structuredClone(h.state());
  previous.version = 9;
  await h.write(previous);
  const before = await h.disk(), migrated = await h.refresh();
  assert.equal(migrated.version, 11);
  assert.deepEqual(migrated.checklist, []);
  assert.deepEqual(migrated.paths, previous.paths);
  assert.equal(migrated.revision, previous.revision);
  assert.equal(await h.disk(), before);
  await mark(h, "recipe:shared-notes");
  assert.equal(JSON.parse(await h.disk()).version, 11);
  assert.equal(h.state().paths[pathId].exercises["EX-FIRST"].verified, true);
  for (const invalid of [
    { ...previous, extra: true },
    { ...migrated, checklist: [{ pathId, stepId: "recipe:shared-notes", done: "yes" }] },
    { ...migrated, checklist: {} },
  ]) {
    await h.write(invalid);
    const original = await h.disk();
    await assert.rejects(h.refresh(), /Preserve the file/);
    assert.equal(await h.disk(), original);
  }
});

test("checklist mutations enforce identity, eligibility, revisions and serialization", async (t) => {
  const h = await harness(t, content);
  await assert.rejects(mark(h, "recipe:first-exercise"), /inactive|prerequisites/);
  await h.select(pathId, "EX-01", "inspect");
  await assert.rejects(mark(h, "recipe:first-exercise"), /prerequisites/);
  await h.select(pathId, "EX-02", "ready");
  const request = { revision: h.state().revision, pathId, decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId: "recipe:first-exercise", done: true } };
  await assert.rejects(h.store.update(h.documentId, { ...request, exerciseId: "EX-FIRST" }), /explicit exercise/);
  await assert.rejects(h.store.update(h.documentId, { ...request, value: { ...request.value, basis: "spoofed" } }), /explicit checklist step/);
  const results = await Promise.allSettled([h.store.update(h.documentId, request), h.store.update(h.documentId, request)]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.match(results.find((item) => item.status === "rejected").reason.message, /another panel/);
});

test("Overview step total counts every authored recipe and additional step, independent of decisions", () => {
  const path = structuredClone(content.paths.find((item) => item.id === pathId));
  path.stages.configure.conclusion = "Review the fictional configuration.";
  path.stages.configure.additionalSteps = [
    { title: "Independent review", markdown: "1. Review this independent step." },
  ];
  assert.equal(totalConfigurationSteps(path), 5);

  const noAnswers = { decisions: {}, exercises: {} };
  assert.equal(configurationChecklist(path, noAnswers).length, 2);

  const allRecipesSelected = { decisions: { "EX-01": "mixed", "EX-02": "ready" }, exercises: {} };
  assert.equal(configurationChecklist(path, allRecipesSelected).length, 5);
});
