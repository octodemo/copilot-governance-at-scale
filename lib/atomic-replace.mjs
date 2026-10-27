import { rename } from "node:fs/promises";

// Windows refuses to replace a file while another handle (a concurrent reader,
// antivirus or indexer) has it open, failing with EPERM, EACCES or EBUSY.
// These conditions clear once the handle closes, so retry with bounded backoff.
const TRANSIENT = new Set(["EPERM", "EACCES", "EBUSY"]);

export async function replaceFile(source, destination, {
  platform = process.platform, attempts = 20, delayMs = 10, renameFile = rename,
} = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await renameFile(source, destination); }
    catch (error) {
      if (platform !== "win32" || !TRANSIENT.has(error?.code) || attempt >= attempts) throw error;
      await new Promise((done) => setTimeout(done, Math.min(delayMs * attempt, 100)));
    }
  }
}
