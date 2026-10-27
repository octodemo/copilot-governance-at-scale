import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { content, harness, legacyState, workspaceFor } from "../../../tests/content-validation/exercise-helpers.mjs";
import { createStore } from "./state.mjs";
import { importSessionDocument, lockDocument, participantWorkspace } from "./storage.mjs";

test("participant storage uses the user extension directory, not a session or checkout", () => {
  assert.equal(participantWorkspace(homedir()), resolve(homedir(), "extensions/governance-lab/artifacts"));
  assert.throws(() => participantWorkspace("relative"), /absolute/);
});

test("answers, profile, checklist, notes and history survive a new store and panel", async (t) => {
  const old = await harness(t);
  await old.select("access-management", "AM-01", "one");
  await old.select("access-management", "AM-02", "central-org");
  await old.configure("access-management", "AM-LAB", { issues: "Retained note", followUp: "Retained follow-up" });
  const state = await old.store.update(old.documentId, {
    revision: old.state().revision, pathId: "access-management", decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId: "recipe:am-lab-exercise", done: true },
  });
  await old.store.updateProfile(old.documentId, {
    revision: state.revision, profile: { enterpriseSlug: "example", organizationSlug: "example-org" },
  });
  const workspace = participantWorkspace(await workspaceFor(t));
  await importSessionDocument({ workspace, legacyWorkspace: old.workspace, documentId: old.documentId, content, createStore });
  const expected = await old.store.read(old.documentId);
  assert.deepEqual(await createStore(workspace, content).read(old.documentId), expected);
  assert.equal(await readFile(join(workspace, "files/governance-workshop/test.json"), "utf8"), await old.disk());
  const unrelatedSession = await workspaceFor(t);
  await importSessionDocument({ workspace, legacyWorkspace: unrelatedSession, documentId: old.documentId, content, createStore });
  assert.deepEqual(await createStore(workspace, content).read(old.documentId), expected);
  const otherDocument = await createStore(workspace, content).read("another-attempt");
  assert.equal(otherDocument.paths["access-management"].decisions["AM-01"], null);
  assert.equal(otherDocument.revision, 0);
});

test("session import validates legacy records, preserves originals and never overwrites durable progress", async (t) => {
  const old = await harness(t);
  const workspace = participantWorkspace(await workspaceFor(t));
  const importing = () => importSessionDocument({ workspace, legacyWorkspace: old.workspace, documentId: old.documentId, content, createStore });
  for (const raw of ["{broken", JSON.stringify({ version: 999 }), JSON.stringify({ version: 11 })]) {
    await old.write(raw);
    await assert.rejects(importing(), /Preserve the file/);
    await assert.rejects(readFile(join(workspace, "files/governance-workshop/test.json")), { code: "ENOENT" });
    assert.equal(await old.disk(), raw);
  }
  await old.write(legacyState(8, true));
  const original = await old.disk();
  await Promise.all([importing(), importing()]);
  const durable = createStore(workspace, content);
  const state = await durable.read(old.documentId);
  assert.equal(state.version, 11);
  assert.ok(state.history.length > 0);
  assert.equal(await old.disk(), original);
  const saved = await durable.updateProfile(old.documentId, {
    revision: state.revision, profile: { enterpriseSlug: "retained", organizationSlug: "" },
  });
  await old.write("{broken");
  await importing();
  assert.deepEqual(await createStore(workspace, content).read(old.documentId), saved);
  assert.equal((await readdir(join(workspace, "files/governance-workshop"))).some((name) => name.endsWith(".lock") || name.endsWith(".pending")), false);
});

test("independent provider processes serialize decisions, profiles and reset before checking revisions", async (t) => {
  const workspace = await workspaceFor(t);
  const store = createStore(workspace, content);
  const initial = await store.updateProfile("shared", {
    revision: 0, profile: { enterpriseSlug: "retained", organizationSlug: "retained-org" },
  });
  const file = join(workspace, "files/governance-workshop/shared.json");
  const release = await lockDocument(file);
  let held = true;
  t.after(async () => {
    if (held) await release();
  });
  const worker = `
    import { createStore } from ${JSON.stringify(new URL("./state.mjs", import.meta.url).href)};
    import { loadContent } from ${JSON.stringify(new URL("./content.mjs", import.meta.url).href)};
    const store = createStore(process.argv[1], await loadContent());
    process.stdout.write("ready\\n");
    try {
      const revision = ${initial.revision};
      const operation = process.argv[2];
      if (operation === "decide") await store.update("shared", { revision, pathId: "access-management",
        decisionId: "AM-01", exerciseId: null, operation, value: "one" });
      else if (operation === "profile") await store.updateProfile("shared", { revision,
        profile: { enterpriseSlug: "changed", organizationSlug: "changed-org" } });
      else await store.resetDocument("shared", { revision });
      process.stdout.write("saved\\n");
    } catch (error) {
      if (error.statusCode !== 409 || !/another panel/.test(error.message)) throw error;
      process.stdout.write("stale\\n");
    }
  `;
  const workers = ["decide", "profile", "reset"].map((operation) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", worker, workspace, operation], { stdio: ["ignore", "pipe", "pipe"] });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let output = "", errors = "";
    const ready = new Promise((done) => child.stdout.once("data", done));
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", (data) => { errors += data; });
    const finished = once(child, "exit").then(([code]) => { assert.equal(code, 0, errors); return output; });
    return { ready, finished };
  });
  await Promise.all(workers.map((worker) => worker.ready));
  await release();
  held = false;
  const results = await Promise.all(workers.map((worker) => worker.finished));
  assert.equal(results.filter((result) => result.includes("saved")).length, 1);
  assert.equal(results.filter((result) => result.includes("stale")).length, 2);
  assert.equal((await createStore(workspace, content).read("shared")).revision, initial.revision + 1);
  assert.equal((await readdir(join(workspace, "files/governance-workshop"))).some((name) => name.endsWith(".lock")), false);
});

test("storage write errors are surfaced without an in-session fallback", async (t) => {
  const home = await workspaceFor(t);
  const workspace = participantWorkspace(home);
  await mkdir(join(home, "extensions"), { recursive: true });
  await writeFile(join(home, "extensions/governance-lab"), "not a directory");
  await assert.rejects(createStore(workspace, content).updateProfile("test", {
    revision: 0, profile: { enterpriseSlug: "", organizationSlug: "" },
  }), { code: "ENOTDIR" });
});
