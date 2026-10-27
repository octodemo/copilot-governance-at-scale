import test from "node:test";
import assert from "node:assert/strict";
import { replaceFile } from "../../../lib/atomic-replace.mjs";

const failing = (codes) => {
  const calls = [];
  return { calls, renameFile: async (...args) => {
    calls.push(args);
    const code = codes.shift();
    if (code) throw Object.assign(new Error(code), { code });
  } };
};

test("Windows retries transient replace failures while another handle holds the destination", async () => {
  const stub = failing(["EPERM", "EACCES", "EBUSY"]);
  await replaceFile("a.pending", "a.json", { platform: "win32", delayMs: 0, renameFile: stub.renameFile });
  assert.equal(stub.calls.length, 4);
});

test("retries are bounded and other platforms or errors fail immediately", async () => {
  const bounded = failing(Array(5).fill("EPERM"));
  await assert.rejects(replaceFile("a", "b", { platform: "win32", attempts: 3, delayMs: 0, renameFile: bounded.renameFile }), { code: "EPERM" });
  assert.equal(bounded.calls.length, 3);
  const posix = failing(["EPERM"]);
  await assert.rejects(replaceFile("a", "b", { platform: "linux", renameFile: posix.renameFile }), { code: "EPERM" });
  assert.equal(posix.calls.length, 1);
  const missing = failing(["ENOENT"]);
  await assert.rejects(replaceFile("a", "b", { platform: "win32", delayMs: 0, renameFile: missing.renameFile }), { code: "ENOENT" });
  assert.equal(missing.calls.length, 1);
});
