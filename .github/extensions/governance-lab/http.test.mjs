import assert from "node:assert/strict";
import { request } from "node:http";
import { Readable } from "node:stream";
import { resolve } from "node:path";
import test from "node:test";
import {
  createRouter, HttpError, readJsonObject, resolveInside, serveStaticFile, startServer, writeJson
} from "./http.mjs";

export function send(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8")
      }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("route table matches exact paths, prefixes and methods", () => {
  const router = createRouter()
    .register("get", "/", () => {})
    .register("GET", "/ui/*", () => {})
    .register("POST", "/api/save", () => {}, { auth: "token" });
  assert.equal(router.match("GET", "/").path, "/");
  assert.equal(router.match("GET", "/ui/app.js").path, "/ui/*");
  assert.equal(router.match("POST", "/api/save").auth, "token");
  assert.equal(router.match("GET", "/api/save"), undefined);
  assert.equal(router.match("GET", "/uix"), undefined);
  assert.throws(() => createRouter().register("GET", "/", () => {}, { auth: "invalid" }));
});

test("static path resolution rejects traversal, malformed escapes and null bytes", () => {
  const root = resolve(".github/extensions/governance-lab/ui");
  for (const path of ["../secret.js", "%2e%2e/secret.js", "..", "%E0%A4%A", "app.js%00"]) {
    assert.equal(resolveInside(root, path), null, path);
  }
  assert.equal(resolveInside(root, "html.js"), resolve(root, "html.js"));
});

test("JSON reader accepts only objects and enforces the 64 KiB byte boundary", async () => {
  const read = (value) => readJsonObject(Readable.from([Buffer.from(value)]));
  assert.deepEqual(await read(""), {});
  assert.deepEqual(await read('{"ok":true}'), { ok: true });
  for (const value of ["null", "[]", "42", '"text"', "{invalid"]) {
    await assert.rejects(read(value), (error) => error instanceof HttpError && error.statusCode === 400);
  }
  const boundary = JSON.stringify({ value: "x".repeat(64 * 1024 - 12) });
  assert.equal(Buffer.byteLength(boundary), 64 * 1024);
  assert.equal((await read(boundary)).value.length, 64 * 1024 - 12);
  await assert.rejects(read(boundary + " "), (error) => error.statusCode === 413);
  await assert.rejects(read(JSON.stringify({ value: "é".repeat(33 * 1024) })), (error) => error.statusCode === 413);
});

test("loopback server enforces host, origin and token without leaking internal failures", async (t) => {
  const logged = [];
  const router = createRouter()
    .register("GET", "/", ({ res }) => writeJson(res, 200, { public: true }))
    .register("POST", "/api/echo", async ({ req, res }) => writeJson(res, 200, await readJsonObject(req)), { auth: "token" })
    .register("GET", "/conflict", () => { throw Object.assign(new Error("internal"), { userMessage: "Reload saved progress." }); })
    .register("GET", "/failure", () => { throw new Error("private diagnostic"); })
    .register("GET", "/unsupported", ({ res }) => serveStaticFile(res, new URL("./ui/index.html", import.meta.url).pathname))
    .register("GET", "/missing", ({ res }) => serveStaticFile(res, new URL("./ui/missing.js", import.meta.url).pathname));
  const entry = await startServer({ router, log: async (message) => logged.push(message) });
  t.after(() => new Promise((resolve) => entry.server.close(resolve)));
  assert.equal(entry.server.address().address, "127.0.0.1");
  const headers = { "X-Canvas-Token": entry.token, Origin: new URL(entry.url).origin };
  const post = (body = "{}", extra = {}) => send(new URL("/api/echo", entry.url), {
    method: "POST", headers: { ...headers, ...extra }, body
  });
  assert.equal((await send(entry.url, { headers: { Host: "evil.example" } })).status, 403);
  assert.equal((await send(new URL("/api/echo", entry.url), { method: "POST" })).status, 403);
  assert.equal((await post("{}", { "X-Canvas-Token": "wrong" })).status, 403);
  for (const origin of ["null", "https://evil.example", "http://localhost", `${new URL(entry.url).origin}.evil.example`]) {
    assert.equal((await post("{}", { Origin: origin })).status, 403);
  }
  assert.equal((await post('{"saved":true}')).status, 200);
  assert.equal((await send(new URL("/api/echo", entry.url), {
    method: "POST", headers: { "X-Canvas-Token": entry.token }, body: "{}"
  })).status, 200);
  for (const body of ["null", "[]", "{invalid"]) assert.equal((await post(body)).status, 400);
  assert.equal((await post(JSON.stringify({ value: "x".repeat(65 * 1024) }))).status, 413);
  assert.deepEqual(logged, []);
  const conflict = await send(new URL("/conflict", entry.url));
  assert.equal(conflict.status, 409);
  assert.deepEqual(JSON.parse(conflict.body), { message: "Reload saved progress." });
  const failure = await send(new URL("/failure", entry.url));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(failure.body, /private diagnostic/);
  assert.equal(logged.length, 1);
  for (const path of ["/unsupported", "/missing", "/unknown"]) {
    assert.equal((await send(new URL(path, entry.url))).status, 404);
  }
});
