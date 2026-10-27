import { execFile } from "node:child_process";

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

export const GH_COMMANDS = Object.freeze({
  account: Object.freeze(["api", "user"]),
  organizations: Object.freeze(["api", "user/orgs", "--paginate", "--slurp"]),
  enterprises: Object.freeze(["api", "graphql", "--paginate", "--slurp", "-f", `query=${ENTERPRISES_QUERY}`]),
});

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
    const matches = result.enterprises.items.filter(({ slug }) => slug.toLowerCase().startsWith(LAB_PREFIX) && slug.length > LAB_PREFIX.length);
    if (matches.length !== 1) return { profile: null, error: {
      code: matches.length ? "ambiguous" : "not-found",
      message: matches.length ? `Multiple enterprises match ${LAB_PREFIX}. Choose your lab enterprise manually.` :
        `No enterprise matching ${LAB_PREFIX} was found for this GitHub CLI account.`,
    } };
    const slug = matches[0].slug;
    return { profile: { enterpriseSlug: slug, organizationSlug: slug } };
  }
  const { unauthenticated, ...output } = result;
  return output;
}
