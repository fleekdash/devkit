#!/usr/bin/env node
/**
 * fd-dev — zero-dependency dev server for FleekDash extensions.
 *
 * Serves a mock FleekDash host page that embeds your extension's built page
 * in an iframe and answers the real postMessage protocol with fixture data.
 *
 *   fd-dev --ext ../my-extension          serve <ext>/dist (or --page dir)
 *   fd-dev --ext ../my-extension/dist     serve that dir directly
 *   fd-dev --port 4400 --no-open
 */

import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, dirname, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const EXT_DIR = resolve(flag("ext", process.cwd()));
const PORT = Number(flag("port", 4400));
const NO_OPEN = args.includes("--no-open");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Pick the extension page to embed: --page, else first dist/pages/*.html, else error. */
async function resolveExtEntry() {
  const explicit = flag("page", null);
  if (explicit) return explicit;

  // Built output wins: Vite extensions keep an unbuilt source page under
  // pages/ that references /src/*.tsx — unusable in the browser.
  const candidates = [join(EXT_DIR, "dist", "pages"), join(EXT_DIR, "pages")];
  for (const dir of candidates) {
    if (await exists(dir)) {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".html"));
      if (files.length) {
        const rel = dir.endsWith(join("dist", "pages")) ? `dist/pages/${files[0]}` : `pages/${files[0]}`;
        return rel;
      }
    }
  }
  throw new Error(
    `No pages/*.html found under ${EXT_DIR} (or its dist/). Build the extension or pass --page <path>.`
  );
}

/** Static file response, path-traversal safe. */
async function sendFile(res, baseDir, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const filePath = resolve(join(baseDir, rel));
  if (!filePath.startsWith(resolve(baseDir) + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found: " + rel);
  }
}

const extEntry = await resolveExtEntry();
const iframeSrc = `/ext/${extEntry}?fleekdash_sdk_url=/sdk/fleekdash-sdk.js&_fleekdash_nonce=devkit`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (path === "/__shutdown" && req.method === "POST") {
    res.writeHead(204).end();
    server.close(() => process.exit(0));
    return;
  }
  if (path === "/" || path === "/canvas") {
    const html = (await readFile(join(ROOT, "canvas", "index.html"), "utf8")).replace(
      "__FD_IFRAME_SRC__",
      iframeSrc
    );
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
    return;
  }
  if (path.startsWith("/canvas/")) return sendFile(res, join(ROOT, "canvas"), path.slice(8));
  if (path.startsWith("/sdk/")) return sendFile(res, join(ROOT, "sdk"), path.slice(5));
  if (path === "/mock/manifest.json") {
    let fixtures = [];
    try {
      fixtures = (await readdir(join(EXT_DIR, "mock-data"))).filter(
        (name) => name.endsWith(".json") && !name.includes("/") && !name.includes("\\")
      );
    } catch {}
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(fixtures.map((name) => name.slice(0, -5))));
    return;
  }
  if (path.startsWith("/mock/")) {
    const name = path.slice(6);
    const extFixture = join(EXT_DIR, "mock-data", name);
    if (await exists(extFixture)) return sendFile(res, join(EXT_DIR, "mock-data"), name);
    return sendFile(res, join(ROOT, "mock-data"), name);
  }
  if (path.startsWith("/ext/")) return sendFile(res, EXT_DIR, path.slice(5));

  res.writeHead(404).end("Not found: " + path);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`FleekDash dev canvas → ${url}`);
  console.log(`  extension dir : ${EXT_DIR}`);
  console.log(`  iframe entry  : ${iframeSrc}`);
  if (!NO_OPEN) {
    const cmd =
      process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${cmd} ${url}`, () => {});
  }
});
