import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { content, harness } from "../../../tests/content-validation/exercise-helpers.mjs";
import { createStore } from "./state.mjs";
import { openServer } from "./server.mjs";

test("named states survive restarts and repeated restores, retain the entire state and back up replaced progress", async (t) => {
  const h = await harness(t);
  await h.select("access-management", "AM-01", "one");
  await h.select("access-management", "AM-02", "central-org");
  await h.configure("access-management", "AM-LAB", { issues: "Saved note", followUp: "Saved follow-up" });
  let state = await h.store.update(h.documentId, {
    revision: h.state().revision, pathId: "access-management", decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId: "recipe:am-lab-exercise", done: true },
  });
  state = await h.store.updateProfile(h.documentId, {
    revision: state.revision, profile: { enterpriseSlug: "saved-enterprise", organizationSlug: "saved-org" },
  });
  const input = { revision: state.revision, name: "Access demo 1" };
  assert.deepEqual(await h.store.listSnapshots(), []);
  assert.deepEqual(await h.store.saveSnapshot(h.documentId, input), { name: input.name });
  assert.deepEqual(await h.store.read(h.documentId), state);
  const store = createStore(h.workspace, content);
  assert.deepEqual(await store.listSnapshots(), [input.name]);
  const directory = join(h.workspace, "files/governance-workshop");
  const snapshot = join(directory, "snapshots", `${input.name}.json`);
  const original = await readFile(snapshot, "utf8");
  await assert.rejects(store.saveSnapshot(h.documentId, input), { statusCode: 409, message: /already exists/ });
  assert.equal(await readFile(snapshot, "utf8"), original);
  const reset = await store.resetDocument(h.documentId, { revision: state.revision });
  const restored = await store.restoreSnapshot(h.documentId, { name: input.name, revision: reset.revision });
  assert.deepEqual(restored, { ...state, revision: reset.revision + 1 });
  const backups = (await readdir(directory)).filter((name) => name.includes(".restore-"));
  assert.equal(backups.length, 1);
  assert.deepEqual(JSON.parse(await readFile(join(directory, backups[0]), "utf8")), reset);
  await assert.rejects(store.updateProfile(h.documentId, { revision: reset.revision, profile: state.profile }), { statusCode: 409 });
  const again = await store.restoreSnapshot(h.documentId, { name: input.name, revision: restored.revision });
  assert.deepEqual(again, { ...state, revision: restored.revision + 1 });
  assert.equal(await readFile(snapshot, "utf8"), original);
  const other = await store.restoreSnapshot("another-attempt", { name: input.name, revision: 0 });
  assert.deepEqual(other, { ...state, revision: 1 });
});

test("snapshot restore reconciles changed content without reviving obsolete completion", async (t) => {
  const h = await harness(t);
  await h.select("access-management", "AM-01", "one");
  await h.select("access-management", "AM-02", "central-org");
  const marked = await h.store.update(h.documentId, {
    revision: h.state().revision, pathId: "access-management", decisionId: null, exerciseId: null,
    operation: "checklist", value: { stepId: "recipe:am-lab-exercise", done: true },
  });
  await h.store.saveSnapshot(h.documentId, { name: "Before edits", revision: marked.revision });
  const changed = structuredClone(content);
  const recipe = changed.paths.find((path) => path.id === "access-management").recipes.find((recipe) => recipe.id === "am-lab-exercise");
  recipe.fingerprint = `sha256:${"a".repeat(64)}`;
  const store = createStore(h.workspace, changed);
  const restored = await store.restoreSnapshot(h.documentId, { name: "Before edits", revision: marked.revision });
  assert.equal(restored.paths["access-management"].decisions["AM-01"], "one");
  assert.equal(restored.checklist.some((item) => item.done), false);
  assert.ok(restored.history.some((item) => item.reason.includes("checklist changed")));
});

test("invalid names, stale revisions, missing or corrupt snapshots never change active progress", async (t) => {
  const h = await harness(t);
  const initial = await h.store.read(h.documentId);
  for (const name of ["", "../escape", "/absolute", "trailing ", "<script>", "x".repeat(81)]) {
    await assert.rejects(h.store.saveSnapshot(h.documentId, { name, revision: 0 }), { statusCode: 400 });
    await assert.rejects(h.store.restoreSnapshot(h.documentId, { name, revision: 0 }), { statusCode: 400 });
  }
  for (const input of [{}, { name: "Demo", revision: -1 }, { name: "Demo", revision: 0, extra: true }]) {
    await assert.rejects(h.store.saveSnapshot(h.documentId, input), { statusCode: 400 });
    await assert.rejects(h.store.restoreSnapshot(h.documentId, input), { statusCode: 400 });
  }
  await assert.rejects(h.store.saveSnapshot(h.documentId, { name: "Demo", revision: 9 }), { statusCode: 409 });
  await assert.rejects(h.store.restoreSnapshot(h.documentId, { name: "Missing", revision: 0 }), { statusCode: 404 });
  await h.store.saveSnapshot(h.documentId, { name: "Demo", revision: 0 });
  await assert.rejects(h.store.restoreSnapshot(h.documentId, { name: "Demo", revision: 9 }), { statusCode: 409 });
  const file = join(h.workspace, "files/governance-workshop/snapshots/Demo.json");
  for (const raw of ["{broken", '{"version":999}', '{"version":11}', '{"version":8}']) {
    await writeFile(file, raw);
    await assert.rejects(h.store.restoreSnapshot(h.documentId, { name: "Demo", revision: 0 }), /Preserve the file/);
    assert.deepEqual(await h.store.read(h.documentId), initial);
    assert.equal(await readFile(file, "utf8"), raw);
  }
  assert.equal((await readdir(join(h.workspace, "files/governance-workshop"))).some((name) => name.includes(".restore-") || name.endsWith(".lock")), false);
});

test("simultaneous saves publish one complete snapshot without overwriting it", async (t) => {
  const h = await harness(t);
  const results = await Promise.allSettled(["one", "two"].map((id) =>
    h.store.saveSnapshot(id, { name: "Shared name", revision: 0 })));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.statusCode, 409);
  assert.deepEqual(await h.store.listSnapshots(), ["Shared name"]);
  assert.equal((await h.store.restoreSnapshot(h.documentId, { name: "Shared name", revision: 0 })).version, 11);
  assert.deepEqual(await readdir(join(h.workspace, "files/governance-workshop/snapshots")), ["Shared name.json"]);
});

test("snapshot HTTP routes require dev mode, token, content version, names and revisions", async (t) => {
  const h = await harness(t);
  const serve = async (dev) => {
    const entry = await openServer({ content, store: h.store, documentId: h.documentId, dev });
    t.after(() => { entry.server.closeAllConnections(); return new Promise((done) => entry.server.close(done)); });
    const call = (path, input, token = entry.token) => fetch(new URL(path, entry.url), {
      method: input === undefined ? "GET" : "POST",
      headers: { "X-Canvas-Token": token, "Content-Type": "application/json" },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    return call;
  };
  const dev = await serve(true), participant = await serve(false);
  for (const [path, input] of [
    ["/api/dev/snapshots", undefined],
    ["/api/dev/snapshots/save", {}],
    ["/api/dev/snapshots/restore", {}],
  ]) {
    assert.equal((await participant(path, input)).status, 404);
    assert.equal((await dev(path, input, "wrong")).status, 403);
  }
  assert.deepEqual(await (await dev("/api/dev/snapshots")).json(), { names: [] });
  for (const mode of ["save", "restore"]) {
    assert.equal((await dev(`/api/dev/snapshots/${mode}`, { name: "Demo", revision: 0 })).status, 409);
    assert.equal((await dev(`/api/dev/snapshots/${mode}`, { contentVersion: content.version, name: "../escape", revision: 0 })).status, 400);
  }
  assert.equal((await dev("/api/dev/snapshots/save", { contentVersion: content.version, name: "Demo", revision: 0 })).status, 200);
  const restored = await dev("/api/dev/snapshots/restore", { contentVersion: content.version, name: "Demo", revision: 0 });
  assert.equal(restored.status, 200);
  const body = await restored.json();
  assert.equal(body.state.revision, 1);
  assert.equal(body.content.version, content.version);
});
