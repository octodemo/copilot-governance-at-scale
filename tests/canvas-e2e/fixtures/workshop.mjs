import { fileURLToPath } from "node:url";

// Test-owned fictional workshop. Browser behaviour tests run against this
// fixture so routine edits to the authored content/ never break them.
export const FIXTURE_ROOT = fileURLToPath(new URL("./workshop/", import.meta.url));
