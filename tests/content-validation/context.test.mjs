import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { loadWorkshopContent, resolveConfiguration } from "../../lib/workshop-content.mjs";
import { coverageReport } from "../../scripts/catalog-coverage.mjs";
import { safeTargetUrl, summary } from "../../.github/extensions/governance-lab/ui/model.js";
import { content, frozenDrafts, harness } from "./exercise-helpers.mjs";

const id = "context-management", path = content.paths.find((item) => item.id === id);
const recipe = path.recipes.find((item) => item.exerciseId === "CM-LAB");
test("Context Markdown retains existing choice identities, repository scope and security caveats", () => {
  const old = frozenDrafts.find((item) => item.id === id);
  assert.deepEqual(path.decisions.map(({ id }) => id), ["CM-01", "CM-02", "CM-03", "CM-04", "CM-05", "CM-06"]);
  for (const decision of old.decisions) {
    const oldIds = decision.options.filter(({ deferred }) => !deferred).map(({ id }) => id);
    const current = path.decisions.find(({ id }) => id === ({ "CM-01": "CM-02", "CM-02": "CM-01" }[decision.id] ?? decision.id));
    assert.deepEqual(current.options.filter(({ id }) => oldIds.includes(id)).map(({ id }) => id), oldIds);
  }
  assert.ok(path.decisions.every((decision) => decision.options.every((option) => !option.deferred)));
  assert.equal(recipe.id, "cm-lab-exercise");
  assert.equal(recipe.target, "repository");
  assert.match(recipe.sections.Safety, /Use your \[Petstore workshop repository\]/);
  assert.match(recipe.sections.Steps, /git restore --source=HEAD --staged --worktree -- src\/slug\.js/);
  assert.match(recipe.sections.Steps, /git clean -n -- src\/slug\.js/);
  assert.match(recipe.sections.Steps, /git clean -f -- src\/slug\.js/);
  assert.match(recipe.sections.Steps, /Keep existing instructions, baseline observations, and unrelated work/);
  assert.match(recipe.sections.Steps, /uncommitted and unstaged/);
  assert.doesNotMatch(recipe.sections.Steps, /git restore[^\n]* \.|git clean -fd(?:\s|$)/);
  assert.match(recipe.sections.Safety, /Instructions guide behavior; they do not restrict access/);
  assert.match(recipe.sections.Safety, /Do not test restrictions with secrets or bypass existing controls/);
  assert.doesNotMatch(path.sourceText, /facilitator-approved|Proposal only and Blocked|record preparation as Complete|closed guidance panel/);
  assert.match(recipe.sections.Steps, /Implement slugify\(text\)/);
  assert.match(recipe.sections.Steps, /node --test/);
  assert.match(path.validations[0].sections["Expected result"], /does not test regulatory compliance/);
});
test("Context needs-first choices resolve traced guidance without inventing security exercises", () => {
  for (const choice of ["shared", "scoped"]) {
    const resolved = resolveConfiguration(path, { "CM-02": choice, "CM-01": "combined" });
    assert.deepEqual(resolved.exercises.map(({ recipe }) => recipe.exerciseId), ["CM-LAB"]);
    assert.equal(resolved.exercises[0].variant.optionId, choice);
    assert.deepEqual(resolved.guidance.map(({ recipe }) => recipe.id),
      [...(choice === "scoped" ? ["cm-scoped-instructions"] : []), "cm-access-review", "cm-content-exclusion",
        ...(choice === "scoped" ? ["cm-organization-instructions", "cm-skills-review"] : [])]);
    assert.ok(resolved.recipes.every(({ eligible }) => eligible));
  }
  for (const [choice, recipes] of [
    ["broad", ["cm-access-review"]],
    ["access", ["cm-access-review"]], ["exclusions", ["cm-content-exclusion"]],
    ["combined", ["cm-access-review", "cm-content-exclusion"]],
  ]) {
    const resolved = resolveConfiguration(path, { "CM-01": choice });
    assert.deepEqual(resolved.guidance.map(({ recipe }) => recipe.id), recipes);
    assert.equal(resolved.exercises.length, 0);
  }
  for (const entry of [...path.decisions, ...path.recipes, ...path.stages.configure.additionalSteps]) {
    assert.ok(entry.catalogSource, `Missing catalog traceability: ${entry.id ?? entry.title}`);
  }
  for (const decision of path.decisions) {
    const referenced = new Set(decision.options.flatMap((option) => option.recipeIds));
    const expected = [...new Set(path.recipes.filter((recipe) => referenced.has(recipe.id)).flatMap((recipe) => recipe.catalogIds))].sort();
    assert.deepEqual([...decision.catalogIds].sort(), expected);
  }
  assert.match(path.recipes.find(({ id }) => id === "cm-content-exclusion").sections.Steps, /rather than saving it/);
  assert.ok(path.recipes.find(({ id }) => id === "cm-access-review").catalogIds.includes("agents-context.repository-access"));
  assert.match(path.recipes.find(({ id }) => id === "cm-content-exclusion").sections.Steps,
    /\*\*\[Repository Settings -> Copilot -> Content exclusion\]\(https:\/\/github\.com\/\{\{organization\.slug\}\}\/\{\{repository\.name\}\}\/settings\/copilot\/content_exclusion "fallback=https:\/\/github\.com\/settings\/organizations"\)\*\*/);
  assert.match(path.recipes.find(({ id }) => id === "cm-access-review").sections.Steps, /Do not add or remove people or change roles/);
});
test("Context external sources, shared knowledge, Memory and quality select answer-specific guidance", () => {
  const paths = [
    ["CM-03", { none: "cm-external-context", approved: "cm-external-context-approved", managed: "cm-external-context-managed" }],
    ["CM-04", { repository: "cm-shared-knowledge", curated: "cm-shared-knowledge-curated", "team-owned": "cm-shared-knowledge-team-owned" }],
    ["CM-05", { session: "cm-memory-review", managed: "cm-memory-review-managed", broader: "cm-memory-review-broader" }],
    ["CM-06", { developer: "cm-quality-review", standardized: "cm-quality-review-standardized", lifecycle: "cm-quality-review-lifecycle" }],
  ];
  for (const [decisionId, choices] of paths) {
    const decision = path.decisions.find(({ id }) => id === decisionId);
    for (const [answer, recipeId] of Object.entries(choices)) {
      const option = decision.options.find(({ id }) => id === answer);
      assert.deepEqual(option.recipeIds, [recipeId]);
      const resolved = resolveConfiguration(path, { [decisionId]: answer });
      assert.deepEqual(resolved.guidance.map(({ recipe }) => recipe.id), [recipeId]);
      assert.deepEqual(resolved.exercises, []);
      assert.ok(resolved.recipes.every(({ eligible }) => eligible));
    }
  }
});
test("six Context decisions resolve every answer and retain one bounded exercise", async () => {
  assert.deepEqual(path.decisions.map(({ id }) => id), ["CM-01", "CM-02", "CM-03", "CM-04", "CM-05", "CM-06"]);
  assert.deepEqual(path.recipes.filter(({ kind }) => kind === "exercise").map(({ exerciseId }) => exerciseId), ["CM-LAB"]);
  assert.deepEqual(path.validations.map(({ exerciseId }) => exerciseId), ["CM-LAB"]);
  for (const decision of path.decisions) {
    assert.ok(decision.options.length >= 2);
    for (const option of decision.options) {
      const resolved = resolveConfiguration(path, { [decision.id]: option.id });
      assert.deepEqual(new Set(resolved.recipes.map(({ recipe }) => recipe.id)), new Set(option.recipeIds));
      assert.ok(resolved.recipes.every(({ eligible }) => eligible));
      assert.equal(resolved.unresolvedDecisionIds.includes(decision.id), false);
      if (decision.id !== "CM-02") assert.equal(resolved.exercises.length, 0);
    }
  }
  const central = resolveConfiguration(path, { "CM-02": "centralized" });
  assert.equal(central.exercises[0].variant.optionId, "centralized");
  assert.match(central.exercises[0].variant.sections.Steps, /does not deploy organization instructions/);
  const { blocks, planning, diagnostics } = await loadWorkshopContent();
  assert.deepEqual(diagnostics, []);
  const report = coverageReport(blocks, planning).find(({ block }) => block === id);
  assert.equal(report.entries.length, 9);
  assert.ok(report.entries.every(({ status }) => status === "configured"));
  assert.equal(planning.byId.get("models-features.suggestions-matching-public-code").block, "user-governance");
  const user = blocks.find(({ id }) => id === "user-governance");
  const baseline = user.stages.configure.additionalSteps.find(({ catalogIds }) => catalogIds.includes("models-features.suggestions-matching-public-code"));
  assert.match(baseline.markdown, /`Privacy`.*`Suggestions matching public code`/);
});
test("new Context guidance keeps source sharing, Memory and enforcement boundaries explicit", () => {
  const steps = (id) => path.recipes.find((recipe) => recipe.id === id).sections.Steps;
  const approved = steps("cm-external-context-approved");
  assert.match(approved, /https:\/\/docs\.github\.com\/en\/enterprise-cloud@latest\/copilot\/concepts\/enterprise\/mcp-management/);
  assert.match(approved, /https:\/\/docs\.github\.com\/en\/enterprise-cloud@latest\/copilot\/how-tos\/copilot-on-github\/customize-copilot\/configure-mcp-servers/);
  const curated = steps("cm-shared-knowledge-curated");
  assert.match(curated, /https:\/\/docs\.github\.com\/en\/enterprise-cloud@latest\/copilot\/concepts\/prompting-and-context\/spaces/);
  assert.match(curated, /https:\/\/docs\.github\.com\/en\/enterprise-cloud@latest\/copilot\/how-tos\/copilot-on-github\/customize-copilot\/copilot-spaces\/collaborate-with-others/);
  const memory = steps("cm-memory-review");
  assert.match(memory, /then `Copilot Memory`/);
  assert.match(memory, /and its `Copilot Memory` setting/);
  for (const id of ["cm-external-context-approved", "cm-external-context-managed"]) {
    assert.match(steps(id), /empty allowlist still permits built-in/);
    assert.match(steps(id), /separate from client-managed allowlists/);
  }
  for (const id of ["cm-shared-knowledge-curated", "cm-shared-knowledge-team-owned"]) {
    assert.match(steps(id), /uploaded files and pasted text/);
    assert.match(steps(id), /seat source, not just the organization that owns/);
  }
  for (const id of ["cm-memory-review-managed", "cm-memory-review-broader"]) {
    assert.match(steps(id), /enabled per user, not per repository/);
    assert.match(steps(id), /28 days.*reset the timer/);
    assert.match(steps(id), /Keep personal data out of workshop evidence/);
    assert.match(steps(id), /This choice does not change Memory modes or retention settings/);
    assert.doesNotMatch(steps(id), /Neither option/);
  }
  for (const id of ["cm-quality-review", "cm-quality-review-standardized", "cm-quality-review-lifecycle"]) {
    assert.match(steps(id), /does not show a billing saving/);
  }
  assert.doesNotMatch(path.sourceText, /CLI.*(?:does not support|unsupported)|(?:does not support|unsupported).*CLI/);
});
test("repository targets retain strict URL validation", () => {
  assert.equal(safeTargetUrl(recipe, "https://github.com/example/sample"), "https://github.com/example/sample");
  for (const value of ["https://github.com/example/sample/settings", "https://github.com/orgs/example", "https://github.com/example/sample?x=1",
    "https://github.com/example/sample#x", "http://github.com/example/sample", "https://github.com.evil.test/example/sample", "https://user:pass@github.com/example/sample", "https://github.com/github-copilot/purchase"]) assert.equal(safeTargetUrl(recipe, value), null, value);
});
test("all Context instruction choices separate preparation and evaluation without changing prior blocks", async (t) => {
  const h = await harness(t), before = structuredClone(h.state().paths);
  for (const choice of ["shared", "scoped", "centralized"]) {
    await h.select(id, "CM-02", choice); await h.select(id, "CM-01", "access");
    await h.configure(id, "CM-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/example/sample" });
    assert.equal(h.state().paths[id].exercises["CM-LAB"].verified, false);
    await h.verify(id, "CM-LAB", { verified: true, evidence: "Inspected references and compared the approved task." });
    assert.equal(summary(content, h.state()).find((item) => item.id === id).exercises[0].verified, true);
  }
  for (const [other, progress] of Object.entries(before)) if (other !== id) assert.deepEqual(h.state().paths[other], progress);
});
test("Context unanswered and proposal outcomes remain incomplete in both exports", async (t) => {
  const h = await harness(t);
  await assert.rejects(h.configure(id, "CM-LAB"), /inactive/);
  await h.select(id, "CM-02", "shared");
  await h.configure(id, "CM-LAB", { mode: "proposal", configuration: "blocked", followUp: "Obtain repository authorization" });
  await assert.rejects(h.verify(id, "CM-LAB", { verified: true, evidence: "A proposal only" }), /Complete/);
  assert.equal((await h.store.export(h.documentId)).summary.find((item) => item.id === id).exercises[0].verified, false);
  assert.match(await h.store.markdown(h.documentId), /Obtain repository authorization/);
});
for (const [source, fingerprint] of [
  ["pre-template", "sha256:fbfdc9c9b24ed22785e3e4c9a82a764fa4702f371fa1687094f27c3a22759200"],
  ["main 152ecaa", "sha256:336969ccc6353968d92624acd657bb0f63053786fbc4c9f6f86eb42abd0048e6"],
]) test(`Context refresh archives ${source} evidence and markers without changing saved choices`, async (t) => {
  const previous = structuredClone(content);
  const oldPath = previous.paths.find((item) => item.id === id);
  oldPath.decisions = oldPath.decisions.filter(({ id }) => ["CM-02", "CM-01"].includes(id));
  oldPath.recipes.find((item) => item.exerciseId === "CM-LAB").fingerprint = fingerprint;
  const h = await harness(t, previous);
  await h.select(id, "CM-02", "shared");
  await h.select(id, "CM-01", "access");
  await h.configure(id, "CM-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/example/sample" });
  await h.verify(id, "CM-LAB", { verified: true, evidence: "Earlier instruction comparison", followUp: "Retained follow-up" });
  await h.store.update(h.documentId, { revision: h.state().revision, pathId: id, decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId: "verify:CM-LAB", done: true } });
  const before = await h.disk();
  const store = createStore(h.workspace, content);
  const current = await store.read(h.documentId);
  assert.equal(await h.disk(), before, "reconciliation is read-only");
  assert.deepEqual(current.paths[id].decisions,
    { "CM-02": "shared", "CM-01": "access", "CM-03": null, "CM-04": null, "CM-05": null, "CM-06": null });
  assert.equal(current.paths[id].exercises["CM-LAB"].verified, false);
  assert.equal(current.paths[id].exercises["CM-LAB"].evidence, "");
  assert.equal(current.paths[id].exercises["CM-LAB"].followUp, "Retained follow-up");
  assert.ok(current.history.some((entry) => entry.data.exerciseId === "CM-LAB" &&
    entry.data.record?.evidence === "Earlier instruction comparison"));
  assert.ok(current.history.some((entry) => entry.data.stepId === "verify:CM-LAB" && entry.data.done));
  assert.ok(!current.checklist.some((entry) => entry.stepId === "verify:CM-LAB" && entry.done));
  assert.equal((await store.export(h.documentId)).summary.find((item) => item.id === id).exercises[0].verified, false);
  assert.match(await store.markdown(h.documentId), /Earlier instruction comparison/);
});
test("new independent Context choices preserve current CM-LAB evidence and resolved answers", async (t) => {
  const h = await harness(t);
  await h.select(id, "CM-02", "scoped");
  await h.select(id, "CM-01", "broad");
  await h.configure(id, "CM-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/example/sample" });
  await h.verify(id, "CM-LAB", { verified: true, evidence: "Current baseline comparison" });
  const before = structuredClone(h.state().paths[id].exercises["CM-LAB"]);
  for (const [decision, option] of [["CM-03", "approved"], ["CM-04", "curated"], ["CM-05", "managed"], ["CM-06", "lifecycle"]]) {
    await h.select(id, decision, option);
    assert.deepEqual(h.state().paths[id].exercises["CM-LAB"], before);
  }
  assert.ok(!resolveConfiguration(path, h.state().paths[id].decisions).unresolvedDecisionIds.includes("CM-01"));
  await h.refresh();
  assert.deepEqual(h.state().paths[id].exercises["CM-LAB"], before);
});
