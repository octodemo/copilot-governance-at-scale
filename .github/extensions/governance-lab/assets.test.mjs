import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PAGE_CSP, STATIC_CSP } from "./http.mjs";
import { openServer } from "./server.mjs";

test("workshop serves only its own assets with unchanged URLs and strict CSP", async (t) => {
  const content = { paths: [] };
  const state = { revision: 7 };
  const store = {
    read: async () => state,
    update: async (_id, input) => input,
    export: async () => ({ state }),
    markdown: async () => "# Saved workshop"
  };
  const entry = await openServer({ content, store, documentId: "assets-test" });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((resolve) => entry.server.close(resolve)); });
  const get = (path, headers) => fetch(new URL(path, entry.url), { headers });
  const page = await get("/");
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("content-security-policy"), PAGE_CSP);
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal(page.headers.get("referrer-policy"), "no-referrer");
  assert.equal(page.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(PAGE_CSP, /unsafe-inline|unsafe-eval/);
  assert.match(html, new RegExp(`name="canvas-token" content="${entry.token}"`));
  assert.match(html, /data-color-mode="auto" data-light-theme="light" data-dark-theme="dark"/);
  assert.ok(html.indexOf('href="/primer.css"') < html.indexOf('href="/styles.css"'));
  assert.doesNotMatch(html, /{{TOKEN}}|<script>|<style>/i);
  for (const file of ["app.js", "model.js", "html.js", "markdown.js", "theme.js", "styles.css", "primer.css"]) {
    const response = await get(`/${file}`);
    assert.equal(response.status, 200, file);
    assert.equal(response.headers.get("content-security-policy"), STATIC_CSP, file);
    assert.equal(response.headers.get("cache-control"), "no-store", file);
    assert.match(response.headers.get("content-type"), file.endsWith(".css") ? /^text\/css/ : /^text\/javascript/, file);
    assert.equal(await response.text(), await readFile(new URL(`./ui/${file}`, import.meta.url), "utf8"), file);
  }
  for (const path of ["/index.html", "/http.mjs", "/state.mjs", "/ui/app.js", "/missing.js", "/%2e%2e/server.mjs"]) {
    assert.equal((await get(path)).status, 404, path);
  }
  assert.equal((await get("/favicon.ico")).status, 204);
  assert.equal((await get("/api/bootstrap")).status, 403);
  const headers = { "X-Canvas-Token": entry.token };
  assert.deepEqual(await (await get("/api/bootstrap", headers)).json(), { content, state });
  assert.equal((await get("/api/export?format=unsupported", headers)).status, 400);
  const markdown = await get("/api/export?format=markdown", headers);
  assert.equal(await markdown.text(), "# Saved workshop");
  assert.match(markdown.headers.get("content-disposition"), /governance-workshop.md/);
  assert.deepEqual(await (await get("/api/export", headers)).json(), { state });
});

test("vendored Primer remains byte-for-byte intact with its MIT notice", async () => {
  const primer = await readFile(new URL("./ui/primer.css", import.meta.url));
  assert.equal(createHash("sha256").update(primer).digest("hex"), "2dbafa2de726c584e0b2f7128c061fceda730f3776ecd8b0c5fac93b986e884e");
  assert.match(primer.toString(), /Primer CSS[\s\S]*Released under MIT license/);
});

test("runtime imports and asset references are independent of the retired canvas", async () => {
  for (const file of ["server.mjs", "state.mjs", "http.mjs", "ui/html.js", "ui/markdown.js", "ui/theme.js", "ui/index.html"]) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /copilot-at-scale-lab/, file);
  }
});
