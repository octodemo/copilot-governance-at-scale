import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { workspaceFor } from "./exercise-helpers.mjs";
import { participantWorkspace } from "../../.github/extensions/governance-lab/storage.mjs";

test("native handlers resolve payloads, preserve trust labels, and propagate failures", async (t) => {
  const workspace = await workspaceFor(t);
  const previousHome = process.env.COPILOT_HOME;
  process.env.COPILOT_HOME = await workspaceFor(t);
  t.after(() => {
    if (previousHome === undefined) delete process.env.COPILOT_HOME;
    else process.env.COPILOT_HOME = previousHome;
  });
  const key = "__governanceActionTest";
  globalThis[key] = { workspace };
  const sdk = `data:text/javascript,${encodeURIComponent(`
    export class CanvasError extends Error {
      constructor(code, message) { super(message); this.code = code; }
    }
    export const createCanvas = value => value;
    export async function joinSession(config) {
      globalThis.${key}.config = config;
      return { workspacePath: globalThis.${key}.workspace, log() {} };
    }
  `)}`;
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === "@github/copilot-sdk/extension" ?
        { url: sdk, shortCircuit: true } : nextResolve(specifier, context);
    }
  });
  t.after(async () => {
    hook.deregister();
    delete globalThis[key];
  });
  await import("../../.github/extensions/governance-lab/extension.mjs");
  const canvas = globalThis[key].config.canvases[0];
  const progress = canvas.actions.find((action) => action.name === "get_progress");
  const exported = canvas.actions.find((action) => action.name === "export_summary");
  const update = canvas.actions.find((action) => action.name === "update_progress");
  for (const action of [progress, exported, update]) {
    await assert.rejects(action.handler({ instanceId: "missing", input: {} }), { code: "not_open" });
  }
  const ctx = { instanceId: "test", input: { documentId: "test" } };
  const opened = await canvas.open(ctx);
  t.after(() => canvas.onClose(ctx));
  const assertDevMode = async (panel, enabled) => {
    const html = await (await fetch(panel.url)).text();
    assert.match(html, new RegExp(`name="canvas-dev" content="${enabled}"`));
    const token = html.match(/name="canvas-token" content="([^"]+)"/)[1];
    const routes = enabled ? [["GET", "/api/dev/snapshots"]] : [
      ["POST", "/api/reload-content"], ["POST", "/api/dev/reset"],
      ["GET", "/api/dev/snapshots"], ["POST", "/api/dev/snapshots/save"],
      ["POST", "/api/dev/snapshots/restore"], ["POST", "/api/dev/send-requests"],
    ];
    for (const [method, path] of routes) {
      const response = await fetch(new URL(path, panel.url), {
        method, headers: { "X-Canvas-Token": token },
      });
      assert.equal(response.status, enabled ? 200 : 404, `${method} ${path}`);
      await response.text();
    }
  };
  await assertDevMode(opened, false);
  const result = JSON.parse(JSON.stringify(await progress.handler(ctx)));
  assert.equal(result.untrusted, true);
  assert.equal(result.data.version, 11);
  assert.match(result.contentVersion, /^sha256:[a-f0-9]{64}$/);
  assert.equal(result.data.paths["agent-governance"].decisions["AG-01"], null);
  assert.equal(result.data.paths["access-management"].decisions["AM-01"], null);
  assert.ok(Object.values(result.data.paths["billing-cost-control"].decisions).every((value) => value === null));
  const json = JSON.parse(JSON.stringify(await exported.handler({ ...ctx, input: { format: "json" } })));
  assert.equal(json.data.format, "copilot-governance-workshop");
  const markdown = await exported.handler({ ...ctx, input: { format: "markdown" } });
  assert.equal(markdown.untrusted, true);
  assert.match(markdown.data, /# Copilot Governance Workshop/);
  const input = { contentVersion: result.contentVersion, revision: 0, pathId: "access-management", decisionId: "AM-01", exerciseId: null, operation: "decide", value: "one" };
  const changed = await update.handler({ ...ctx, input });
  assert.equal(changed.untrusted, true);
  assert.equal(changed.data.paths["access-management"].decisions["AM-01"], "one");
  assert.equal(changed.contentVersion, result.contentVersion);
  const prepared = await update.handler({ ...ctx, input: { ...input, revision: changed.data.revision, decisionId: "AM-02", value: "central-org" } });
  const marked = await update.handler({ ...ctx, input: {
    contentVersion: result.contentVersion, revision: prepared.data.revision, pathId: "access-management",
    decisionId: null, exerciseId: null, operation: "checklist", value: { stepId: "recipe:am-lab-exercise", done: false },
  } });
  assert.equal(marked.data.checklist[0].done, false);
  await assert.rejects(update.handler({ ...ctx, input: { ...input, revision: 1, contentVersion: "sha256:stale" } }), { statusCode: 409, message: /content was reloaded/ });
  await assert.rejects(update.handler({ ...ctx, input: { ...input, revision: 1, decisionId: null, exerciseId: null, operation: "configure", value: {} } }), /explicit exercise/);
  let previousPanel = opened;
  for (const dev of [true, undefined, true, false]) {
    const panel = await canvas.open({ ...ctx, input: { ...ctx.input, ...(dev === undefined ? {} : { dev }) } });
    assert.notEqual(panel.url, previousPanel.url);
    await assertDevMode(panel, dev === true);
    assert.deepEqual(await progress.handler(ctx), marked);
    previousPanel = panel;
  }
  assert.deepEqual(await canvas.open(ctx), previousPanel);
  await canvas.onClose(ctx);
  globalThis[key].workspace = await workspaceFor(t);
  await import("../../.github/extensions/governance-lab/extension.mjs?restarted");
  const restarted = globalThis[key].config.canvases[0];
  const reopened = { instanceId: "different-panel", input: { documentId: "test" } };
  await restarted.open(reopened);
  t.after(() => restarted.onClose(reopened));
  const restored = await restarted.actions.find((action) => action.name === "get_progress").handler(reopened);
  assert.deepEqual(restored, marked);
  const directory = join(participantWorkspace(), "files", "governance-workshop");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "test.json"), "{broken");
  for (const name of ["get_progress", "export_summary"]) {
    await assert.rejects(restarted.actions.find((action) => action.name === name).handler(reopened), /Preserve the file/);
  }
});
