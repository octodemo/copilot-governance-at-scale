import assert from "node:assert/strict";
import test from "node:test";
import { discoverAccounts, GH_COMMANDS } from "./discover.mjs";
import { openServer } from "./server.mjs";

const fail = (fields) => Object.assign(new Error("gh failed"), fields);

test("automatic detection uses only enterprises and derives both profile values from one lab slug", async () => {
  const calls = [];
  const result = await discoverAccounts({ automatic: true, run: async (args) => {
    calls.push(args[1]);
    if (args[1] === "user") return '{"login":"octocat"}';
    return JSON.stringify([{ data: { viewer: { enterprises: { nodes: [
      { slug: "unrelated" }, { slug: "ghuniverse1847-octocat" }, { slug: "ghuniverse1874-ea76" },
      { slug: "ghuniverse1874-ea76" }, { slug: "ghuniverse1874-bad/value" },
    ] } } } }]);
  } });
  assert.deepEqual(calls, ["user", "graphql"]);
  assert.deepEqual(result, { profile: { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76" } });
});

test("automatic detection fails explicitly for missing, ambiguous, inaccessible, or malformed enterprises", async () => {
  for (const [slugs, code] of [
    [["unrelated", "ghuniverse1847-ea76", "xghuniverse1874-ea76"], "not-found"],
    [["ghuniverse1874-one", "ghuniverse1874-two"], "ambiguous"],
  ]) {
    const result = await discoverAccounts({ automatic: true, run: async (args) => args[1] === "user" ? '{"login":"octocat"}' :
      JSON.stringify([{ data: { viewer: { enterprises: { nodes: slugs.map((slug) => ({ slug })) } } } }]) });
    assert.equal(result.profile, null);
    assert.equal(result.error.code, code);
  }
  for (const [run, code] of [
    [async () => { throw fail({ code: "ENOENT" }); }, "gh-missing"],
    [async () => "bad json", "invalid-output"],
    [async () => { throw fail({ killed: true }); }, "timeout"],
    [async () => { throw fail({ stderr: "HTTP 403 forbidden" }); }, "forbidden"],
  ]) {
    const result = await discoverAccounts({ automatic: true, run });
    assert.equal(result.profile, null);
    assert.equal(result.error.code, code);
  }
});

test("automatic discovery retains the environment-token fallback without querying organizations", async () => {
  const calls = [];
  const result = await discoverAccounts({ automatic: true, env: { GH_TOKEN: "x" }, run: async (args, { useEnvToken }) => {
    calls.push([args[1], useEnvToken]);
    if (!useEnvToken) throw fail({ stderr: "not logged in" });
    return args[1] === "user" ? '{"login":"octocat"}' :
      '{"data":{"viewer":{"enterprises":{"nodes":[{"slug":"ghuniverse1874-ea76"}]}}}}';
  } });
  assert.deepEqual(calls, [["user", false], ["graphql", false], ["user", true], ["graphql", true]]);
  assert.equal(result.profile.organizationSlug, "ghuniverse1874-ea76");
});

test("discovery uses fixed read-only gh arguments and returns validated, deduplicated slugs", async () => {
  const calls = [];
  const result = await discoverAccounts({ run: async (args, options) => {
    calls.push(args);
    assert.deepEqual(options, { useEnvToken: false });
    if (args[1] === "user") return JSON.stringify({ login: "octocat", email: "private@example.com" });
    if (args[1] === "user/orgs") return JSON.stringify([[{ login: "zeta" }, { login: "Alpha" }], [{ login: "alpha" }, { login: "bad slug" }, { login: "<script>" }, {}]]);
    return JSON.stringify([
      { data: { viewer: { enterprises: { nodes: [{ slug: "acme", name: "Acme Corp" }, { slug: "-bad", name: "x" }] } } } },
      { data: { viewer: { enterprises: { nodes: [{ slug: "beta", name: "" }] } } } },
    ]);
  } });
  assert.deepEqual(calls, [[...GH_COMMANDS.account], [...GH_COMMANDS.organizations], [...GH_COMMANDS.enterprises]]);
  assert.equal(result.account, "octocat");
  assert.equal(result.source, "stored");
  for (const args of calls) assert.equal(args[0], "api");
  assert.deepEqual(result.organizations, { items: [{ slug: "Alpha", name: "Alpha" }, { slug: "zeta", name: "zeta" }] });
  assert.deepEqual(result.enterprises, { items: [{ slug: "acme", name: "Acme Corp" }, { slug: "beta", name: "beta" }] });
});

test("discovery reports actionable failures independently for each list", async () => {
  const missing = await discoverAccounts({ run: async () => { throw fail({ code: "ENOENT" }); } });
  assert.equal(missing.organizations.error.code, "gh-missing");
  assert.equal(missing.enterprises.error.code, "gh-missing");

  const mixed = await discoverAccounts({ run: async (args) => {
    if (args[1] === "user") return "{\"login\":\"octo-admin\"}";
    if (args[1] === "user/orgs") return "[[{\"login\":\"octo\"}]]";
    throw fail({ code: 1, stderr: "gh: Your token has not been granted the required scopes", stdout: "{\"errors\":[{\"type\":\"INSUFFICIENT_SCOPES\",\"message\":\"The 'enterprises' field requires one of the following scopes: ['read:enterprise'], but\"}]}" });
  } });
  assert.deepEqual(mixed.organizations.items, [{ slug: "octo", name: "octo" }]);
  assert.equal(mixed.enterprises.error.code, "forbidden");
  assert.match(mixed.enterprises.error.message, /gh auth refresh --scopes read:enterprise/);

  const other = await discoverAccounts({ env: {}, run: async (args) => {
    if (args[1] !== "graphql") throw fail({ code: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login" });
    throw fail({ killed: true, signal: "SIGTERM" });
  } });
  assert.equal(other.organizations.error.code, "unauthenticated");
  assert.equal(other.enterprises.error.code, "timeout");

  const garbage = await discoverAccounts({ run: async () => "not json" });
  assert.equal(garbage.organizations.error.code, "invalid-output");
  assert.equal(garbage.enterprises.error.code, "invalid-output");
});

test("discovery prefers stored gh credentials over an injected environment token", async () => {
  const sources = [];
  const unauthenticated = () => { throw fail({ code: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login" }); };
  const fallback = await discoverAccounts({ env: { GH_TOKEN: "x" }, run: async (args, { useEnvToken }) => {
    sources.push(useEnvToken);
    if (!useEnvToken) unauthenticated();
    if (args[1] === "user") return "{\"login\":\"env-user\"}";
    if (args[1] === "user/orgs") return "[[]]";
    throw fail({ code: 1, stdout: "{\"errors\":[{\"type\":\"INSUFFICIENT_SCOPES\",\"message\":\"requires one of the following scopes: ['read:enterprise'], but\"}]}" });
  } });
  assert.deepEqual(sources, [false, false, false, true, true, true]);
  assert.equal(fallback.source, "environment");
  assert.equal(fallback.account, "env-user");
  assert.match(fallback.enterprises.error.message, /GH_TOKEN or GITHUB_TOKEN environment variable/);
  assert.doesNotMatch(fallback.enterprises.error.message, /gh auth refresh/);

  const noToken = await discoverAccounts({ env: {}, run: async () => unauthenticated() });
  assert.equal(noToken.source, "stored");
  assert.equal(noToken.organizations.error.code, "unauthenticated");
});

test("runGh strips environment tokens unless explicitly requested", { skip: process.platform === "win32" }, async () => {
  const { runGh } = await import("./discover.mjs");
  const saved = { GH_TOKEN: process.env.GH_TOKEN, PATH: process.env.PATH };
  const { mkdtemp, writeFile, chmod, rm } = await import("node:fs/promises");
  const { join } = await import("node:path"); const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "fake-gh-"));
  try {
    await writeFile(join(dir, "gh"), "#!/bin/sh\nprintf '%s' \"${GH_TOKEN:-none}\"\n");
    await chmod(join(dir, "gh"), 0o755);
    process.env.GH_TOKEN = "injected"; process.env.PATH = `${dir}:${saved.PATH}`;
    assert.equal(await runGh(["api", "user"]), "none");
    assert.equal(await runGh(["api", "user"], { useEnvToken: true }), "injected");
  } finally {
    if (saved.GH_TOKEN === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = saved.GH_TOKEN;
    process.env.PATH = saved.PATH; await rm(dir, { recursive: true, force: true });
  }
});

test("discovery route requires the token and never persists results", async (t) => {
  let runs = 0, writes = 0;
  const store = { read: async () => ({ revision: 1 }), update: async () => { writes++; }, updateProfile: async () => { writes++; } };
  const entry = await openServer({ content: { paths: [] }, store, documentId: "discover-test",
    discover: async () => { runs++; return { organizations: { items: [{ slug: "octo", name: "Octo" }] }, enterprises: { items: [] } }; } });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((resolve) => entry.server.close(resolve)); });
  const post = (headers) => fetch(new URL("/api/profile/discover", entry.url), { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}" });
  assert.equal((await post({})).status, 403);
  assert.equal(runs, 0);
  const response = await post({ "X-Canvas-Token": entry.token });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { organizations: { items: [{ slug: "octo", name: "Octo" }] }, enterprises: { items: [] } });
  assert.equal(runs, 1);
  assert.equal(writes, 0);
});

test("discovery route validates automatic mode and keeps automatic and manual lookups separate", async (t) => {
  const modes = [];
  const entry = await openServer({ content: { paths: [] }, store: {}, documentId: "discovery-modes",
    discover: async ({ automatic }) => { modes.push(automatic); return { automatic }; } });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((resolve) => entry.server.close(resolve)); });
  const post = (input) => fetch(new URL("/api/profile/discover", entry.url), {
    method: "POST", headers: { "Content-Type": "application/json", "X-Canvas-Token": entry.token }, body: JSON.stringify(input),
  });
  for (const input of [{ automatic: "true" }, { command: "anything" }]) assert.equal((await post(input)).status, 400);
  const results = await Promise.all([post({}), post({ automatic: true })]);
  assert.deepEqual(await results[0].json(), { automatic: false });
  assert.deepEqual(await results[1].json(), { automatic: true });
  assert.deepEqual(modes.sort(), [false, true]);
});
