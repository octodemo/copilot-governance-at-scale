import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { extname, resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";

export const STATIC_CSP = "default-src 'none'; frame-ancestors *";
export const PAGE_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors *";

const STATIC_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export async function readJsonObject(req) {
  const input = await readJsonBody(req);
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpError(400, "Request body must be an object.");
  }
  return input;
}

export function writeJson(res, statusCode, value) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

/**
 * Route table for the canvas server.
 *
 * `register(method, path, handler, { auth })` adds a route. `path` is either an
 * exact pathname or a prefix ending in `/*`. `auth: "token"` requires the
 * per-instance `X-Canvas-Token` header and, when present, a same-origin
 * `Origin` header. Handlers receive `{ req, res, url, token, ...context }`.
 */
export function createRouter() {
  const routes = [];
  return {
    routes,
    register(method, path, handler, options = {}) {
      const auth = options.auth || "none";
      if (auth !== "none" && auth !== "token") {
        throw new Error(`Unknown route auth mode: ${auth}`);
      }
      routes.push({ method: method.toUpperCase(), path, handler, auth });
      return this;
    },
    match(method, pathname) {
      return routes.find((route) => route.method === method && (
        route.path.endsWith("/*")
          ? pathname.startsWith(route.path.slice(0, -1))
          : route.path === pathname
      ));
    }
  };
}

export async function serveStaticFile(res, filePath, cacheControl = "no-store") {
  const type = STATIC_TYPES[extname(filePath)];
  if (!type) {
    throw new HttpError(404, "Not found.");
  }
  let body;
  try {
    body = await readFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EISDIR") {
      throw new HttpError(404, "Not found.");
    }
    throw error;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Content-Security-Policy", STATIC_CSP);
  res.end(body);
}

export function resolveInside(directory, relativePath) {
  const root = resolve(directory);
  let decoded;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) {
    return null;
  }
  const target = resolve(root, `.${sep}${decoded}`);
  return target.startsWith(root + sep) ? target : null;
}

export function handleRequest(router, context) {
  return async (req, res) => {
    try {
      const address = context.server.address();
      const expectedHost = address && typeof address !== "string"
        ? `127.0.0.1:${address.port}`
        : null;
      if (req.headers.host !== expectedHost) {
        writeJson(res, 403, { message: "Invalid canvas request host." });
        return;
      }

      const expectedOrigin = `http://${expectedHost}`;
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const route = router.match(req.method, url.pathname);
      if (!route) {
        writeJson(res, 404, { message: "Not found." });
        return;
      }

      if (route.auth === "token") {
        if (
          req.headers.origin !== undefined &&
          req.headers.origin !== expectedOrigin
        ) {
          writeJson(res, 403, { message: "Invalid canvas request origin." });
          return;
        }
        if (req.headers["x-canvas-token"] !== context.token) {
          writeJson(res, 403, { message: "Invalid canvas request token." });
          return;
        }
      }

      await route.handler({ ...context, req, res, url });
    } catch (error) {
      if (error instanceof HttpError) {
        writeJson(res, error.statusCode, { message: error.message });
        return;
      }
      if (error?.userMessage) {
        writeJson(res, 409, { message: error.userMessage });
        return;
      }
      await context.log?.(`Governance Lab canvas error: ${error.message}`, {
        level: "error"
      });
      writeJson(res, 500, { message: "The canvas could not complete that request." });
    }
  };
}

export async function startServer({ router, context = {}, log }) {
  const token = randomBytes(24).toString("base64url");
  const server = createServer();
  server.on("request", handleRequest(router, { ...context, server, token, log }));

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve) => server.close(resolve));
    throw new Error("Could not determine the canvas server port.");
  }
  return {
    server,
    token,
    url: `http://127.0.0.1:${address.port}/`
  };
}
