import { randomUUID } from "node:crypto";
import { mkdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { replaceFile } from "../../../lib/atomic-replace.mjs";
import { HttpError } from "./http.mjs";

export function participantWorkspace(copilotHome = process.env.COPILOT_HOME || resolve(homedir(), ".copilot")) {
  if (!isAbsolute(copilotHome)) throw new Error("COPILOT_HOME must be an absolute path for persistent workshop storage.");
  return resolve(copilotHome, "extensions", "governance-lab", "artifacts");
}

export async function lockDocument(file) {
  const lock = `${file}.lock`;
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      await mkdir(lock, { mode: 0o700 });
      return () => rmdir(lock);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        throw new HttpError(409, `Workshop storage is busy. Retry after other saves finish. If a provider crashed, close all workshop canvases and remove the abandoned lock directory: ${lock}`);
      }
      await setTimeout(25);
    }
  }
}

export async function importSessionDocument({ workspace, legacyWorkspace, documentId, content, createStore }) {
  if (!legacyWorkspace || resolve(legacyWorkspace) === resolve(workspace)) return;
  const legacyStore = createStore(legacyWorkspace, content);
  const file = resolve(workspace, "files", "governance-workshop", `${documentId}.json`);
  const source = resolve(legacyWorkspace, "files", "governance-workshop", `${documentId}.json`);
  try { await readFile(file); return; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  const release = await lockDocument(file);
  try {
    try { await readFile(file); return; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    let raw;
    try { raw = await readFile(source, "utf8"); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    // Keep the original bytes only if validation observed the same source.
    await legacyStore.read(documentId);
    if (await readFile(source, "utf8") !== raw) throw new HttpError(409, "Earlier session progress changed during import. Reopen the canvas to retry.");
    const pending = `${file}.${randomUUID()}.pending`;
    try {
      await writeFile(pending, raw, { flag: "wx", mode: 0o600 });
      await replaceFile(pending, file);
    } finally {
      try { await unlink(pending); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  } finally {
    await release();
  }
}
