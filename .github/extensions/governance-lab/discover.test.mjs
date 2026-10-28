import assert from "node:assert/strict";
import test from "node:test";
import { authStatus, discoverAccounts, GH_COMMANDS, REQUIRED_SCOPES, signInCommand } from "./discover.mjs";
import { openServer } from "./server.mjs";

const fail = (fields) => Object.assign(new Error("gh failed"), fields);

const labEnterprises = (slugs) => JSON.stringify([{ data: { viewer: { enterprises: { nodes: slugs.map((slug) => ({ slug })) } } } }]);

test("automatic detection uses the enterprise slug as the organization without listing organizations", async () => {
  const calls = [];
  const result = await discoverAccounts({ automatic: true, run: async (args) => {
    calls.push(args[1]);
    if (args[1] === "user") return '{"login":"octocat"}';
    if (args[1] === "user/orgs") throw new Error("organizations must not be listed");
    if (args[1] === "orgs/ghuniverse1874-ea76/repos?per_page=100") return JSON.stringify([[{ name: "notes" }, { name: "pets-workshop" }], [{ name: "../bad" }]]);
    return JSON.stringify([{ data: { viewer: { enterprises: { nodes: [
      { slug: "unrelated" }, { slug: "ghuniverse1847-octocat" }, { slug: "ghuniverse1874-ea76" },
      { slug: "ghuniverse1874-ea76" }, { slug: "ghuniverse1874-bad/value" },
    ] } } } }]);
  } });
  assert.deepEqual(calls, ["user", "graphql", "orgs/ghuniverse1874-ea76/repos?per_page=100"]);
  assert.deepEqual(result, { profile: { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76", repositoryName: "pets-workshop" }, notices: [] });
});

test("automatic detection picks a single repository and reports what it could not detect", async () => {
  const run = (repos) => async (args) => {
    if (args[1] === "user") return '{"login":"octocat"}';
    if (args[1] === "graphql") return labEnterprises(["ghuniverse1874-ea76"]);
    if (args[1] === "user/orgs") throw new Error("organizations must not be listed");
    if (repos instanceof Error) throw repos;
    return JSON.stringify([repos.map((name) => ({ name }))]);
  };
  const single = await discoverAccounts({ automatic: true, run: run(["only-repo"]) });
  assert.deepEqual(single, { profile: { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76", repositoryName: "only-repo" }, notices: [] });

  const several = await discoverAccounts({ automatic: true, run: run(["a", "b"]) });
  assert.deepEqual(several.profile, { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76" });
  assert.equal(several.notices.length, 1);
  assert.match(several.notices[0], /several repositories/);

  const failing = await discoverAccounts({ automatic: true, run: run(fail({ stderr: "HTTP 404" })) });
  assert.deepEqual(failing.profile, { enterpriseSlug: "ghuniverse1874-ea76", organizationSlug: "ghuniverse1874-ea76" });
  assert.match(failing.notices.join(" "), /could not be listed/);
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

test("automatic discovery retains the environment-token fallback for every lookup", async () => {
  const calls = [];
  const result = await discoverAccounts({ automatic: true, env: { GH_TOKEN: "x" }, run: async (args, { useEnvToken }) => {
    calls.push([args[1], useEnvToken]);
    if (!useEnvToken) throw fail({ stderr: "not logged in" });
    if (args[1].startsWith("orgs/")) return '[[{"name":"pets-workshop"}]]';
    return args[1] === "user" ? '{"login":"octocat"}' :
      '{"data":{"viewer":{"enterprises":{"nodes":[{"slug":"ghuniverse1874-ea76"}]}}}}';
  } });
  assert.deepEqual(calls, [["user", false], ["graphql", false], ["user", true], ["graphql", true], ["orgs/ghuniverse1874-ea76/repos?per_page=100", true]]);
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

const statusJson = (entry) => JSON.stringify({ hosts: { "github.com": entry ? [entry] : [] } });

test("auth status checks stored credentials for the enterprise and organization admin scopes", async () => {
  const seen = [];
  const check = (output) => authStatus({ run: async (args, options) => {
    seen.push([args, options]);
    if (output instanceof Error) throw output;
    return output;
  } });
  const ready = await check(statusJson({ state: "success", active: true, login: "lab-admin", scopes: "admin:enterprise, admin:org, repo" }));
  assert.deepEqual(seen[0], [[...GH_COMMANDS.authStatus], { useEnvToken: false }]);
  assert.deepEqual(GH_COMMANDS.authStatus, ["auth", "status", "--json", "hosts", "--active", "--hostname", "github.com"]);
  assert.equal(ready.status, "ready");
  assert.equal(ready.account, "lab-admin");
  const missing = await check(statusJson({ state: "success", active: true, login: "lab-admin", scopes: "repo, read:org" }));
  assert.equal(missing.status, "missing-scopes");
  assert.deepEqual(missing.missingScopes, [...REQUIRED_SCOPES]);
  for (const output of [statusJson(null), statusJson({ state: "error", active: true, login: "" }), statusJson({ state: "success", active: true, login: "<x>" })]) {
    assert.equal((await check(output)).status, "signed-out");
  }
  assert.equal((await check(fail({ code: "ENOENT" }))).status, "gh-missing");
  assert.match((await check(fail({ stderr: "unknown flag: --json" }))).message, /Update gh/);
  assert.equal((await check("not json")).status, "failed");
});

test("sign-in commands are fixed, request admin scopes, and clear injected tokens", () => {
  assert.equal(signInCommand("login", "darwin"),
    "env -u GH_TOKEN -u GITHUB_TOKEN gh auth login --hostname github.com --git-protocol https --web --clipboard --scopes admin:enterprise,admin:org");
  assert.equal(signInCommand("refresh", "linux"),
    "env -u GH_TOKEN -u GITHUB_TOKEN gh auth refresh --hostname github.com --clipboard --scopes admin:enterprise,admin:org");
  assert.match(signInCommand("login", "win32"), /^cmd \/d \/c "set GH_TOKEN=& set GITHUB_TOKEN=& gh auth login /);
  assert.throws(() => signInCommand("logout"), TypeError);
});

test("auth routes require the token, validate the mode, and open only fixed sign-in commands", async (t) => {
  const opened = [];
  let checks = 0;
  const entry = await openServer({ content: { paths: [] }, store: {}, documentId: "auth-test", platform: "darwin",
    checkAuth: async () => { checks++; return { status: "signed-out" }; },
    openTerminal: async (command, title) => { opened.push([command, title]); } });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((resolve) => entry.server.close(resolve)); });
  const headers = { "Content-Type": "application/json", "X-Canvas-Token": entry.token };
  assert.equal((await fetch(new URL("/api/auth/status", entry.url))).status, 403);
  const status = await fetch(new URL("/api/auth/status", entry.url), { headers });
  assert.deepEqual(await status.json(), { status: "signed-out" });
  assert.equal(checks, 1);
  const signIn = (body, extra = headers) => fetch(new URL("/api/auth/sign-in", entry.url), { method: "POST", headers: extra, body: JSON.stringify(body) });
  assert.equal((await signIn({ mode: "login" }, { "Content-Type": "application/json" })).status, 403);
  for (const body of [{}, { mode: "logout" }, { mode: "login", command: "rm -rf /" }]) assert.equal((await signIn(body)).status, 400);
  assert.equal(opened.length, 0);
  assert.equal((await signIn({ mode: "refresh" })).status, 200);
  assert.deepEqual(opened, [[signInCommand("refresh", "darwin"), "GitHub CLI sign-in"]]);
});

test("sign-in route without a terminal host returns the command to run manually", async (t) => {
  const entry = await openServer({ content: { paths: [] }, store: {}, documentId: "auth-no-terminal", platform: "darwin" });
  t.after(() => { entry.server.closeAllConnections(); return new Promise((resolve) => entry.server.close(resolve)); });
  const response = await fetch(new URL("/api/auth/sign-in", entry.url), { method: "POST",
    headers: { "Content-Type": "application/json", "X-Canvas-Token": entry.token }, body: JSON.stringify({ mode: "login" }) });
  assert.equal(response.status, 501);
  assert.match((await response.json()).message, /gh auth login --hostname github\.com/);
});
