import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRouter, HttpError, PAGE_CSP, STATIC_CSP, readJsonObject, serveStaticFile, startServer, writeJson
} from "./http.mjs";
import { escapeHtml } from "./ui/html.js";
import { discoverAccounts } from "./discover.mjs";
import { validateTerminalCommand } from "./terminal.mjs";
import { commandShellForPlatform } from "../../../lib/workshop-resolver.mjs";

const assets = new Map([
  ["/app.js", new URL("./ui/app.js", import.meta.url)],
  ["/model.js", new URL("./ui/model.js", import.meta.url)],
  ["/styles.css", new URL("./ui/styles.css", import.meta.url)],
  ["/html.js", new URL("./ui/html.js", import.meta.url)],
  ["/icons.js", new URL("./ui/icons.js", import.meta.url)],
  ["/markdown.js", new URL("./ui/markdown.js", import.meta.url)],
  ["/theme.js", new URL("./ui/theme.js", import.meta.url)],
  ["/primer.css", new URL("./ui/primer.css", import.meta.url)]
]);

const MAX_ATTACHMENT_CHARS = 50_000;
const MAX_BATCH_CHARS = 200_000;
const MAX_BATCH_REQUESTS = 20;
const MAX_PROMPT_CHARS = 4_000;
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

// Finds the parsed node whose source exactly matches the request. Clients
// never supply a path that is used directly; only known content sources resolve.
function findSource(content, { file, line, endLine }) {
  for (const block of content.paths) {
    let found = null;
    const visit = (value) => {
      if (found || !value || typeof value !== "object") return;
      if (Array.isArray(value)) { value.forEach(visit); return; }
      const source = value.source;
      if (source && source.file === file && source.line === line && source.endLine === endLine) { found = source; return; }
      for (const [key, child] of Object.entries(value)) if (key !== "source") visit(child);
    };
    visit(block);
    if (found) return { block, source: found };
  }
  return null;
}

async function attachmentFor(content, contentRoot, input) {
  const keys = Object.keys(input).sort().join(",");
  if (keys !== "endLine,file,label,line" && keys !== "endLine,file,line") throw new HttpError(400, "Expected file, line, endLine and optional label.");
  const { file, line, endLine, label = "" } = input;
  if (typeof file !== "string" || !Number.isInteger(line) || !Number.isInteger(endLine) || line < 1 || endLine < line || typeof label !== "string" || label.length > 200) {
    throw new HttpError(400, "Invalid source location.");
  }
  const match = findSource(content, { file, line, endLine });
  if (!match || match.block.source.file !== file) throw new HttpError(404, "That section is not part of the loaded workshop content.");
  const root = resolve(contentRoot), absolute = resolve(root, file);
  if (!absolute.startsWith(root + sep) || !absolute.endsWith(".md")) throw new HttpError(404, "That section is not part of the loaded workshop content.");
  let disk;
  try { disk = (await readFile(absolute, "utf8")).replace(/\r\n/g, "\n"); }
  catch { throw new HttpError(404, `Cannot read ${file}.`); }
  if (disk !== match.block.sourceText) throw new HttpError(409, `${file} changed on disk since content was loaded. Reload content, then pick the section again.`);
  const lines = disk.split("\n").slice(line - 1, endLine);
  while (lines.length > 1 && !lines.at(-1).trim()) lines.pop();
  const text = lines.join("\n");
  if (text.length > MAX_ATTACHMENT_CHARS) throw new HttpError(413, "That section is too large to attach. Pick a smaller section.");
  const lastLine = line + lines.length - 1;
  const name = file.split("/").at(-1);
  return {
    file, line, lastLine,
    attachment: {
    type: "selection",
    filePath: absolute,
    displayName: `${name}${label ? ` · ${label.replace(/\s+/g, " ").trim()}` : ""} (L${line}–${lastLine})`,
    text,
    selection: { start: { line: line - 1, character: 0 }, end: { line: lastLine - 1, character: lines.at(-1).length } },
    },
  };
}

// Builds one agent message: each request links its Markdown section, followed
// by the reviewer's prompt verbatim. Sections are also attached as selections.
async function messageFor(content, contentRoot, input) {
  if (Object.keys(input).join(",") !== "requests" || !Array.isArray(input.requests)) throw new HttpError(400, "Expected { requests: [...] }.");
  const { requests } = input;
  if (!requests.length || requests.length > MAX_BATCH_REQUESTS) throw new HttpError(400, `Send between 1 and ${MAX_BATCH_REQUESTS} requests at once.`);
  for (const [index, request] of requests.entries()) {
    const where = `Request ${index + 1}`;
    if (!request || typeof request !== "object" || Array.isArray(request)) throw new HttpError(400, `${where}: expected an object.`);
    if (typeof request.contentVersion !== "string" || request.contentVersion.length > 100) {
      throw new HttpError(400, `${where}: expected a contentVersion string of at most 100 characters.`);
    }
    if (request.contentVersion !== content.version) {
      throw new HttpError(409, `${where}: workshop content was reloaded after this section was picked. Reload content, then pick the section again.`);
    }
  }
  const selections = new Map(), parts = [];
  let total = 0;
  for (const [index, request] of requests.entries()) {
    const where = `Request ${index + 1}`;
    const { prompt, ...source } = request;
    delete source.contentVersion;
    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS) throw new HttpError(400, `${where}: enter a prompt of at most ${MAX_PROMPT_CHARS} characters.`);
    let section;
    try { section = await attachmentFor(content, contentRoot, source); }
    catch (error) { if (error instanceof HttpError) throw new HttpError(error.statusCode, `${where}: ${error.message}`); throw error; }
    const key = `${section.file}:${section.line}:${section.lastLine}`;
    if (!selections.has(key)) {
      total += section.attachment.text.length;
      if (total > MAX_BATCH_CHARS) throw new HttpError(413, "These sections are too large to send together. Send fewer or smaller sections.");
      selections.set(key, section.attachment);
    }
    parts.push(`[${section.file} (L${section.line}–${section.lastLine})](${section.file}#L${section.line}-L${section.lastLine})\n${prompt}`);
  }
  return { prompt: parts.join("\n\n"), attachments: [...selections.values()], count: parts.length };
}

export async function openServer({ content, store, workshop, documentId, log, dev = false, sendToAgent = null, openTerminal = null, contentRoot = repositoryRoot, discover = discoverAccounts, platform = process.platform }) {
  const commandShell = commandShellForPlatform(platform);
  const current = () => workshop?.snapshot() ?? { content, store };
  const discoveries = new Map();
  const router = createRouter()
    .register("GET", "/favicon.ico", ({ res }) => {
      res.statusCode = 204;
      res.end();
    })
    .register("GET", "/", async ({ res, token }) => {
      const html = await readFile(new URL("./ui/index.html", import.meta.url), "utf8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Security-Policy", PAGE_CSP);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.end(html.replace("{{TOKEN}}", escapeHtml(token)).replace("{{DEV}}", dev ? "true" : "false").replace("{{COMMAND_SHELL}}", commandShell));
    })
    .register("GET", "/lib/workshop-resolver.mjs", async ({ res }) => {
      const source = await readFile(new URL("../../../lib/workshop-resolver.mjs", import.meta.url));
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Security-Policy", STATIC_CSP);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(source);
    })
    .register("GET", "/api/bootstrap", async ({ res }) => {
      const { content, store } = current();
      writeJson(res, 200, { content, state: await store.read(documentId) });
    }, { auth: "token" })
    .register("POST", "/api/reload-content", async ({ res }) => {
      if (!dev || !workshop) throw new HttpError(404, "Content reload is only available in dev mode.");
      let next;
      try { next = await workshop.reload(); }
      catch (error) { throw new HttpError(422, `Content was not reloaded; the previous content and progress remain active.\n${error.message}`); }
      writeJson(res, 200, { content: next.content, state: await next.store.read(documentId) });
    }, { auth: "token" })
    .register("POST", "/api/dev/reset", async ({ req, res }) => {
      if (!dev) throw new HttpError(404, "Reset is only available in dev mode.");
      const input = await readJsonObject(req);
      const { content, store } = current();
      writeJson(res, 200, { content, state: await store.resetDocument(documentId, input) });
    }, { auth: "token" })
    .register("GET", "/api/dev/snapshots", async ({ res }) => {
      if (!dev) throw new HttpError(404, "Saved states are only available in dev mode.");
      writeJson(res, 200, { names: await current().store.listSnapshots() });
    }, { auth: "token" })
    .register("POST", "/api/dev/snapshots/save", async ({ req, res }) => {
      if (!dev) throw new HttpError(404, "Saved states are only available in dev mode.");
      const { contentVersion, ...input } = await readJsonObject(req);
      const { content, store } = current();
      if (contentVersion !== content.version) throw new HttpError(409, "Workshop content was reloaded. Reload before saving a state.");
      writeJson(res, 200, await store.saveSnapshot(documentId, input));
    }, { auth: "token" })
    .register("POST", "/api/dev/snapshots/restore", async ({ req, res }) => {
      if (!dev) throw new HttpError(404, "Saved states are only available in dev mode.");
      const { contentVersion, ...input } = await readJsonObject(req);
      const { content, store } = current();
      if (contentVersion !== content.version) throw new HttpError(409, "Workshop content was reloaded. Reload before restoring a state.");
      writeJson(res, 200, { content, state: await store.restoreSnapshot(documentId, input) });
    }, { auth: "token" })
    .register("POST", "/api/dev/send-requests", async ({ req, res }) => {
      if (!dev) throw new HttpError(404, "Section picking is only available in dev mode.");
      const input = await readJsonObject(req);
      const snapshot = current();
      const { prompt, attachments, count } = await messageFor(snapshot.content, contentRoot, input);
      if (current().content.version !== snapshot.content.version) {
        throw new HttpError(409, "Workshop content was reloaded while preparing the requests. Reload content, then pick the sections again.");
      }
      if (!sendToAgent) throw new HttpError(501, "This Copilot host cannot send messages to the agent.");
      try { await sendToAgent({ prompt, attachments }); }
      catch (error) { throw new HttpError(502, `Copilot did not accept the message: ${error.message}`); }
      writeJson(res, 200, { count });
    }, { auth: "token" })
    .register("POST", "/api/progress", async ({ req, res }) => {
      const { contentVersion, ...input } = await readJsonObject(req);
      writeJson(res, 200, await (workshop ? workshop.update(documentId, contentVersion, input) : store.update(documentId, input)));
    }, { auth: "token" })
    .register("POST", "/api/terminal", async ({ req, res }) => {
      const input = await readJsonObject(req);
      const snapshot = current();
      const state = await snapshot.store.read(documentId);
      const command = validateTerminalCommand(input, snapshot.content, state, commandShell);
      if (current().content.version !== snapshot.content.version) {
        throw new HttpError(409, "Content changed. Reload and review the command again.");
      }
      if (!openTerminal) throw new HttpError(501, "This host cannot open a terminal canvas. Copy the command into your terminal instead.");
      try { await openTerminal(command); }
      catch (error) {
        throw new HttpError(502, `Could not confirm that the terminal opened: ${error.message}. Check open terminals before trying again; the command may already have started.`);
      }
      writeJson(res, 200, { opened: true });
    }, { auth: "token" })
    .register("POST", "/api/profile", async ({ req, res }) => {
      const { contentVersion, ...input } = await readJsonObject(req);
      writeJson(res, 200, await (workshop ? workshop.updateProfile(documentId, contentVersion, input) : store.updateProfile(documentId, input)));
    }, { auth: "token" })
    .register("POST", "/api/profile/discover", async ({ req, res }) => {
      const input = await readJsonObject(req);
      if (Object.keys(input).some((key) => key !== "automatic") || (Object.hasOwn(input, "automatic") && typeof input.automatic !== "boolean")) {
        throw new HttpError(400, "Expected an optional automatic boolean.");
      }
      const automatic = input.automatic ?? false;
      // Read-only lookup; profile persistence still uses the revision-checked state layer.
      if (!discoveries.has(automatic)) {
        discoveries.set(automatic, Promise.resolve().then(() => discover({ automatic })).finally(() => discoveries.delete(automatic)));
      }
      writeJson(res, 200, await discoveries.get(automatic));
    }, { auth: "token" })
    .register("GET", "/api/export", async ({ res, url }) => {
      const format = url.searchParams.get("format") ?? "json";
      if (!["json", "markdown"].includes(format)) throw new HttpError(400, "Unknown export format.");
      const { store } = current();
      if (format === "markdown") {
        const markdown = await store.markdown(documentId);
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="governance-workshop.md"');
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.end(markdown);
        return;
      }
      res.setHeader("Content-Disposition", 'attachment; filename="governance-workshop.json"');
      writeJson(res, 200, await store.export(documentId));
    }, { auth: "token" });
  for (const [path, file] of assets) {
    router.register("GET", path, ({ res }) => serveStaticFile(res, fileURLToPath(file)));
  }
  return startServer({ router, log });
}
