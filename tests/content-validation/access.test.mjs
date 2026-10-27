import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { configurationFor } from "../../.github/extensions/governance-lab/ui/model.js";
import { content, accessV1Content, harness } from "./exercise-helpers.mjs";

const id = "access-management", path = content.paths.find((item) => item.id === id);

test("Access decisions cover assignment, maintenance and controls with sequential IDs", () => {
  assert.deepEqual(path.decisions.map((item) => item.id), ["AM-01", "AM-02", "AM-03", "AM-04", "AM-05", "AM-06"]);
  const assignment = path.decisions.find((item) => item.id === "AM-03");
  assert.deepEqual(assignment.options.map(({ id }) => id), ["idp", "github", "api", "mixed"]);
  assert.equal(assignment.options.find(({ id }) => id === "github").label, "Manually");
  assert.equal(assignment.options.find(({ id }) => id === "api").label, "Automated through APIs");
  assert.match(path.sourceText, /one organization per policy group/);
  assert.match(path.sourceText, /small group of AI leaders/);
});

test("license source separates policy groups from assignment targets and identifies the model preview", () => {
  const source = path.decisions.find(({ id }) => id === "AM-02");
  const assignment = path.decisions.find(({ id }) => id === "AM-03");
  assert.match(source.guidance, /groups need different feature policies/);
  assert.match(source.guidance, /Enterprise teams mode for model access is currently an opt-in preview/);
  assert.match(source.guidance, /`Copilot only` licenses/);
  assert.doesNotMatch(source.guidance, /distinct cohorts|all other policies and settings apply equally/);
  assert.match(assignment.guidance, /license source \(the enterprise or an organization\)/);
  assert.doesNotMatch(assignment.guidance, /Copilot seats/);
});

test("built-in access requests keep a documented navigation path without alternative tooling", () => {
  const steps = path.recipes.find(({ id }) => id === "am-request-approval").sections.Steps;
  assert.match(steps, /\[personal Copilot settings\]\(https:\/\/github\.com\/settings\/copilot\)/);
  assert.match(steps, /\*\*Organization Settings -> Requests from members\*\*/);
  assert.match(steps, /approve or deny the request/);
  assert.doesNotMatch(steps, /another internal request tool/);
});

test("policy-group answers select only their own guidance and enterprise warnings", async (t) => {
  const h = await harness(t);
  const selectedGroupGuidance = () => configurationFor(path, h.state().paths[id]).guidance
    .filter(({ recipe }) => recipe.id.startsWith("am-policy-groups"));
  for (const [answer, expected] of [
    ["one", "am-policy-groups-one"],
    ["cohorts", "am-policy-groups"],
    ["business-units", "am-policy-groups-business-units"],
  ]) {
    await h.select(id, "AM-01", answer);
    const guidance = selectedGroupGuidance();
    assert.deepEqual(guidance.map(({ recipe }) => recipe.id), [expected]);
    assert.deepEqual(guidance[0].warnings.map(({ id }) => id), []);
  }
  await h.select(id, "AM-02", "enterprise");
  for (const [answer, expectedWarning] of [
    ["one", null],
    ["cohorts", "cohorts-enterprise"],
    ["business-units", "units-enterprise"],
  ]) {
    await h.select(id, "AM-01", answer);
    const guidance = selectedGroupGuidance();
    assert.deepEqual(guidance.map(({ recipe }) => recipe.id), [
      answer === "one" ? "am-policy-groups-one" : answer === "cohorts" ? "am-policy-groups" : "am-policy-groups-business-units",
    ]);
    assert.deepEqual(guidance[0].warnings.map(({ id }) => id), expectedWarning ? [expectedWarning] : []);
  }
});

test("split policy-group recipes retain their verified Enterprise Cloud references", () => {
  for (const recipeId of ["am-policy-groups-one", "am-policy-groups-business-units"]) {
    const sections = path.recipes.find(({ id }) => id === recipeId).sections.Steps;
    assert.match(sections, /https:\/\/docs\.github\.com\/en\/enterprise-cloud@latest\/copilot\/concepts\/enterprise\/policies/);
    assert.doesNotMatch(sections, /https:\/\/docs\.github\.com\/en\/copilot\/concepts\/enterprise\/policies/);
  }
});

test("AM-LAB is selected only by a license source and follows its variant", async (t) => {
  const h = await harness(t);
  const exercises = () => configurationFor(path, h.state().paths[id]).exercises.map(({ recipe }) => recipe.exerciseId);
  for (const decision of path.decisions.filter((item) => item.id !== "AM-02")) {
    await h.select(id, decision.id, decision.options.find((option) => !option.deferred).id);
  }
  assert.deepEqual(exercises(), []);
  for (const option of ["central-org", "organizations", "enterprise", "mixed"]) {
    await h.select(id, "AM-02", option);
    assert.deepEqual(exercises(), ["AM-LAB"]);
  }
  await assert.rejects(h.select(id, "AM-02", "review"), /valid policy decision/);
  assert.deepEqual(exercises(), ["AM-LAB"]);
});

test("AM-LAB validation variants offer Copilot activity troubleshooting", () => {
  const validation = path.sourceText.split("### Exercise: AM-LAB")[1];
  for (const variant of ["central-org", "organizations", "enterprise", "mixed"]) {
    const body = validation.split(`#### Variant: ${variant}`)[1]?.split(/\n#### Variant:|\n### Exercise:/)[0];
    assert.ok(body, `missing AM-LAB validation variant ${variant}`);
    assert.match(body, /Copilot Chat session on GitHub\.com/);
    assert.match(body, /your \[Petstore workshop repository\]\(https:\/\/github\.com\/\{\{organization\.slug\}\}\/\{\{repository\.name\}\} "fallback=https:\/\/github\.com\/settings\/organizations"\)/);
    assert.match(body, /Copilot cloud agent session/);
  }
});

test("assignment method selects IdP, manual, or API guidance", async (t) => {
  const h = await harness(t);
  const recipeIds = () => configurationFor(path, h.state().paths[id]).recipes.map(({ recipe }) => recipe.id);
  await h.select(id, "AM-03", "idp");
  assert.deepEqual(recipeIds(), ["am-idp-groups"]);
  await h.select(id, "AM-03", "github");
  assert.deepEqual(recipeIds(), ["am-team-assignment"]);
  await h.select(id, "AM-03", "api");
  assert.deepEqual(recipeIds(), ["am-api-assignment"]);
  await h.select(id, "AM-03", "mixed");
  assert.deepEqual(recipeIds(), ["am-idp-groups", "am-team-assignment"]);
  assert.match(path.sourceText, /Use the manual membership steps only for groups managed in GitHub\./);
  await assert.rejects(h.select(id, "AM-03", "review"), /valid policy decision/);
  assert.deepEqual(recipeIds(), ["am-idp-groups", "am-team-assignment"]);
});

test("removing the duplicate decision preserves shifted answers and archives its obsolete answer", async (t) => {
  const previousContent = structuredClone(content);
  const previousAccess = previousContent.paths.find((item) => item.id === id);
  const oldRequest = previousAccess.decisions.find((decision) => decision.id === "AM-04");
  const oldPersonal = previousAccess.decisions.find((decision) => decision.id === "AM-05");
  const oldInactive = previousAccess.decisions.find((decision) => decision.id === "AM-06");
  for (const decision of [oldRequest, oldPersonal, oldInactive]) {
    decision.options.push({ id: "review", label: "Needs Review", deferred: true, recipeIds: [] });
  }
  const option = (sourceId, id, label) => {
    const source = previousAccess.decisions.find((decision) => decision.id === "AM-03").options.find((item) => item.id === sourceId);
    return { ...structuredClone(source ?? { recipeIds: [] }), id, label, deferred: id === "review" };
  };
  const oldAssignment = structuredClone(previousAccess.decisions.find((decision) => decision.id === "AM-03"));
  oldAssignment.id = "AM-04";
  oldAssignment.title = "Assignment method";
  oldAssignment.options = [
    option("github", "groups", "Through team membership"),
    option("api", "api", "Automated through the REST API"),
    option("github", "manual", "By hand in the GitHub UI"),
    option("review", "review", "Needs Review"),
  ];
  oldRequest.id = "AM-05";
  oldPersonal.id = "AM-06";
  oldInactive.id = "AM-07";
  previousAccess.decisions.splice(3, 0, oldAssignment);
  const h = await harness(t, previousContent);
  await h.select(id, "AM-04", "groups");
  await h.select(id, "AM-05", "approval");
  await h.select(id, "AM-06", "block");
  await h.select(id, "AM-07", "automated");
  const migrated = await createStore(h.workspace, content).read(h.documentId);
  assert.deepEqual(
    Object.fromEntries(Object.entries(migrated.paths[id].decisions).filter(([, value]) => value !== null)),
    { "AM-04": "approval", "AM-05": "block", "AM-06": "automated" },
  );
  assert.ok(migrated.history.some((item) => item.data.decisionId === "AM-04" && item.data.value === "groups"));
});

test("superseded Access decision values and exercise evidence remain historical across the content change", async (t) => {
  const h = await harness(t, accessV1Content);
  await h.select(id, "AM-01", "pilot");
  await h.select(id, "AM-02", "central");
  await h.configure(id, "AM-LAB", { configuration: "already_matches", settingsUrl: "https://github.com/orgs/example/settings/copilot" });
  await h.verify(id, "AM-LAB", { verified: true, evidence: "Earlier pilot assignment check" });
  const disk = await h.disk();
  const reconciled = await createStore(h.workspace, content).read(h.documentId);
  assert.ok(Object.values(reconciled.paths[id].decisions).every((value) => value === null));
  assert.ok(Object.values(reconciled.paths[id].exercises).every((record) => !record.verified && !record.evidence));
  assert.ok(reconciled.history.some((item) => item.data.decisionId === "AM-01" && item.data.value === "pilot"));
  assert.ok(reconciled.history.some((item) => item.data.exerciseId === "AM-LAB" && item.data.record.verified &&
    item.data.record.evidence === "Earlier pilot assignment check"));
  assert.equal(await h.disk(), disk);
});
