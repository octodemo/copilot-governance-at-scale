import { execFile } from "node:child_process";
import { DEFAULT_REPOSITORY_NAME, validRepositoryName } from "../../../lib/workshop-resolver.mjs";

// Read-only GitHub CLI discovery of profile candidates. Arguments are fixed;
// participant input never reaches the command line, and results are not stored.
const SLUG = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/;
const MAX_ITEMS = 500;
const ENTERPRISES_QUERY = `query($endCursor: String) {
  viewer { enterprises(first: 100, after: $endCursor) { nodes { slug name } pageInfo { hasNextPage endCursor } } }
}`;

const ENV_TOKENS = ["GH_TOKEN", "GITHUB_TOKEN"];
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,98}[A-Za-z0-9])?$/;
const LAB_PREFIX = "ghuniverse1874-";

const HOST = "github.com";
// Enterprise and organization administration scopes requested at sign-in.
export const REQUIRED_SCOPES = Object.freeze(["admin:enterprise", "admin:org"]);

export const GH_COMMANDS = Object.freeze({
  account: Object.freeze(["api", "user"]),
  organizations: Object.freeze(["api", "user/orgs", "--paginate", "--slurp"]),
  enterprises: Object.freeze(["api", "graphql", "--paginate", "--slurp", "-f", `query=${ENTERPRISES_QUERY}`]),
  authStatus: Object.freeze(["auth", "status", "--json", "hosts", "--active", "--hostname", HOST]),
});

// Only called with a slug that already matched SLUG; execFile passes it as one argument.
const repositoriesCommand = (organization) => ["api", `orgs/${organization}/repos?per_page=100`, "--paginate", "--slurp"];

// Fixed sign-in commands opened in the visible workshop terminal after an explicit
// click. GH_TOKEN/GITHUB_TOKEN are cleared for the command only, because gh
// refuses to store credentials while either is set.
const SIGN_IN_ARGS = Object.freeze({
  login: ["auth", "login", "--hostname", HOST, "--git-protocol", "https", "--web", "--clipboard", "--scopes", REQUIRED_SCOPES.join(",")],
  refresh: ["auth", "refresh", "--hostname", HOST, "--clipboard", "--scopes", REQUIRED_SCOPES.join(",")],
});
export function signInCommand(mode, platform = process.platform) {
  const args = SIGN_IN_ARGS[mode];
  if (!args) throw new TypeError(`Unknown sign-in mode: ${mode}`);
  return platform === "win32" ?
    `cmd /d /c "set GH_TOKEN=& set GITHUB_TOKEN=& gh ${args.join(" ")}"` :
    `env -u GH_TOKEN -u GITHUB_TOKEN gh ${args.join(" ")}`;
}

export function hasEnvToken(env = process.env) {
  return ENV_TOKENS.some((name) => env[name]);
}

// gh lets GH_TOKEN/GITHUB_TOKEN take precedence over stored credentials. The
// host process may inject such a token, so prefer the participant's own
// `gh auth login` unless the caller explicitly asks for the environment token.
export function runGh(args, { useEnvToken = false, timeout = 20000 } = {}) {
  const env = { ...process.env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" };
  if (!useEnvToken) for (const name of ENV_TOKENS) delete env[name];
  return new Promise((resolve, reject) => {
    execFile("gh", args, { timeout, maxBuffer: 2 * 1024 * 1024, windowsHide: true, env },
      (error, stdout, stderr) => {
        if (error) { error.stderr = String(stderr ?? ""); error.stdout = String(stdout ?? "").slice(0, 4000); reject(error); }
        else resolve(String(stdout));
      });
  });
}

function failure(error, scope, source) {
  if (error?.code === "ENOENT") return { code: "gh-missing", message: "GitHub CLI (gh) was not found. Install it, sign in with gh auth login, then try again." };
  if (error?.killed || error?.signal === "SIGTERM") return { code: "timeout", message: `GitHub CLI did not list ${scope} in time.` };
  const detail = `${error?.stderr ?? ""}\n${error?.stdout ?? ""}`;
  if (/gh auth login|not logged in/i.test(detail)) return { code: "unauthenticated", message: "GitHub CLI is not signed in. Run gh auth login, then try again." };
  if (/scope|HTTP 403|forbidden|INSUFFICIENT/i.test(detail)) {
    // Use only the scope GitHub's own response names; never guess one.
    const required = detail.match(/scopes?:\s*\[\s*'([a-z:_]{1,40})'/i)?.[1];
    const fix = source === "environment" ?
      "The token comes from the GH_TOKEN or GITHUB_TOKEN environment variable; sign in with gh auth login to use a stored account instead." :
      required ? `To grant it, run gh auth refresh --scopes ${required}, then try again.` : "Check gh auth status for the token's scopes.";
    return { code: "forbidden", message: required ?
      `GitHub reports that listing ${scope} requires the ${required} scope. ${fix}` : `GitHub CLI's token cannot list ${scope}. ${fix}` };
  }
  return { code: "failed", message: `GitHub CLI could not list ${scope}.` };
}

function candidates(items, key) {
  const seen = new Map();
  for (const item of items) {
    const slug = item?.[key];
    if (typeof slug !== "string" || !SLUG.test(slug) || seen.has(slug.toLowerCase())) continue;
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 200) : slug;
    seen.set(slug.toLowerCase(), { slug, name });
    if (seen.size >= MAX_ITEMS) break;
  }
  return [...seen.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function pages(stdout) {
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

const INVALID = { code: "invalid-output", message: "GitHub CLI returned unexpected output." };

async function discoverWith(run, source, automatic) {
  const options = { useEnvToken: source === "environment" };
  const settle = (pending) => pending.catch(() => ({ items: [], error: INVALID }));
  const [account, organizations, enterprises] = await Promise.all([
    run([...GH_COMMANDS.account], options).then(
      (stdout) => { const login = JSON.parse(stdout)?.login; return typeof login === "string" && LOGIN.test(login) ? login : null; },
      (error) => ({ error: failure(error, "the account", source) })).catch(() => null),
    automatic ? { items: [] } : settle(run([...GH_COMMANDS.organizations], options).then(
      (stdout) => ({ items: candidates(pages(stdout).flat(), "login") }),
      (error) => ({ items: [], error: failure(error, "organizations", source) }))),
    settle(run([...GH_COMMANDS.enterprises], options).then(
      (stdout) => ({ items: candidates(pages(stdout).flatMap((page) => page?.data?.viewer?.enterprises?.nodes ?? []), "slug") }),
      (error) => ({ items: [], error: failure(error, "enterprises", source) }))),
  ]);
  return { account: typeof account === "string" ? account : null, source, organizations, enterprises,
    unauthenticated: [account, ...(automatic ? [] : [organizations]), enterprises].every((result) => result?.error?.code === "unauthenticated") };
}

export async function discoverAccounts({ run = runGh, env = process.env, automatic = false } = {}) {
  let result = await discoverWith(run, "stored", automatic);
  if (result.unauthenticated && hasEnvToken(env)) result = await discoverWith(run, "environment", automatic);
  if (automatic) {
    if (result.enterprises.error) return { profile: null, error: result.enterprises.error };
    const matches = result.enterprises.items.filter(({ slug }) => isLabSlug(slug));
    if (matches.length !== 1) return { profile: null, error: {
      code: matches.length ? "ambiguous" : "not-found",
      message: matches.length ? `Multiple enterprises match ${LAB_PREFIX}. Choose your lab enterprise manually.` :
        `No enterprise matching ${LAB_PREFIX} was found for this GitHub CLI account.`,
    } };
    const enterpriseSlug = matches[0].slug;
    const options = { useEnvToken: result.source === "environment" };
    const notices = [];
    const organizationSlug = await detectOrganization(run, options, enterpriseSlug, notices);
    const repositoryName = await detectRepository(run, options, organizationSlug, notices);
    return { profile: { enterpriseSlug, organizationSlug, ...(repositoryName ? { repositoryName } : {}) }, notices };
  }
  const { unauthenticated, ...output } = result;
  return output;
}

const isLabSlug = (slug) => slug.toLowerCase().startsWith(LAB_PREFIX) && slug.length > LAB_PREFIX.length;

// Lab organizations share their enterprise's slug. Prefer that exact match, then a
// single lab-prefixed organization; otherwise keep the shared-slug convention.
async function detectOrganization(run, options, enterpriseSlug, notices) {
  let organizations;
  try { organizations = candidates(pages(await run([...GH_COMMANDS.organizations], options)).flat(), "login"); }
  catch {
    notices.push(`Organization membership could not be listed; using ${enterpriseSlug}, the lab organization naming convention.`);
    return enterpriseSlug;
  }
  const exact = organizations.find(({ slug }) => slug.toLowerCase() === enterpriseSlug.toLowerCase());
  if (exact) return exact.slug;
  const lab = organizations.filter(({ slug }) => isLabSlug(slug));
  if (lab.length === 1) return lab[0].slug;
  notices.push(`No single lab organization was found for this account; using ${enterpriseSlug}. Check the organization in the profile.`);
  return enterpriseSlug;
}

// Returns a repository only when the organization contains the workshop default
// or exactly one repository; otherwise the profile keeps its current value.
async function detectRepository(run, options, organization, notices) {
  let names;
  try {
    names = pages(await run(repositoriesCommand(organization), options)).flat()
      .map((item) => item?.name).filter((name) => typeof name === "string" && validRepositoryName(name)).slice(0, MAX_ITEMS);
  } catch {
    notices.push(`Repositories in ${organization} could not be listed. Check the repository in the profile.`);
    return null;
  }
  const preferred = names.find((name) => name.toLowerCase() === DEFAULT_REPOSITORY_NAME.toLowerCase());
  if (preferred) return preferred;
  if (names.length === 1) return names[0];
  notices.push(names.length ? `${organization} has several repositories and none is named ${DEFAULT_REPOSITORY_NAME}. Choose the repository in the profile.` :
    `${organization} has no repositories visible to this account. Check the repository in the profile.`);
  return null;
}

// Read-only check of the stored (not environment) credentials for the lab host.
export async function authStatus({ run = runGh } = {}) {
  let entry;
  try {
    const parsed = JSON.parse(await run([...GH_COMMANDS.authStatus], { useEnvToken: false }));
    const accounts = parsed?.hosts?.[HOST];
    entry = Array.isArray(accounts) ? accounts.find((account) => account?.active) ?? accounts[0] : null;
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "gh-missing", account: null, missingScopes: [...REQUIRED_SCOPES],
      message: "GitHub CLI (gh) was not found. Install it from cli.github.com, then check again." };
    if (/unknown flag|unknown command/i.test(`${error?.stderr ?? ""}`)) return { status: "failed", account: null, missingScopes: [...REQUIRED_SCOPES],
      message: "This GitHub CLI version cannot report its sign-in status. Update gh, then check again." };
    if (error instanceof SyntaxError) return { status: "failed", account: null, missingScopes: [...REQUIRED_SCOPES], message: INVALID.message };
    return { status: "failed", account: null, missingScopes: [...REQUIRED_SCOPES], message: "GitHub CLI could not report its sign-in status." };
  }
  const account = typeof entry?.login === "string" && LOGIN.test(entry.login) ? entry.login : null;
  if (!entry || entry.state !== "success" || !account) {
    return { status: "signed-out", account: null, missingScopes: [...REQUIRED_SCOPES], message: "GitHub CLI is not signed in to github.com." };
  }
  const scopes = new Set(String(entry.scopes ?? "").split(",").map((scope) => scope.trim()).filter(Boolean));
  const missingScopes = REQUIRED_SCOPES.filter((scope) => !scopes.has(scope));
  return missingScopes.length ?
    { status: "missing-scopes", account, missingScopes, message: `GitHub CLI is signed in as @${account} without the ${missingScopes.join(" and ")} scope${missingScopes.length === 1 ? "" : "s"}.` } :
    { status: "ready", account, missingScopes: [], message: `GitHub CLI is signed in as @${account}.` };
}
