import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { content, harness, legacyState } from "./exercise-helpers.mjs";
import { PATH_IDS } from "../../.github/extensions/governance-lab/content.mjs";
import { createStore, validateDocumentId } from "../../.github/extensions/governance-lab/state.mjs";
import { openServer } from "../../.github/extensions/governance-lab/server.mjs";
import {
  configurationFor, configurationRoute, configurationTasks, decisionOverview, decisionRoute, labRoute, markdownExport, navigation,
  parseRoute, resumeRoute, safeSettingsUrl, summary, understandRoute, workflowSteps,
} from "../../.github/extensions/governance-lab/ui/model.js";
import { renderMarkdown } from "../../.github/extensions/governance-lab/ui/markdown.js";

const request = (revision, value = "one", decisionId = "AM-01") => ({
  revision, pathId: "access-management", decisionId, exerciseId: null, operation: "decide", value,
});
async function userExercise(h) {
  await h.select("access-management", "AM-02", "central-org");
  return h.configure("access-management", "AM-LAB", {
    configuration: "already_matches", settingsUrl: "https://github.com/orgs/example/settings/copilot",
  });
}

test("six ordered use-case blocks are available independently of author approvals", () => {
  assert.deepEqual(content.paths.map((path) => path.id), PATH_IDS);
  assert.deepEqual(content.paths.map((path) => path.title), [
    "Access Management", "User Governance", "Billing & Cost Control", "Agent Governance", "Context Management", "Observability",
  ]);
  for (const path of content.paths) {
    assert.equal(path.formatVersion, 1);
    assert.ok(path.stages.understand.markdown);
    assert.ok(path.decisions.every((decision) => decision.options.length >= 2 &&
      decision.options.every((option) => !option.deferred)));
    assert.equal(Object.hasOwn(path, "approval"), false);
  }
});

test("Understand rendering handles CRLF without metadata or unsafe markup", () => {
  for (const path of content.paths) {
    const source = path.stages.understand.markdown;
    assert.equal(renderMarkdown(source.replace(/\n/g, "\r\n")), renderMarkdown(source));
    assert.doesNotMatch(renderMarkdown(source), /\sstyle=|onclick=/);
  }
});

test("access decisions are sequential and mixed user governance resolves existing guidance", async (t) => {
  assert.deepEqual(content.paths[0].decisions.map((decision) => decision.id), ["AM-01", "AM-02", "AM-03", "AM-04", "AM-05", "AM-06"]);
  const user = content.paths.find((path) => path.id === "user-governance");
  assert.deepEqual(user.decisions.map((decision) => decision.id), ["UG-01", "UG-02", "UG-03", "UG-04", "UG-05"]);
  for (const decision of user.decisions) assert.ok(decision.options.every((option) => !option.deferred));
  const h = await harness(t);
  await h.select(user.id, "UG-01", "mixed");
  assert.deepEqual(configurationFor(user, h.state().paths[user.id]).guidance.map(({ recipe }) => recipe.id),
    ["ug-01-enterprise-guidance", "ug-01-ai-managers-guidance", "ug-01-organizations-guidance"]);
});

test("model presets resolve guidance while no preset is resolved without configuration", async (t) => {
  const user = content.paths.find((path) => path.id === "user-governance");
  const decision = user.decisions.find((item) => item.id === "UG-05");
  assert.deepEqual(decision.options.map((option) => option.id), ["auto", "specific-model", "no-preset"]);
  const h = await harness(t);
  for (const option of ["auto", "specific-model"]) {
    await h.select(user.id, decision.id, option);
    assert.deepEqual(configurationFor(user, h.state().paths[user.id]).guidance.map(({ recipe }) => recipe.id),
      ["ug-05-default-model-guidance", option === "auto" ? "ug-05-auto-guidance" : "ug-05-specific-model-guidance"]);
    assert.deepEqual(configurationFor(user, h.state().paths[user.id]).exercises.map(({ recipe }) => recipe.exerciseId), ["UG-PRESET-LAB"]);
    const recipes = configurationFor(user, h.state().paths[user.id]).guidance.map(({ recipe }) => recipe);
    const examples = [...recipes[1].markdown.matchAll(/```json\n([\s\S]*?)\n```/g)];
    assert.equal(examples.length, 1);
    const example = JSON.parse(examples[0][1]);
    if (option === "auto") assert.deepEqual(example, { model: "auto", autoTier: { overridable: "balance" } });
    else {
      assert.equal(example.model, "gpt-6-luna");
      assert.equal(Object.hasOwn(example, "autoTier"), false);
    }
  }
  await h.select(user.id, decision.id, "no-preset");
  const state = h.state().paths[user.id];
  assert.equal(configurationFor(user, state).guidance.length, 0);
  assert.equal(configurationFor(user, state).exercises.length, 0);
  assert.equal(decisionOverview(user, state).decisions.find((item) => item.id === decision.id).status, "Answered");
  await h.select(user.id, decision.id, "no-preset");
  assert.equal(decisionOverview(user, h.state().paths[user.id]).decisions.find((item) => item.id === decision.id).status, "Answered");
});

test("navigation separates reading, decisions and exercise-specific configure/verify routes", async (t) => {
  const h = await harness(t);
  for (const path of content.paths) {
    assert.equal(resumeRoute(path, h.state()), understandRoute(path.id));
    const intro = parseRoute(understandRoute(path.id), content.paths, h.state());
    assert.equal(intro.view, "understand");
    const next = navigation(path, intro, h.state().paths[path.id]);
    assert.equal(next.next, decisionRoute(path.id, path.decisions[0].id));
    assert.equal(next.nextLabel, "Start decisions");
    assert.equal(parseRoute("?path=missing", content.paths, h.state()).view, "home");
  }
  assert.equal(h.state().revision, 0);
  await assert.rejects(h.disk(), { code: "ENOENT" });
  await h.select("access-management", "AM-01", "one");
  const path = content.paths[0];
  assert.equal(resumeRoute(path, h.state()), decisionRoute(path.id, "AM-02"));
  await h.select("access-management", "AM-02", "central-org");
  for (const stage of ["configure", "verify"]) {
    const route = parseRoute(labRoute(path.id, stage, "AM-LAB"), content.paths, h.state());
    assert.equal(route.exerciseId, "AM-LAB");
    assert.equal(route.stage, stage);
  }
});

test("decision overview keeps legacy deferred records distinct from unanswered questions", () => {
  const path = structuredClone(content.paths[0]), [answered, deferred] = path.decisions;
  deferred.options.push({ id: "review", label: "Needs Review", deferred: true, recipeIds: [] });
  const answer = answered.options.find((option) => !option.deferred);
  const review = deferred.options.find((option) => option.deferred);
  const overview = decisionOverview(path, { decisions: { [answered.id]: answer.id, [deferred.id]: review.id } });
  assert.equal(overview.answered, 1);
  assert.equal(overview.needsReview, 1);
  assert.equal(overview.unanswered, path.decisions.length - 2);
  assert.equal(overview.decisions.find((item) => item.id === answered.id).status, "Answered");
  assert.equal(overview.decisions.find((item) => item.id === deferred.id).status, "Needs review");
});

test("Configure routes cover all authored tasks, legacy exercise links, and first unfinished resume", async (t) => {
  const h = await harness(t);
  const path = content.paths.find((item) => item.id === "user-governance");
  for (const decision of path.decisions) await h.select(path.id, decision.id, decision.options.find((option) => !option.deferred).id);
  const progress = h.state().paths[path.id], tasks = configurationTasks(path, progress);
  const recipeTasks = configurationFor(path, progress).recipes.map(({ recipe }) => `recipe:${recipe.id}`);
  assert.equal(tasks.length, recipeTasks.length + path.stages.configure.additionalSteps.length);
  assert.deepEqual(tasks.slice(0, recipeTasks.length).map((task) => task.id), recipeTasks);
  assert.equal(parseRoute(labRoute(path.id), content.paths, h.state()).stepId, tasks[0].id);
  assert.equal(parseRoute(configurationRoute(path.id, "missing"), content.paths, h.state()).stepId, tasks[0].id);
  for (const [index, task] of tasks.entries()) {
    const route = parseRoute(configurationRoute(path.id, task.id), content.paths, h.state());
    assert.equal(route.stepId, task.id);
    assert.equal(route.exerciseId, path.recipes.find((recipe) => `recipe:${recipe.id}` === task.id)?.exerciseId ?? null);
    const nav = navigation(path, route, progress);
    assert.equal(nav.position, `Step ${index + 1} of ${tasks.length}`);
    assert.equal(nav.next, index < tasks.length - 1 ? configurationRoute(path.id, tasks[index + 1].id) :
      labRoute(path.id, "verify", path.stages.validation.introduction.trim() ? null : configurationFor(path, progress).exercises[0]?.recipe.exerciseId ?? null));
    assert.equal(nav.back, index > 0 ? configurationRoute(path.id, tasks[index - 1].id) : decisionRoute(path.id, path.decisions.at(-1).id));
  }
  const introduction = parseRoute(labRoute(path.id, "verify"), content.paths, h.state());
  assert.equal(introduction.exerciseId, null);
  const introNavigation = navigation(path, introduction, progress);
  assert.equal(introNavigation.nextLabel, "Start verification");
  const firstExercise = configurationFor(path, progress).exercises[0].recipe.exerciseId;
  assert.equal(introNavigation.next, labRoute(path.id, "verify", firstExercise));
  const firstVerify = parseRoute(introNavigation.next, content.paths, h.state());
  assert.equal(firstVerify.exerciseId, firstExercise);
  assert.equal(navigation(path, firstVerify, progress).back, labRoute(path.id, "verify"));
  assert.equal(resumeRoute(path, h.state()), configurationRoute(path.id, tasks[0].id));
  await h.store.update(h.documentId, { revision: h.state().revision, pathId: path.id, decisionId: null, exerciseId: null, operation: "checklist", value: { stepId: tasks[0].id, done: true } });
  await h.refresh();
  assert.equal(resumeRoute(path, h.state()), configurationRoute(path.id, tasks[1].id));

  await h.select("access-management", "AM-02", "central-org");
  const access = content.paths[0], exerciseRoute = parseRoute(labRoute(access.id, "configure", "AM-LAB"), content.paths, h.state());
  assert.equal(exerciseRoute.stepId, "recipe:am-lab-exercise");
  assert.equal(exerciseRoute.exerciseId, "AM-LAB");
});

test("configure and verify navigation distinguish unanswered decisions from no exercises", () => {
  const path = structuredClone(content.paths[0]), empty = { decisions: {}, exercises: {} };
  path.stages.validation.introduction = "";
  for (const decision of path.decisions) for (const option of decision.options) option.recipeIds = [];
  for (const stage of ["configure", "verify"]) {
    const route = { view: "lab", pathId: path.id, stage, exerciseId: null };
    assert.equal(navigation(path, route, empty).position, "Decisions remain");
    const answered = { decisions: Object.fromEntries(path.decisions.map((decision) => [
      decision.id, decision.options.find((option) => !option.deferred)?.id,
    ])), exercises: {} };
    assert.equal(navigation(path, route, answered).position, "No applicable exercises");
  }
});

test("all workflow stages remain navigation targets without reporting completion", () => {
  for (const path of content.paths) {
    const routes = [
      { view: "understand", pathId: path.id },
      { view: "decision", pathId: path.id, decisionId: path.decisions[0].id },
      { view: "lab", pathId: path.id, stage: "configure" },
      { view: "lab", pathId: path.id, stage: "verify" },
    ];
    routes.forEach((route, current) => {
      const steps = workflowSteps(path, route, { decisions: {} });
      assert.deepEqual(steps.map((step) => step.label), ["Understand", "Decide", "Configure", "Verify"]);
      steps.forEach((step, index) => {
        assert.equal(step.current, index === current);
        assert.equal(Boolean(step.href), true);
        assert.equal(Object.hasOwn(step, "complete"), false);
      });
    });
  }
});

test("document isolation, restarts, per-exercise completion and both exports agree", async (t) => {
  const h = await harness(t);
  await userExercise(h);
  await h.verify("access-management", "AM-LAB", { verified: true, evidence: "Observed an approved assignment and developer response." });
  const reopened = createStore(h.workspace, content);
  assert.deepEqual(await reopened.read(h.documentId), h.state());
  assert.equal((await reopened.read("other")).revision, 0);
  const report = summary(content, h.state());
  assert.equal(report[0].exercises[0].verified, true);
  assert.equal(report[1].exercises.length, 0);
  const exported = await reopened.export(h.documentId);
  assert.equal(exported.version, 11);
  assert.equal(exported.untrusted, true);
  assert.deepEqual(exported.summary, report);
  assert.equal(await reopened.markdown(h.documentId), markdownExport(content, h.state()));
});

test("guidance choices do not acquire exercise completion and removed deferred choices cannot be selected", async (t) => {
  const h = await harness(t);
  await h.select("access-management", "AM-03", "idp");
  const progress = summary(content, h.state())[0];
  assert.equal(progress.exercises.length, 0);
  assert.ok(progress.guidance.length);
  assert.match(await h.store.markdown(h.documentId), /Informational only; not configured or verified/);
  await h.select("access-management", "AM-01", "cohorts");
  assert.equal(configurationFor(content.paths[0], h.state().paths["access-management"]).exercises.length, 0);
  await assert.rejects(h.select("access-management", "AM-01", "review"), /valid policy decision/);
  assert.equal(summary(content, h.state())[0].decisions[0].deferred, false);
  assert.match(await h.store.markdown(h.documentId), /No applicable exercises/);
});

test("concurrent stale writes conflict without losing the accepted decision", async (t) => {
  const h = await harness(t);
  const responses = await Promise.allSettled([
    h.store.update(h.documentId, request(0, "one")),
    h.store.update(h.documentId, request(0, "cohorts")),
  ]);
  assert.equal(responses.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(responses.find((item) => item.status === "rejected").reason.statusCode, 409);
  const current = await h.refresh();
  assert.equal(current.revision, 1);
  assert.ok(["one", "cohorts"].includes(current.paths["access-management"].decisions["AM-01"]));
});

test("storage rejects unsafe document IDs and in-repository state paths", async (t) => {
  for (const id of ["../escape", "", "/absolute", "a/b", "a\\b", "a".repeat(81), null]) {
    assert.throws(() => validateDocumentId(id), /Invalid workshop document ID/);
  }
  assert.equal(validateDocumentId("workshop.1_test"), "workshop.1_test");
  assert.throws(() => createStore(fileURLToPath(new URL("../../", import.meta.url)), content), /outside the repository/);
  assert.throws(() => createStore("relative", content), /artifact workspace/);
  const h = await harness(t);
  await h.write({ version: 999 });
  const original = await h.disk();
  await assert.rejects(h.refresh(), /Preserve the file/);
  assert.equal(await h.disk(), original);
});

test("legacy foundation data is historical rather than new exercise completion", async (t) => {
  const h = await harness(t);
  const source = { version: 1, revision: 4, paths: Object.fromEntries(
    ["user-governance", "agent-governance", "context-management", "observability"].map((id) => [
      id, { understood: true, decision: "sandbox", configuration: "already_matches",
        verified: true, evidence: "Earlier foundation evidence" },
    ]),
  ) };
  await h.write(source);
  const before = await h.disk();
  const state = await h.refresh();
  assert.equal(state.version, 11);
  assert.equal(state.revision, 4);
  assert.ok(state.history.length);
  assert.ok(summary(content, state).every((path) => path.exercises.length === 0));
  assert.match(markdownExport(content, state), /Earlier foundation evidence/);
  assert.equal(await h.disk(), before);
});

test("archived billing records survive known migrations without answering a new decision", async (t) => {
  const h = await harness(t);
  const previous = legacyState(2);
  previous.paths["user-governance"].decisions["UG-03"] = "monitor";
  await h.write(previous);
  const state = await h.refresh();
  assert.ok(Object.values(state.paths["billing-cost-control"].decisions).every((value) => value === null));
  assert.match(JSON.stringify(state.history), /monitor/);
  assert.match(markdownExport(content, state), /Historical records/);
});

test("exports escape participant markup while preserving raw data in JSON", async (t) => {
  const h = await harness(t);
  await userExercise(h);
  const text = "<script>untrusted</script>\n# Heading [link](javascript:bad)";
  await h.verify("access-management", "AM-LAB", { evidence: text, issues: text, followUp: text });
  const markdown = await h.store.markdown(h.documentId);
  assert.doesNotMatch(markdown, /<script>/);
  assert.match(markdown, /&lt;script&gt;/);
  assert.match(markdown, /\\# Heading/);
  assert.equal((await h.store.export(h.documentId)).state.paths["access-management"].exercises["AM-LAB"].evidence, text);
});

test("participant target links accept only clean GitHub HTTPS targets", () => {
  assert.equal(safeSettingsUrl("https://github.com/settings/copilot"), "https://github.com/settings/copilot");
  for (const value of ["javascript:alert(1)", "https://github.com.evil.example/settings",
    "https://user:password@github.com/settings", "https://github.com:444/settings",
    "https://github.com/settings?token=secret", "https://github.com/",
    "http://github.com/settings", "https://github.com\\@evil.example/settings", "https://github.com/settings#token",
    " https://github.com/settings", null]) assert.equal(safeSettingsUrl(value), null);
});

test("invalid saved data exposes recovery guidance through bootstrap and exports", async (t) => {
  const h = await harness(t);
  await h.write("{broken");
  const entry = await openServer({ content, store: h.store, documentId: h.documentId, log: () => {} });
  t.after(() => new Promise((done) => { entry.server.close(done); entry.server.closeAllConnections(); }));
  for (const path of ["/api/bootstrap", "/api/export", "/api/export?format=markdown"]) {
    const response = await fetch(new URL(path, entry.url), { headers: { "X-Canvas-Token": entry.token } });
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /Preserve the file and contact the facilitator/);
  }
});

test("HTTP routes retain authentication, CSP, strict bodies, static bounds and exports", async (t) => {
  const h = await harness(t);
  const errors = [];
  const entry = await openServer({ content, store: h.store, documentId: h.documentId, log: (message) => errors.push(message) });
  t.after(() => new Promise((done) => { entry.server.close(done); entry.server.closeAllConnections(); }));
  const headers = { "X-Canvas-Token": entry.token };
  const get = (path, options = {}) => fetch(new URL(path, entry.url), options);
  const page = await get("/");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'; style-src 'self'/);
  assert.ok((await page.text()).includes(entry.token));
  for (const path of ["/api/bootstrap", "/api/export"]) {
    assert.equal((await get(path)).status, 403);
    assert.equal((await get(path, { headers: { ...headers, Origin: "https://example.com" } })).status, 403);
    assert.equal((await get(path, { headers })).status, 200);
  }
  const wrongHost = await new Promise((resolve, reject) => {
    const req = httpRequest(entry.url, { headers: { Host: "example.com" } }, (res) => {
      res.resume(); res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject); req.end();
  });
  assert.equal(wrongHost, 403);
  for (const path of ["/extension.mjs", "/state.mjs", "/%2e%2e%2fstate.mjs", "/lib/workshop-content.mjs", "/api/nope", "/api/scenario?path=observability"]) {
    assert.equal((await get(path, { headers })).status, 404);
  }
  for (const asset of ["/app.js", "/model.js", "/html.js", "/markdown.js", "/theme.js", "/styles.css", "/primer.css", "/lib/workshop-resolver.mjs"]) {
    assert.equal((await get(asset)).status, 200);
  }
  const bootstrap = await (await get("/api/bootstrap", { headers })).json();
  assert.deepEqual(bootstrap.content.paths.map((path) => path.stages.understand.markdown),
    content.paths.map((path) => path.stages.understand.markdown));
  const post = (body, customHeaders = headers) => get("/api/progress", { method: "POST", headers: customHeaders, body });
  assert.equal((await post(JSON.stringify(request(0)), {})).status, 403);
  for (const body of ["{", "null", "[]", "true"]) assert.equal((await post(body)).status, 400);
  assert.equal((await post(JSON.stringify({ text: "x".repeat(70000) }))).status, 413);
  assert.equal((await post(JSON.stringify(request(0)))).status, 200);
  assert.equal((await post(JSON.stringify(request(0)))).status, 409);
  const exported = await get("/api/export", { headers });
  assert.match(exported.headers.get("content-disposition"), /attachment/);
  assert.equal((await exported.json()).state.revision, 1);
  const markdown = await get("/api/export?format=markdown", { headers });
  assert.match(markdown.headers.get("content-type"), /text\/markdown/);
  assert.match(await markdown.text(), /One policy for everyone/);
  assert.equal((await get("/api/export?format=xml", { headers })).status, 400);
  assert.deepEqual(errors, []);
});
