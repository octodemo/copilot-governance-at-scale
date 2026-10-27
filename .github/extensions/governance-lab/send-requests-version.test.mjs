import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadContent } from "./content.mjs";
import { openServer } from "./server.mjs";

const fixture = fileURLToPath(new URL("../../../tests/content-validation/fixtures/content-format/valid/", import.meta.url));

test("send-requests rejects requests picked from an older content snapshot", async (t) => {
  let content = await loadContent({ root: fixture });
  const initialVersion = content.version;
  const attached = [];
  const entry = await openServer({
    workshop: { snapshot: () => ({ content }) },
    documentId: "section-picker-version",
    dev: true,
    contentRoot: fixture,
    sendToAgent: async (message) => attached.push(message),
  });
  t.after(() => {
    entry.server.closeAllConnections();
    return new Promise((done) => entry.server.close(done));
  });
  const call = (body) => fetch(new URL("/api/dev/send-requests", entry.url), {
    method: "POST",
    headers: { "X-Canvas-Token": entry.token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const { file, line, endLine } = content.paths[0].decisions[0].source;
  const oldRequest = {
    file,
    line,
    endLine,
    contentVersion: initialVersion,
    prompt: "Review this section.",
  };
  const current = await call({ requests: [oldRequest] });
  assert.equal(current.status, 200);
  assert.equal(attached.length, 1);
  attached.length = 0;

  content = { ...content, version: "sha256:reloaded-snapshot" };
  const stale = await call({ requests: [oldRequest] });
  assert.equal(stale.status, 409);
  assert.match((await stale.json()).message, /reloaded after this section was picked/);
  assert.equal(attached.length, 0);

  const mixedBatch = await call({ requests: [
    { ...oldRequest, file: "not-a-loaded-source.md" },
    { ...oldRequest, contentVersion: content.version },
  ] });
  assert.equal(mixedBatch.status, 409);
  assert.match((await mixedBatch.json()).message, /Request 1:.*reloaded after this section was picked/);
  assert.equal(attached.length, 0);

  const missingVersion = await call({ requests: [{ ...oldRequest, contentVersion: undefined }] });
  assert.equal(missingVersion.status, 400);
});
