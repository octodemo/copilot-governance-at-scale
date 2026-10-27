import { createWorkshop, loadContent } from "../../.github/extensions/governance-lab/content.mjs";
import { createStore } from "../../.github/extensions/governance-lab/state.mjs";
import { openServer } from "../../.github/extensions/governance-lab/server.mjs";

const args = process.argv.slice(2);
const [workspace, contentRoot] = args.filter((arg) => arg !== "--dev");
if (!workspace) throw new Error("Pass an absolute artifact workspace outside the repository.");
// An optional second argument serves test-owned fixture content instead of the authored workshop.
const workshop = await createWorkshop({
  load: () => loadContent(contentRoot ? { root: contentRoot } : {}),
  createStore: (content) => createStore(workspace, content),
});
const entry = await openServer({
  workshop, documentId: "preview", dev: args.includes("--dev"),
  discover: async () => ({ profile: null, error: { code: "not-found", message: "No lab enterprise found in this test preview." } }),
  checkAuth: async () => ({ status: "ready", account: "octocat", missingScopes: [], message: "GitHub CLI is signed in as @octocat." }),
  log: (message) => process.stderr.write(message + "\n")
});
process.stdout.write(entry.url + "\n");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    entry.server.close(() => process.exit(0));
    entry.server.closeAllConnections();
  });
}
