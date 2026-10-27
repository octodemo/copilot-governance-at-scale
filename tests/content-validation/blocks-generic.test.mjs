import assert from "node:assert/strict";
import test from "node:test";
import { canConfigure, configurationFor } from "../../.github/extensions/governance-lab/ui/model.js";
import { content, harness } from "./exercise-helpers.mjs";

// Content-agnostic: derives decisions, options and exercises from the parsed blocks.
const answered = (decision) => decision.options.find((option) => !option.deferred);
const syntheticFields = (fields) => Object.fromEntries(fields.map((field) => [field.id,
  field.type === "select" ? field.options[0] : field.type === "number" ? "1" : "Synthetic validation evidence"]));

test("block, decision and exercise identities are unique across all blocks", () => {
  const blockIds = content.paths.map((path) => path.id);
  const decisionIds = content.paths.flatMap((path) => path.decisions.map((decision) => decision.id));
  const exerciseIds = content.paths.flatMap((path) => path.recipes
    .filter((recipe) => recipe.exerciseId)
    .map((recipe) => recipe.exerciseId));
  assert.equal(new Set(blockIds).size, blockIds.length, "blocks");
  assert.equal(new Set(decisionIds).size, decisionIds.length, "decisions");
  assert.equal(new Set(exerciseIds).size, exerciseIds.length, "exercises");
});

for (const path of content.paths) {
  const exercises = path.recipes.filter((recipe) => recipe.exerciseId);
  test(`${path.id}: unanswered decisions never allow exercise configuration`, async (t) => {
    const h = await harness(t);
    for (const recipe of exercises) assert.equal(canConfigure(path, h.state().paths[path.id], recipe.exerciseId), false);
  });
  test(`${path.id}: leaving a required decision unanswered blocks its exercise`, async (t) => {
    for (const recipe of exercises) for (const required of recipe.requiresDecisions) {
      const h = await harness(t);
      for (const decision of path.decisions) {
        if (decision.id !== required) await h.select(path.id, decision.id, answered(decision).id);
      }
      assert.equal(canConfigure(path, h.state().paths[path.id], recipe.exerciseId), false, `${recipe.exerciseId} / ${required}`);
    }
  });
  test(`${path.id}: eligible exercises require complete validation inputs; guidance never completes`, async (t) => {
    const h = await harness(t);
    for (const decision of path.decisions) await h.select(path.id, decision.id, answered(decision).id);
    const resolved = configurationFor(path, h.state().paths[path.id]);
    for (const { recipe, validation, eligible } of resolved.exercises) {
      if (!eligible) continue;
      const evidence = {
        verified: true, evidence: "Synthetic observed evidence", evidenceFields: syntheticFields(validation.fields),
        followUp: "Review synthetic evidence",
      };
      await h.configure(path.id, recipe.exerciseId, { fields: syntheticFields(recipe.fields) });
      assert.equal(canConfigure(path, h.state().paths[path.id], recipe.exerciseId), true);
      const before = await h.disk();
      await assert.rejects(h.verify(path.id, recipe.exerciseId, { ...evidence, evidence: "" }), /Complete/);
      if (recipe.target !== "none") {
        await assert.rejects(h.verify(path.id, recipe.exerciseId, evidence), /Complete/);
      }
      assert.equal(await h.disk(), before, "rejected validation must not persist");
      await h.configure(path.id, recipe.exerciseId, {
        settingsUrl: recipe.target === "none" ? "" : "https://github.com/example/sample",
      });
      for (const field of validation.fields.filter((field) => field.required)) {
        await assert.rejects(h.verify(path.id, recipe.exerciseId, {
          ...evidence, evidenceFields: { ...evidence.evidenceFields, [field.id]: "" },
        }), /Complete/);
      }
      await assert.rejects(h.verify(path.id, recipe.exerciseId, { ...evidence, evidence: "" }), /Complete/);
      await h.verify(path.id, recipe.exerciseId, evidence);
      const saved = (await h.refresh()).paths[path.id].exercises[recipe.exerciseId];
      assert.equal(saved.verified, true, "complete inputs allow direct verification");
      assert.equal(saved.configuration, "not_started", "verification does not mark configuration complete");
    }
    const guidanceIds = new Set(path.recipes.filter((recipe) => !recipe.exerciseId).map((recipe) => recipe.id));
    for (const exercise of resolved.exercises) assert.equal(guidanceIds.has(exercise.recipe.id), false);
    for (const id of guidanceIds) assert.equal(Object.hasOwn(h.state().paths[path.id].exercises, id), false);
  });
}
