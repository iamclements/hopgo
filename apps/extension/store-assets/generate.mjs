/**
 * Generates Chrome Web Store promo tile PNGs from SVG definitions.
 * Run from repo root: node apps/extension/store-assets/generate.mjs
 *
 * Screenshots (screenshot-1-popup.png, screenshot-2-dashboard.png,
 * screenshot-3-setup.png) are NOT generated here - they're real captures of
 * the actual extension UI, taken by capture-screenshots.mjs in this same
 * directory. Promo tiles stay hand-illustrated SVG since they're marketing
 * graphics, not literal screenshots.
 */
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const OUT = join(dirname(fileURLToPath(import.meta.url)));
mkdirSync(OUT, { recursive: true });

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', 'Menlo', 'Courier New', monospace";
const BG = "#07090e";
const TEXT = "#eef1f6";
const MUTED = "#8a93a3";
const DIM = "#6b7a96";
const FAINT = "#4a5468";
const BLUE = "#2563eb";
const BLUE_BRIGHT = "#3b82f6";

const LOGO = (x, y, size) => `
  <circle cx="${x + size * 0.156}" cy="${y + size * 0.75}" r="${size * 0.109}" fill="${BLUE_BRIGHT}"/>
  <path d="M${x + size * 0.156} ${y + size * 0.75} Q ${x + size * 0.5} ${y + size * 0.0625} ${x + size * 0.844} ${y + size * 0.75}"
    stroke="${BLUE_BRIGHT}" stroke-width="${size * 0.125}" stroke-linecap="round" fill="none"/>
  <circle cx="${x + size * 0.844}" cy="${y + size * 0.75}" r="${size * 0.109}" fill="${BLUE_BRIGHT}"/>`;

function svgToPng(svg, _width, _height) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" },
  });
  return resvg.render().asPng();
}

// ── Small promo tile (440x280) ─────────────────────────────────────────────────
const promo = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280">
  <defs>
    <radialGradient id="g" cx="80%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${BLUE}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${BLUE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="440" height="280" fill="${BG}"/>
  <rect width="440" height="280" fill="url(#g)"/>
  ${Array.from({ length: 10 }, (_, i) => `<line x1="${i * 48}" y1="0" x2="${i * 48}" y2="280" stroke="white" stroke-opacity="0.025"/>`).join("")}
  ${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 48}" x2="440" y2="${i * 48}" stroke="white" stroke-opacity="0.025"/>`).join("")}

  <!-- Faint big mark -->
  <g opacity="0.07">
    ${LOGO(270, 40, 200)}
  </g>

  <text x="44" y="80" font-family="${MONO}" font-size="10" letter-spacing="2" fill="${BLUE_BRIGHT}">CHROME EXTENSION</text>

  <g style="filter:drop-shadow(0 0 14px rgba(59,130,246,0.55))">
    ${LOGO(44, 92, 44)}
  </g>
  <text x="100" y="128" font-family="${FONT}" font-size="52" font-weight="700" letter-spacing="-2" fill="${TEXT}">hop<tspan fill="${BLUE_BRIGHT}">go</tspan></text>

  <text x="44" y="164" font-family="${FONT}" font-size="16" font-weight="500" fill="${TEXT}">Your links. Your domain.</text>
  <text x="44" y="186" font-family="${FONT}" font-size="16" font-weight="500" fill="${TEXT}">Nothing to host.</text>
  <text x="44" y="210" font-family="${MONO}" font-size="11" fill="${FAINT}">Runs on your own Cloudflare account.</text>

  <rect x="44" y="230" width="52" height="22" rx="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="70" y="245" font-family="${MONO}" font-size="10" fill="${DIM}" text-anchor="middle">Free</text>
  <rect x="104" y="230" width="82" height="22" rx="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="145" y="245" font-family="${MONO}" font-size="10" fill="${DIM}" text-anchor="middle">Open source</text>
  <rect x="194" y="230" width="36" height="22" rx="11" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="212" y="245" font-family="${MONO}" font-size="10" fill="${DIM}" text-anchor="middle">MIT</text>
</svg>`;

// ── Marquee promo tile (1400x560) ─────────────────────────────────────────────
const marquee = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560">
  <defs>
    <radialGradient id="mg" cx="22%" cy="55%" r="45%">
      <stop offset="0%" stop-color="${BLUE}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${BLUE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1400" height="560" fill="${BG}"/>
  <rect width="1400" height="560" fill="url(#mg)"/>
  ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="560" stroke="white" stroke-opacity="0.022"/>`).join("")}
  ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 80}" x2="1400" y2="${i * 80}" stroke="white" stroke-opacity="0.022"/>`).join("")}

  <!-- Big faint mark -->
  <g opacity="0.06">
    ${LOGO(960, 80, 400)}
  </g>

  <!-- Logo + wordmark -->
  <g style="filter:drop-shadow(0 0 22px rgba(59,130,246,0.6))">
    ${LOGO(88, 108, 64)}
  </g>
  <text x="168" y="163" font-family="${FONT}" font-size="76" font-weight="700" letter-spacing="-3" fill="${TEXT}">hop<tspan fill="${BLUE_BRIGHT}">go</tspan></text>

  <!-- Headline -->
  <text x="88" y="228" font-family="${FONT}" font-size="36" font-weight="600" fill="${TEXT}" letter-spacing="-0.5">Your links. Your domain. Zero hosting.</text>

  <!-- Body -->
  <text x="88" y="270" font-family="${FONT}" font-size="19" fill="${MUTED}">A branded URL shortener that runs on your own Cloudflare account.</text>
  <text x="88" y="296" font-family="${FONT}" font-size="19" fill="${MUTED}">No server. No container. No third-party database.</text>

  <!-- Feature list -->
  ${[
    "One-click deploy to your domain or free workers.dev",
    "Custom slugs on every link",
    "Click tracking stored in your own KV",
    "Full link manager dashboard built into the extension",
    "Token auto-refresh — sign in once, stay signed in",
  ]
    .map(
      (line, i) => `
    <circle cx="100" cy="${366 + i * 34}" r="4" fill="${BLUE_BRIGHT}"/>
    <text x="118" y="${371 + i * 34}" font-family="${FONT}" font-size="16" fill="${TEXT}">${line}</text>
  `,
    )
    .join("")}

  <!-- Bottom bar -->
  <line x1="0" y1="504" x2="1400" y2="504" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="88" y="536" font-family="${MONO}" font-size="13" fill="${FAINT}">hopgo.co</text>
  <text x="1312" y="536" font-family="${MONO}" font-size="12" fill="${FAINT}" text-anchor="end">Cloudflare Edge · Chrome Extension · MIT</text>
</svg>`;

// ── Render all ─────────────────────────────────────────────────────────────────
const images = [
  ["promo-440x280.png", promo],
  ["promo-marquee-1400x560.png", marquee],
];

for (const [name, svg] of images) {
  const path = join(OUT, name);
  writeFileSync(path, svgToPng(svg));
  // eslint-disable-next-line no-undef
  console.log(`✓  ${name}`);
}

// eslint-disable-next-line no-undef
console.log("\nDone. Upload from apps/extension/store-assets/");
