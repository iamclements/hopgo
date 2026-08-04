/**
 * Captures real Chrome Web Store screenshots from the actual built extension,
 * rather than hand-illustrated mockups. Loads apps/extension/dist unpacked in
 * a real Chromium instance, seeds chrome.storage.local with a signed-in
 * connection and a realistic demo link set, mocks the Cloudflare KV REST API
 * so the genuine UI code renders genuine (fake-but-realistic) data, then
 * screenshots dashboard.html and options.html directly at 1280x800 and
 * composites the popup (which is a fixed ~360px-wide UI, too narrow to meet
 * the Chrome Web Store's screenshot size requirement on its own) onto a
 * 1280x800 branded background.
 *
 * Requires: pnpm --filter @hopgo/extension build (run first, or this reads a
 * stale dist/).
 * Run from repo root: node apps/extension/store-assets/capture-screenshots.mjs
 */
import { chromium } from "playwright";
import { Resvg } from "@resvg/resvg-js";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const OUT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(OUT, "..", "..", "..");
const EXT_PATH = join(REPO_ROOT, "apps", "extension", "dist");
const USER_DATA_DIR = mkdtempSync(join(tmpdir(), "hopgo-store-shots-"));

const BG = "#07090e";
const BLUE = "#2563eb";

const DOMAIN = "https://go.acme.dev";
const FAR_FUTURE = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365;

// Same fictional dataset as the marketing site's hero mockup, for brand
// consistency. createdAt descends explicitly (launch newest) so "Newest
// first" puts the flagship link on top instead of relying on object-
// construction timing, which is not a reliable way to control display order.
const t = Date.now();
const LINKS = [
  {
    slug: "launch",
    url: "https://acme.com/blog/announcing-acme-v3",
    createdAt: new Date(t).toISOString(),
    clicks: 248,
  },
  {
    slug: "api-intro",
    url: "https://docs.acme.com/api/v3/getting-started",
    createdAt: new Date(t - 3600_000).toISOString(),
    clicks: 91,
  },
  {
    slug: "pricing",
    url: "https://acme.com/pricing",
    createdAt: new Date(t - 7200_000).toISOString(),
    expiresAt: FAR_FUTURE,
    clicks: 184,
  },
  {
    slug: "demo",
    url: "https://calendly.com/acme/demo-30min",
    createdAt: new Date(t - 10800_000).toISOString(),
    clicks: 34,
  },
  {
    slug: "status",
    url: "https://status.acme.com",
    createdAt: new Date(t - 14400_000).toISOString(),
    clicks: 12,
  },
];

function svgToPng(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" },
  });
  return resvg.render().asPng();
}

/** Composite a screenshot PNG buffer onto a branded 1280x800 canvas, centered. */
function compositeOnCanvas(pngBuffer, width, height) {
  const b64 = pngBuffer.toString("base64");
  const x = Math.round((1280 - width) / 2);
  const y = Math.round((800 - height) / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
    <defs>
      <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
        <path d="M 72 0 L 0 0 0 72" fill="none" stroke="#ffffff" stroke-opacity="0.022"/>
      </pattern>
      <radialGradient id="glow" cx="35%" cy="50%" r="55%">
        <stop offset="0%" stop-color="${BLUE}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${BLUE}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1280" height="800" fill="${BG}"/>
    <rect width="1280" height="800" fill="url(#grid)"/>
    <rect width="1280" height="800" fill="url(#glow)"/>
    <image x="${x}" y="${y}" width="${width}" height="${height}" href="data:image/png;base64,${b64}"/>
  </svg>`;
  return svgToPng(svg);
}

const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false, // MV3 extensions require headed (or headless=new) mode
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
});

try {
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 10000 });
  const extensionId = worker.url().split("/")[2];

  // ── Mock the Cloudflare KV REST API so the real UI code renders real data ──
  await context.route("https://api.cloudflare.com/client/v4/**", async (route) => {
    // eslint-disable-next-line no-undef
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (url.pathname.endsWith("/keys")) {
      const keys = LINKS.map((l) => ({
        name: l.slug,
        ...(l.expiresAt ? { expiration: l.expiresAt } : {}),
      }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, errors: [], result: keys, result_info: {} }),
      });
    }

    const valuesMatch = url.pathname.match(/\/values\/(.+)$/);
    if (valuesMatch && method === "GET") {
      const key = decodeURIComponent(valuesMatch[1]);
      if (key.startsWith("clicks:")) {
        const slug = key.slice("clicks:".length);
        const link = LINKS.find((l) => l.slug === slug);
        return route.fulfill({ status: 200, body: String(link?.clicks ?? 0) });
      }
      const link = LINKS.find((l) => l.slug === key);
      if (!link) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          url: link.url,
          tenantId: "demo",
          createdAt: link.createdAt,
          ...(link.expiresAt ? { expiresAt: link.expiresAt } : {}),
        }),
      });
    }

    // Anything else (writes, deletes) during a screenshot session: no-op ok.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, errors: [], result: {} }),
    });
  });

  // ── Seed storage: a non-expired connection + configured domain, so the UI
  //    renders its normal "signed in" state instead of the sign-in screen ──
  const seedPage = await context.newPage();
  await seedPage.goto(`chrome-extension://${extensionId}/options.html`);
  await seedPage.evaluate(
    ({ domain, far }) =>
      // eslint-disable-next-line no-undef -- runs in the extension page, not this Node process
      chrome.storage.local.set({
        connection: {
          accessToken: "demo-token",
          expiresAt: far * 1000,
          accountId: "demo-account",
          namespaceId: "demo-namespace",
        },
        domains: [domain],
        activeDomain: domain,
        domainNamespaces: { [domain]: "demo-namespace" },
        linksCache: [],
      }),
    { domain: DOMAIN, far: FAR_FUTURE },
  );
  await seedPage.close();

  // ── Dashboard (1280x800, real data via the mocked API) ──
  const dashPage = await context.newPage();
  await dashPage.setViewportSize({ width: 1280, height: 800 });
  await dashPage.goto(`chrome-extension://${extensionId}/dashboard.html`);
  await dashPage.waitForTimeout(800); // let listLinks + per-slug getClicks calls resolve
  writeFileSync(join(OUT, "screenshot-2-dashboard.png"), await dashPage.screenshot());
  await dashPage.close();
  // eslint-disable-next-line no-undef
  console.log("✓  screenshot-2-dashboard.png");

  // ── Options / setup (1280x800, storage-only, no network needed) ──
  const optPage = await context.newPage();
  await optPage.setViewportSize({ width: 1280, height: 800 });
  await optPage.goto(`chrome-extension://${extensionId}/options.html`);
  await optPage.waitForTimeout(300);
  writeFileSync(join(OUT, "screenshot-3-setup.png"), await optPage.screenshot());
  await optPage.close();
  // eslint-disable-next-line no-undef
  console.log("✓  screenshot-3-setup.png");

  // ── Popup: native ~360px-wide UI, composited onto a 1280x800 branded
  //    canvas (Chrome Web Store requires exactly 1280x800 or 640x400) ──
  const popupPage = await context.newPage();
  await popupPage.addInitScript(() => {
    // Override for a realistic, presentable demo tab instead of whatever tab
    // this Chromium instance actually has active.
    // eslint-disable-next-line no-undef -- runs in the extension page, not this Node process
    chrome.tabs.query = (_query, cb) => {
      const tabs = [
        {
          id: 1,
          url: "https://github.com/org/hopgo/blob/main/README.md",
          active: true,
          currentWindow: true,
        },
      ];
      if (cb) {
        cb(tabs);
        return undefined;
      }
      return Promise.resolve(tabs);
    };
  });
  await popupPage.setViewportSize({ width: 360, height: 640 });
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForTimeout(500);
  const popupBox = await popupPage.evaluate(() => {
    // eslint-disable-next-line no-undef -- runs in the extension page, not this Node process
    document.body.style.height = "auto";
    // eslint-disable-next-line no-undef -- runs in the extension page, not this Node process
    const rect = document.body.getBoundingClientRect();
    return { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
  });
  await popupPage.setViewportSize({ width: popupBox.width, height: popupBox.height });
  const popupPng = await popupPage.screenshot();
  await popupPage.close();
  writeFileSync(
    join(OUT, "screenshot-1-popup.png"),
    compositeOnCanvas(popupPng, popupBox.width, popupBox.height),
  );
  // eslint-disable-next-line no-undef
  console.log("✓  screenshot-1-popup.png");

  // eslint-disable-next-line no-undef
  console.log("\nDone. Upload from apps/extension/store-assets/");
} finally {
  await context.close();
  rmSync(USER_DATA_DIR, { recursive: true, force: true });
}
