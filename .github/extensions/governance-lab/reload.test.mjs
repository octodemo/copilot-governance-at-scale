import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createWorkshop, loadContent } from "./content.mjs";
import { openServer } from "./server.mjs";
import { createStore } from "./state.mjs";
import { workspaceFor } from "../../../tests/content-validation/exercise-helpers.mjs";

const fixture = fileURLToPath(new URL("../../../tests/content-validation/fixtures/content-format/valid/", import.meta.url));

async function serve(t, { dev = true, sendToAgent, lineEnding } = {}) {
  const root = await mkdtemp(join(tmpdir(), "governance-reload-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixture, root, { recursive: true });
  const source = join(root, "content/example-block.md");
  if (lineEnding) await writeFile(source, (await readFile(source, "utf8")).replace(/\r\n/g, "\n").replace(/\n/g, lineEnding));
  const workspace = await workspaceFor(t);
  const workshop = await createWorkshop({ load: () => loadContent({ root }), createStore: (content) => createStore(workspace, content) });
  const attached = [];
  const entry = await openServer({ workshop, documentId: "reload", dev, contentRoot: root,
    sendToAgent: sendToAgent === undefined ? async (message) => { attached.push(message); } : sendToAgent });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((done) => entry.server.close(done)); });
  const call = (path, body) => fetch(new URL(path, entry.url), {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-Canvas-Token": entry.token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { call, entry, workspace, attached, source };
}
const understand = (content) => content.paths.find((path) => path.id === "example-block").stages.understand.markdown;

test("reload discovers new Markdown decisions and preserves saved progress; reset only clears state", async (t) => {
  const { call, source, workspace } = await serve(t);
  const initial = await (await call("/api/bootstrap")).json();
  assert.match(understand(initial.content), /Read this fictional example\./);
  assert.match(initial.content.version, /^sha256:[a-f0-9]{64}$/);
  const saved = await (await call("/api/progress", { contentVersion: initial.content.version, revision: initial.state.revision, pathId: "example-block",
    decisionId: "EX-01", exerciseId: null, operation: "decide", value: "mixed" })).json();
  assert.equal(saved.revision, 1);
  const edited = (await readFile(source, "utf8")).replace("Read this fictional example.", "Edited introduction.");
  const addedDecision = edited.slice(edited.indexOf("### Decision: EX-02"), edited.indexOf("## Configure")).replace("EX-02", "EX-03");
  await writeFile(source, edited.replace("## Configure", `${addedDecision}\n## Configure`));
  assert.match(understand((await (await call("/api/bootstrap")).json()).content), /Read this fictional example\./);
  const reload = await call("/api/reload-content", {});
  assert.equal(reload.status, 200);
  const body = await reload.json();
  assert.match(understand(body.content), /Edited introduction\./);
  assert.ok(body.content.paths[0].decisions.some((decision) => decision.id === "EX-03"));
  assert.equal(body.state.paths["example-block"].decisions["EX-01"], "mixed");
  assert.equal(body.state.paths["example-block"].decisions["EX-03"], null);
  assert.equal(body.state.revision, saved.revision);
  await writeFile(source, "Invalid Markdown should not block reset.");
  const reset = await call("/api/dev/reset", { revision: body.state.revision });
  assert.equal(reset.status, 200);
  const cleared = await reset.json();
  assert.equal(cleared.content.version, body.content.version);
  assert.equal(cleared.state.paths["example-block"].decisions["EX-01"], null);
  assert.equal(cleared.state.history.length, 0);
  assert.equal(cleared.state.revision, saved.revision + 1);
  const after = await (await call("/api/bootstrap")).json();
  assert.match(understand(after.content), /Edited introduction\./);
  assert.deepEqual(after.state, cleared.state);
  assert.deepEqual(JSON.parse(await readFile(join(workspace, "files", "governance-workshop", "reload.json"), "utf8")), cleared.state);
  const files = await readdir(join(workspace, "files", "governance-workshop"));
  const backup = files.find((name) => name.startsWith("reload.json.reset-") && name.endsWith(".bak"));
  assert.ok(backup, `expected a reset backup in ${files.join(", ")}`);
  assert.equal(JSON.parse(await readFile(join(workspace, "files", "governance-workshop", backup), "utf8")).paths["example-block"].decisions["EX-01"], "mixed");
});

test("saves bound to content replaced by reload are rejected before applying", async (t) => {
  const { call, source } = await serve(t);
  const stale = await (await call("/api/bootstrap")).json();
  await writeFile(source, (await readFile(source, "utf8")).replace("Interpret the fictional records.", "Interpret the revised records."));
  const reloaded = await (await call("/api/reload-content", {})).json();
  assert.notEqual(reloaded.content.version, stale.content.version);
  assert.equal(reloaded.state.revision, 0);
  const decide = { pathId: "example-block", decisionId: "EX-01", exerciseId: null, operation: "decide", value: "mixed" };
  for (const contentVersion of [stale.content.version, undefined]) {
    const rejected = await call("/api/progress", { contentVersion, revision: 0, ...decide });
    assert.equal(rejected.status, 409);
    assert.match((await rejected.json()).message, /content was reloaded/i);
  }
  const unchanged = await (await call("/api/bootstrap")).json();
  assert.equal(unchanged.state.revision, 0);
  assert.equal(unchanged.state.paths["example-block"].decisions["EX-01"], null);
  const accepted = await call("/api/progress", { contentVersion: reloaded.content.version, revision: 0, ...decide });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).paths["example-block"].decisions["EX-01"], "mixed");
});

test("an unchanged reload keeps the content version", async (t) => {
  const { call } = await serve(t);
  const before = await (await call("/api/bootstrap")).json();
  assert.equal((await (await call("/api/reload-content", {})).json()).content.version, before.content.version);
});

test("invalid authored content is reported and the previous content stays active", async (t) => {
  const { call, source } = await serve(t);
  await writeFile(source, (await readFile(source, "utf8")).replace("Read this fictional example.", "Kept text.").replace("## Validation", "## Removed"));
  const failed = await call("/api/reload-content", {});
  assert.equal(failed.status, 422);
  const { message } = await failed.json();
  assert.match(message, /previous content and progress remain active/);
  assert.match(message, /example-block\.md/);
  assert.match(understand((await (await call("/api/bootstrap")).json()).content), /Read this fictional example\./);
});

test("reload and reset require the canvas token and dev mode", async (t) => {
  const { entry } = await serve(t);
  const participant = await serve(t, { dev: false });
  for (const path of ["/api/dev/reset", "/api/reload-content"]) {
    assert.equal((await fetch(new URL(path, entry.url), { method: "POST" })).status, 403);
    assert.equal((await participant.call(path, {})).status, 404);
  }
  const fixed = await openServer({ content: { paths: [] }, store: { read: async () => ({}) }, documentId: "fixed", dev: true });
  t.after(() => { fixed.server.closeAllConnections(); return new Promise((done) => fixed.server.close(done)); });
  const response = await fetch(new URL("/api/reload-content", fixed.url), { method: "POST", headers: { "X-Canvas-Token": fixed.token } });
  assert.equal(response.status, 404);
});

test("reset rejects invalid requests and stale saves, including when no work was saved", async (t) => {
  const { call } = await serve(t);
  const initial = await (await call("/api/bootstrap")).json();
  for (const input of [{}, { revision: -1 }, { revision: 0, extra: true }]) {
    assert.equal((await call("/api/dev/reset", input)).status, 400);
  }
  assert.equal((await call("/api/dev/reset", { revision: 10 })).status, 409);
  const reset = await (await call("/api/dev/reset", { revision: 0 })).json();
  assert.equal(reset.state.revision, 1);
  assert.equal((await call("/api/progress", { contentVersion: initial.content.version, revision: 0, pathId: "example-block",
    decisionId: "EX-01", exerciseId: null, operation: "decide", value: "mixed" })).status, 409);
  assert.equal((await call("/api/dev/reset", { revision: 0 })).status, 409);
  assert.equal((await (await call("/api/bootstrap")).json()).state.paths["example-block"].decisions["EX-01"], null);
});

test("loading pre-change Observability progress archives only ambiguous OB-06 answers", async (t) => {
  const content = await loadContent();
  const path = content.paths.find((item) => item.id === "observability");
  assert.ok(path?.decisions.some((item) => item.id === "OB-02"));
  assert.ok(path?.decisions.some((item) => item.id === "OB-03"));
  const workspace = await workspaceFor(t);
  const store = createStore(workspace, content);
  const directory = join(workspace, "files", "governance-workshop");
  await mkdir(directory, { recursive: true });
  const priorOptions = ["no-org-access", "selected-orgs", "all-orgs", "review"];
  const currentOptions = path.decisions.find((item) => item.id === "OB-02").options.map((item) => item.id);
  assert.notDeepEqual(currentOptions, priorOptions);
  assert.ok(currentOptions.includes("enabled"));
  assert.ok(!currentOptions.includes("review"));
  const currentSelection = currentOptions[0];

  const cases = [
    ["legacy-selected", "selected-orgs", null, true, true],
    ["legacy-disabled", "no-org-access", null, true, true],
    ["legacy-everywhere", "all-orgs", "enabled", false, false],
    ["legacy-review", "review", null, true, false],
  ];
  for (const [documentId, oldAnswer, expectedAnswer, archived, reselected] of cases) {
    const saved = await store.read(documentId);
    const earlierId = { "OB-01": "OB-03", "OB-02": "OB-06", "OB-03": "OB-05",
      "OB-04": "OB-07", "OB-05": "OB-08", "OB-06": "OB-04" };
    for (const decisions of [saved.schema.observability, saved.paths.observability]) {
      decisions.decisions = Object.fromEntries(Object.entries(decisions.decisions).map(([id, value]) => [earlierId[id], value]));
    }
    saved.schema.observability.decisions["OB-06"] = [...priorOptions];
    const fingerprint = saved.schema.observability.exercises["OB-DASHBOARDS"].fingerprint;
    saved.schema.observability.exercises["OB-DASHBOARDS"].fingerprint =
      fingerprint === `sha256:${"0".repeat(64)}` ? `sha256:${"1".repeat(64)}` : `sha256:${"0".repeat(64)}`;
    saved.paths.observability.decisions["OB-06"] = oldAnswer;
    saved.paths.observability.decisions["OB-05"] = path.decisions.find((item) => item.id === "OB-03").options[0].id;
    saved.paths.observability.exercises["OB-USAGE-EXPORT"].issues = "Unrelated participant note";
    await writeFile(join(directory, `${documentId}.json`), `${JSON.stringify(saved)}\n`);

    const migrated = await store.read(documentId);
    assert.equal(migrated.paths.observability.decisions["OB-02"], expectedAnswer);
    assert.equal(migrated.paths.observability.decisions["OB-03"], saved.paths.observability.decisions["OB-05"]);
    assert.equal(migrated.paths.observability.exercises["OB-USAGE-EXPORT"].issues, "Unrelated participant note");
    assert.equal(migrated.history.filter((item) => item.reason ===
      "Observability dashboard decision changed; previous answer requires fresh selection").length, reselected ? 1 : 0);
    if (archived) {
      assert.ok(migrated.history.some((item) => item.data.pathId === "observability" &&
        item.data.decisionId === "OB-06" && item.data.value === oldAnswer));
    }

    const updated = await store.update(documentId, { revision: migrated.revision, pathId: "observability",
      decisionId: "OB-02", exerciseId: null, operation: "decide", value: currentSelection });
    const reloaded = await store.read(documentId);
    assert.equal(reloaded.paths.observability.decisions["OB-02"], currentSelection);
    assert.equal(reloaded.history.filter((item) => item.reason ===
      "Observability dashboard decision changed; previous answer requires fresh selection").length, reselected ? 1 : 0);
    assert.equal(reloaded.revision, updated.revision);
  }
});

test("the page exposes dev mode only when enabled", async (t) => {
  const dev = await serve(t);
  assert.match(await (await fetch(dev.entry.url)).text(), /name="canvas-dev" content="true"/);
  const participant = await serve(t, { dev: false });
  assert.match(await (await fetch(participant.entry.url)).text(), /name="canvas-dev" content="false"/);
});

const one = (source, contentVersion, prompt = "Tighten this wording.") => ({ requests: [{ ...source, contentVersion, prompt }] });
const route = "/api/dev/send-requests";

for (const [ending, lineEnding] of [["LF", "\n"], ["CRLF", "\r\n"]]) test(`send-requests submits a linked, verbatim prompt with the exact section as a selection (${ending})`, async (t) => {
  const { call, attached, source } = await serve(t, { lineEnding });
  const { content } = await (await call("/api/bootstrap")).json();
  const decision = content.paths[0].decisions[0], option = decision.options[0];
  const lines = (await readFile(source, "utf8")).split(/\r?\n/);
  for (const [node, label] of [[decision, `Decision ${decision.id}`], [option, "Answer"], [content.paths[0].stages.understand, "Understand"]]) {
    const response = await call(route, one({ file: node.source.file, line: node.source.line, endLine: node.source.endLine, label }, content.version));
    assert.equal(response.status, 200);
    const { prompt, attachments: [sent, ...rest] } = attached.at(-1);
    assert.equal(rest.length, 0);
    assert.equal(sent.type, "selection");
    assert.equal(sent.filePath, source);
    assert.equal(sent.text.split("\n")[0], lines[node.source.line - 1]);
    assert.equal(sent.text, lines.slice(node.source.line - 1, sent.selection.end.line + 1).join("\n"));
    assert.ok(sent.selection.end.line <= node.source.endLine - 1);
    assert.equal(sent.selection.start.line, node.source.line - 1);
    assert.match(sent.displayName, new RegExp(`example-block\\.md · ${label}`));
    const last = sent.selection.end.line + 1, file = node.source.file;
    assert.equal(prompt, `[${file} (L${node.source.line}–${last})](${file}#L${node.source.line}-L${last})\nTighten this wording.`);
    assert.deepEqual(await response.json(), { count: 1 });
  }
  assert.match(attached[0].attachments[0].text, new RegExp(`^### Decision: ${decision.id}`));
});

test("send-requests joins batched prompts verbatim and deduplicates repeated sections", async (t) => {
  const { call, attached } = await serve(t);
  const { content } = await (await call("/api/bootstrap")).json();
  const decision = content.paths[0].decisions[0].source, option = content.paths[0].decisions[0].options[0].source;
  const at = ({ file, line, endLine }) => ({ file, line, endLine });
  const verbatim = "  First line\n\n- keep *this* `as is`  ";
  const response = await call(route, { requests: [
    { ...at(decision), contentVersion: content.version, label: "Decision", prompt: verbatim },
    { ...at(option), contentVersion: content.version, prompt: "Second" },
    { ...at(decision), contentVersion: content.version, label: "Decision", prompt: "Third" },
  ] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { count: 3 });
  assert.equal(attached.length, 1);
  const { prompt, attachments } = attached[0];
  assert.equal(attachments.length, 2);
  const blocks = prompt.split(/\n\n(?=\[)/);
  assert.equal(blocks.length, 3);
  assert.ok(blocks[0].endsWith(`)\n${verbatim}`));
  assert.match(blocks[1], /\)\nSecond$/);
  assert.match(blocks[2], /\)\nThird$/);
  assert.equal(blocks[0].split("\n")[0], blocks[2].split("\n")[0]);
});

test("send-requests only accepts loaded sources, rejects stale files, and needs dev mode and the token", async (t) => {
  const { call, attached, source, entry } = await serve(t);
  const { content } = await (await call("/api/bootstrap")).json();
  const { file, line, endLine } = content.paths[0].decisions[0].source;
  for (const input of [{ file: "../../etc/passwd.md", line, endLine }, { file, line: line + 1, endLine }, { file: "content/manifest.json", line: 1, endLine: 2 }]) {
    const response = await call(route, one(input, content.version));
    assert.equal(response.status, 404);
    assert.match((await response.json()).message, /^Request 1: /);
  }
  for (const input of [{}, { file, line, endLine }, { requests: [] }, { requests: [null] }, one({ file, line: "1", endLine }, content.version), one({ file, line, endLine, extra: true }, content.version), one({ file, line: 0, endLine }, content.version), one({ file, line, endLine }, content.version, "   "), one({ file, line, endLine }, content.version, "x".repeat(4001)), { requests: Array.from({ length: 21 }, () => ({ file, line, endLine, contentVersion: content.version, prompt: "x" })) }]) {
    assert.equal((await call(route, input)).status, 400, JSON.stringify(input).slice(0, 80));
  }
  assert.equal((await fetch(new URL(route, entry.url), { method: "POST", body: JSON.stringify(one({ file, line, endLine }, content.version)) })).status, 403);
  await writeFile(source, `${await readFile(source, "utf8")}\n`);
  const stale = await call(route, one({ file, line, endLine }, content.version));
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).message, /Reload content/);
  assert.equal(attached.length, 0);
  const participant = await serve(t, { dev: false });
  assert.equal((await participant.call(route, one({ file, line, endLine }))).status, 404);
});

test("send-requests reports a missing or failing host hook", async (t) => {
  const missing = await serve(t, { sendToAgent: null });
  const { content } = await (await missing.call("/api/bootstrap")).json();
  const { file, line, endLine } = content.paths[0].decisions[0].source;
  assert.equal((await missing.call(route, one({ file, line, endLine }, content.version))).status, 501);
  const failing = await serve(t, { sendToAgent: async () => { throw new Error("nope"); } });
  const { content: failingContent } = await (await failing.call("/api/bootstrap")).json();
  const response = await failing.call(route, one({ file, line, endLine }, failingContent.version));
  assert.equal(response.status, 502);
  assert.match((await response.json()).message, /nope/);
});
