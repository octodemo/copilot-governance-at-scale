import assert from "node:assert/strict";
import test from "node:test";
import { content, harness } from "./exercise-helpers.mjs";
import { openServer } from "../../.github/extensions/governance-lab/server.mjs";

test("v10 migrates read-only to v11 with an empty profile; profile updates persist at the current revision", async (t) => {
  const h = await harness(t);
  const v10 = structuredClone(h.state());
  v10.version = 10;
  delete v10.profile;
  await h.write(v10);
  const before = await h.disk();
  const migrated = await h.refresh();
  assert.equal(migrated.version, 11);
  assert.deepEqual(migrated.profile, { enterpriseSlug: "", organizationSlug: "" });
  assert.equal(await h.disk(), before, "reading migration must not rewrite saved state");

  await assert.rejects(h.store.updateProfile(h.documentId, {
    revision: migrated.revision, profile: { enterpriseSlug: "acme/path", organizationSlug: "" },
  }), (error) => error.statusCode === 400);
  assert.equal(h.state().revision, migrated.revision);

  const saved = await h.store.updateProfile(h.documentId, {
    revision: migrated.revision, profile: { enterpriseSlug: "Acme-Tools", organizationSlug: "Platform-Team" },
  });
  assert.equal(saved.version, 11);
  assert.equal(saved.revision, migrated.revision + 1);
  assert.deepEqual(saved.profile, { enterpriseSlug: "Acme-Tools", organizationSlug: "Platform-Team" });
  assert.deepEqual(await h.store.read(h.documentId), saved);
  await assert.rejects(h.store.updateProfile(h.documentId, {
    revision: migrated.revision, profile: { enterpriseSlug: "Other", organizationSlug: "" },
  }), (error) => error.statusCode === 409);
});

test("profile survives reset but its values are omitted from both participant exports", async (t) => {
  const h = await harness(t);
  const saved = await h.store.updateProfile(h.documentId, {
    revision: h.state().revision, profile: { enterpriseSlug: "Private-Enterprise", organizationSlug: "Private-Org" },
  });
  const reset = await h.store.resetDocument(h.documentId, { revision: saved.revision });
  assert.deepEqual(reset.profile, saved.profile);

  const exported = await h.store.export(h.documentId);
  assert.equal(exported.version, 11);
  assert.equal(Object.hasOwn(exported.state, "profile"), false);
  assert.doesNotMatch(JSON.stringify(exported), /Private-Enterprise|Private-Org/);
  assert.doesNotMatch(await h.store.markdown(h.documentId), /Private-Enterprise|Private-Org/);
});

test("profile update route uses the validated state layer and token-protected workshop server", async (t) => {
  const h = await harness(t);
  const entry = await openServer({ content, store: h.store, documentId: h.documentId });
  t.after(() => new Promise((resolve) => entry.server.close(resolve)));
  const response = await fetch(new URL("/api/profile", entry.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Canvas-Token": entry.token },
    body: JSON.stringify({
      revision: h.state().revision, profile: { enterpriseSlug: "Example-Enterprise", organizationSlug: "" },
    }),
  });
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.equal(updated.profile.enterpriseSlug, "Example-Enterprise");

  const rejected = await fetch(new URL("/api/profile", entry.url), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Canvas-Token": entry.token },
    body: JSON.stringify({
      revision: updated.revision, profile: { enterpriseSlug: "not/a/slug", organizationSlug: "" },
    }),
  });
  assert.equal(rejected.status, 400);
});

test("optional repository profile persists, survives older-client saves and reset, and is excluded from exports", async (t) => {
  const h = await harness(t);
  const original = await h.refresh();
  let state = await h.store.updateProfile(h.documentId, {
    revision: original.revision,
    profile: { enterpriseSlug: "lab-enterprise", organizationSlug: "lab-org", repositoryName: "private.repo_name" },
  });
  assert.equal((await h.store.read(h.documentId)).profile.repositoryName, "private.repo_name");
  for (const repositoryName of ["../other", ".", "..", "a/b", "a?b", "a".repeat(101), null]) {
    await assert.rejects(h.store.updateProfile(h.documentId, {
      revision: state.revision, profile: { ...state.profile, repositoryName },
    }), { statusCode: 400 });
  }
  state = await h.store.updateProfile(h.documentId, {
    revision: state.revision, profile: { enterpriseSlug: "lab-enterprise", organizationSlug: "new-org" },
  });
  assert.equal(state.profile.repositoryName, "private.repo_name");
  state = await h.store.resetDocument(h.documentId, { revision: state.revision });
  assert.equal(state.profile.repositoryName, "private.repo_name");
  assert.doesNotMatch(JSON.stringify(await h.store.export(h.documentId)), /private.repo_name|repositoryName/);
  assert.doesNotMatch(await h.store.markdown(h.documentId), /private.repo_name|repositoryName/);
});
