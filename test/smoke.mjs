/**
 * Smoke test - starts fd-dev against a synthetic extension dir and asserts
 * the server surface + the mock host message router (node side).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4799;

const tmp = mkdtempSync(join(tmpdir(), "fd-dev-"));
mkdirSync(join(tmp, "pages"), { recursive: true });
writeFileSync(join(tmp, "pages", "app.html"), "<html><body>ext</body></html>");

const child = spawn(process.execPath, [join(ROOT, "bin", "fd-dev.mjs"), "--ext", tmp, "--port", String(PORT), "--no-open"], { stdio: "ignore" });

const get = (p) => fetch(`http://localhost:${PORT}${p}`);

let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? "ok" : "FAIL"}  ${name}`);
  if (!ok) failures++;
};

try {
  await new Promise((r) => setTimeout(r, 900));

  const home = await (await get("/")).text();
  check("canvas serves iframe src", home.includes("/ext/pages/app.html?fleekdash_sdk_url=/sdk/fleekdash-sdk.js"));

  const sdk = await (await get("/sdk/fleekdash-sdk.js")).text();
  check("sdk file served", sdk.includes("FleekDashSDK"));

  const posts = await (await get("/mock/posts.json")).json();
  check("mock posts served", Array.isArray(posts) && posts.length === 3);

  const ext = await (await get("/ext/pages/app.html")).text();
  check("ext file served", ext.includes("ext"));

  const traversal = await get("/ext/../package.json");
  check("path traversal blocked", traversal.status === 403 || traversal.status === 404);

  // Mock host router as a module (UMD tail sets globalThis.FDMockHost in ESM).
  await import("../canvas/mock-host.js");
  const { createMockHost } = globalThis.FDMockHost;
  const calls = [];
  const fakeSource = { postMessage: (m) => calls.push(m) };
  const host = createMockHost({ data: { posts }, onLog: () => {} });

  host.handleMessage({
    source: fakeSource,
    data: { type: "FLEEKDASH_MESSAGE", payload: { requestId: 1, integration_id: "demo", messageType: "WP_DATA_REQUEST", data: { endpoint: "/wp/v2/posts" } } },
  });
  check("WP_DATA_REQUEST responds", calls[0]?.type === "FLEEKDASH_RESPONSE" && calls[0].payload.data.length === 3);

  host.handleMessage({
    source: fakeSource,
    data: { type: "FLEEKDASH_MESSAGE", payload: { requestId: 2, messageType: "GET_INTEGRATION_SETTINGS", data: {}, integration_id: "demo" } },
  });
  check("settings respond", calls[1]?.payload?.success === true && typeof calls[1].payload.data === "object");

  host.handleMessage({
    source: fakeSource,
    data: { type: "FLEEKDASH_MESSAGE", payload: { requestId: 3, messageType: "NOPE", data: {} } },
  });
  check("unknown type errors", calls[2]?.payload?.success === false);
} finally {
  try {
    await fetch(`http://localhost:${PORT}/__shutdown`, { method: "POST" });
  } catch {
    child.kill();
  }
  await Promise.race([
    new Promise((r) => child.once("exit", r)),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
  rmSync(tmp, { recursive: true, force: true });
}

process.exit(failures ? 1 : 0);
