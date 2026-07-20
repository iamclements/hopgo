/**
 * Generates Chrome Web Store PNG assets from SVG definitions.
 * Run from repo root: node apps/extension/store-assets/generate.mjs
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
const SURFACE = "#0d111a";
const SURFACE2 = "#141822";
const BORDER = "#1b2230";
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

function svgToPng(svg, width, height) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { loadSystemFonts: true, defaultFontFamily: "Helvetica Neue" },
  });
  return resvg.render().asPng();
}

// ── Screenshot 1: Popup in action (1280x800) ─────────────────────────────────
const s1 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
  <defs>
    <radialGradient id="glow1" cx="30%" cy="55%" r="45%">
      <stop offset="0%" stop-color="${BLUE}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${BLUE}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="clip-popup">
      <rect x="820" y="72" width="360" height="490" rx="10"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="1280" height="800" fill="${BG}"/>
  <rect width="1280" height="800" fill="url(#glow1)"/>

  <!-- Grid -->
  ${Array.from({length: 18}, (_, i) => `<line x1="${i*72}" y1="0" x2="${i*72}" y2="800" stroke="white" stroke-opacity="0.022"/>`).join("")}
  ${Array.from({length: 12}, (_, i) => `<line x1="0" y1="${i*72}" x2="1280" y2="${i*72}" stroke="white" stroke-opacity="0.022"/>`).join("")}

  <!-- Left: headline -->
  <text x="100" y="220" font-family="${FONT}" font-size="13" font-weight="500" letter-spacing="3" fill="${BLUE_BRIGHT}" text-anchor="start">CHROME EXTENSION</text>
  <text x="100" y="295" font-family="${FONT}" font-size="64" font-weight="700" fill="${TEXT}" letter-spacing="-2">Shorten any tab.</text>
  <text x="100" y="372" font-family="${FONT}" font-size="64" font-weight="700" fill="${TEXT}" letter-spacing="-2">In one click.</text>
  <text x="100" y="445" font-family="${FONT}" font-size="20" fill="${MUTED}">Custom slug. Your domain.</text>
  <text x="100" y="472" font-family="${FONT}" font-size="20" fill="${MUTED}">Runs on your own Cloudflare account.</text>

  <!-- URL transform -->
  <rect x="100" y="530" width="620" height="52" rx="10" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>
  <text x="128" y="561" font-family="${MONO}" font-size="12" fill="${FAINT}">docs.acme.com/api/v3/getting-started/introduction</text>
  <text x="465" y="563" font-family="${FONT}" font-size="18" fill="${BLUE_BRIGHT}">→</text>
  <text x="490" y="561" font-family="${MONO}" font-size="12" fill="${BLUE_BRIGHT}" font-weight="500">go.acme.dev/api-intro</text>

  <!-- Popup shadow -->
  <rect x="818" y="70" width="364" height="494" rx="11" fill="black" fill-opacity="0.5"/>

  <!-- Popup body -->
  <rect x="820" y="72" width="360" height="490" rx="10" fill="${SURFACE2}" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>

  <!-- Popup header -->
  <rect x="820" y="72" width="360" height="48" rx="10" fill="rgba(255,255,255,0.025)"/>
  <rect x="820" y="100" width="360" height="20" fill="rgba(255,255,255,0.025)"/>
  <line x1="820" y1="120" x2="1180" y2="120" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  ${LOGO(838, 84, 24)}
  <text x="874" y="101" font-family="${FONT}" font-size="13" font-weight="700" fill="${TEXT}" letter-spacing="-0.2">hop<tspan fill="${BLUE_BRIGHT}">go</tspan></text>
  <rect x="930" y="88" width="84" height="18" rx="4" fill="rgba(37,99,235,0.15)"/>
  <text x="972" y="101" font-family="${MONO}" font-size="10" fill="${BLUE_BRIGHT}" text-anchor="middle">go.acme.dev</text>

  <!-- Current tab field -->
  <text x="838" y="147" font-family="${MONO}" font-size="9" letter-spacing="1.2" fill="${FAINT}">CURRENT TAB</text>
  <rect x="838" y="154" width="324" height="32" rx="6" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  <text x="850" y="174" font-family="${MONO}" font-size="10" fill="${DIM}">docs.acme.com/api/v3/getting-started</text>

  <!-- Slug field -->
  <text x="838" y="206" font-family="${MONO}" font-size="9" letter-spacing="1.2" fill="${FAINT}">YOUR SHORT LINK</text>
  <rect x="838" y="213" width="324" height="34" rx="6" fill="rgba(255,255,255,0.03)" stroke="${BLUE_BRIGHT}" stroke-width="1" stroke-opacity="0.4"/>
  <text x="852" y="234" font-family="${MONO}" font-size="11" fill="${BLUE_BRIGHT}" fill-opacity="0.65">go.acme.dev /</text>
  <text x="950" y="234" font-family="${MONO}" font-size="11" fill="${TEXT}">api-intro</text>

  <!-- Shorten button -->
  <rect x="838" y="258" width="324" height="36" rx="6" fill="${BLUE}"/>
  <text x="1000" y="281" font-family="${FONT}" font-size="13" font-weight="600" fill="white" text-anchor="middle">Shorten</text>

  <!-- Success msg -->
  <text x="1000" y="313" font-family="${MONO}" font-size="11" fill="#4ade80" text-anchor="middle">✓  Copied go.acme.dev/api-intro</text>

  <!-- Divider -->
  <line x1="838" y1="326" x2="1162" y2="326" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  <text x="838" y="344" font-family="${MONO}" font-size="9" letter-spacing="1.2" fill="${FAINT}">RECENT</text>

  <!-- Link rows -->
  ${[
    ["launch", "acme.com/blog/announcing-acme-v3", "248"],
    ["pricing", "acme.com/pricing", "91"],
    ["demo", "calendly.com/acme/demo-30min", "34"],
  ].map(([slug, dest, clicks], i) => `
    <circle cx="847" cy="${358 + i * 40}" r="3" fill="${BLUE}"/>
    <text x="858" y="${362 + i * 40}" font-family="${MONO}" font-size="10" fill="${TEXT}">go.acme.dev/<tspan fill="${BLUE_BRIGHT}">${slug}</tspan></text>
    <text x="858" y="${376 + i * 40}" font-family="${MONO}" font-size="9" fill="${FAINT}">${dest}</text>
    <text x="1152" y="${362 + i * 40}" font-family="${MONO}" font-size="10" fill="${FAINT}" text-anchor="end">${clicks}</text>
    <line x1="838" y1="${378 + i * 40}" x2="1162" y2="${378 + i * 40}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  `).join("")}

  <!-- Footer -->
  <line x1="820" y1="516" x2="1180" y2="516" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  <text x="838" y="534" font-family="${FONT}" font-size="11" fill="${FAINT}">Sign out</text>
  <text x="1162" y="534" font-family="${FONT}" font-size="11" fill="${BLUE_BRIGHT}" text-anchor="end">Manage all links →</text>
</svg>`;

// ── Screenshot 2: Dashboard (1280x800) ────────────────────────────────────────
const ROWS = [
  ["launch",   "acme.com/blog/announcing-acme-v3",           "248", ""],
  ["api-intro","docs.acme.com/api/v3/getting-started",       "91",  ""],
  ["pricing",  "acme.com/pricing",                           "184", "2026-08-01"],
  ["demo",     "calendly.com/acme/demo-30min",               "34",  ""],
  ["status",   "status.acme.com",                            "12",  ""],
];

const s2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
  <!-- Background -->
  <rect width="1280" height="800" fill="${BG}"/>
  ${Array.from({length: 18}, (_, i) => `<line x1="${i*72}" y1="0" x2="${i*72}" y2="800" stroke="white" stroke-opacity="0.018"/>`).join("")}
  ${Array.from({length: 12}, (_, i) => `<line x1="0" y1="${i*72}" x2="1280" y2="${i*72}" stroke="white" stroke-opacity="0.018"/>`).join("")}

  <!-- Topbar -->
  <rect width="1280" height="56" fill="rgba(7,9,14,0.95)"/>
  <line x1="0" y1="56" x2="1280" y2="56" stroke="${BORDER}" stroke-width="1"/>
  ${LOGO(28, 16, 26)}
  <text x="66" y="36" font-family="${FONT}" font-size="15" font-weight="700" fill="${TEXT}" letter-spacing="-0.3">hop<tspan fill="${BLUE_BRIGHT}">go</tspan></text>
  <line x1="110" y1="18" x2="110" y2="38" stroke="${BORDER}" stroke-width="1"/>
  <text x="124" y="36" font-family="${MONO}" font-size="11" letter-spacing="1.5" fill="${FAINT}">LINK MANAGER</text>
  <rect x="220" y="20" width="120" height="24" rx="5" fill="${SURFACE2}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="280" y="37" font-family="${MONO}" font-size="11" fill="${BLUE_BRIGHT}" text-anchor="middle">go.acme.dev</text>

  <!-- Toolbar -->
  <rect x="28" y="70" width="300" height="34" rx="6" fill="${SURFACE}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="52" y="92" font-family="${MONO}" font-size="12" fill="${FAINT}">Search slug or URL...</text>
  <text x="40" y="91" font-family="${FONT}" font-size="13" fill="${FAINT}">⌕</text>
  <rect x="340" y="70" width="140" height="34" rx="6" fill="${SURFACE}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="410" y="92" font-family="${MONO}" font-size="11" fill="${MUTED}" text-anchor="middle">Newest first</text>
  <text x="1252" y="93" font-family="${MONO}" font-size="11" fill="${FAINT}" text-anchor="end">5 links</text>

  <!-- Bulk bar -->
  <rect width="1280" height="40" y="114" fill="rgba(37,99,235,0.08)"/>
  <line x1="0" y1="154" x2="1280" y2="154" stroke="rgba(59,130,246,0.2)" stroke-width="1"/>
  <text x="28" y="139" font-family="${MONO}" font-size="12" fill="${BLUE_BRIGHT}">2 selected</text>
  <rect x="1136" y="122" width="112" height="26" rx="5" fill="rgba(248,113,113,0.12)" stroke="rgba(248,113,113,0.25)" stroke-width="1"/>
  <text x="1192" y="139" font-family="${FONT}" font-size="12" font-weight="600" fill="#f87171" text-anchor="middle">Delete selected</text>
  <rect x="1010" y="122" width="116" height="26" rx="5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.09)" stroke-width="1"/>
  <text x="1068" y="139" font-family="${FONT}" font-size="12" font-weight="600" fill="${MUTED}" text-anchor="middle">Clear selection</text>

  <!-- Table header -->
  <rect x="28" y="164" width="1224" height="36" rx="8" fill="${SURFACE}"/>
  <rect x="28" y="182" width="1224" height="18" fill="${SURFACE}"/>
  <line x1="28" y1="200" x2="1252" y2="200" stroke="${BORDER}" stroke-width="1"/>
  <text x="60" y="187" font-family="${MONO}" font-size="9" letter-spacing="1.2" fill="${FAINT}">SLUG</text>
  <text x="340" y="187" font-family="${MONO}" font-size="9" letter-spacing="1.2" fill="${FAINT}">DESTINATION</text>
  <text x="840" y="187" font-family="${MONO}" font-size="9" letter-spacing="1.2" fill="${FAINT}" text-anchor="end">CLICKS</text>
  <text x="900" y="187" font-family="${MONO}" font-size="9" letter-spacing="1.2" fill="${FAINT}">EXPIRES</text>

  <!-- Table rows -->
  ${ROWS.map(([slug, dest, clicks, expiry], i) => {
    const y = 200 + i * 50;
    const selected = i === 0 || i === 2;
    const expiringColor = expiry ? "#fbbf24" : DIM;
    return `
    <rect x="28" y="${y}" width="1224" height="50" fill="${selected ? 'rgba(37,99,235,0.06)' : (i % 2 === 1 ? 'rgba(255,255,255,0.01)' : SURFACE)}"/>
    <line x1="28" y1="${y+50}" x2="1252" y2="${y+50}" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
    <rect x="40" y="${y+18}" width="14" height="14" rx="2" fill="${selected ? BLUE : 'none'}" stroke="${selected ? BLUE : 'rgba(255,255,255,0.15)'}" stroke-width="1"/>
    ${selected ? `<text x="47" y="${y+29}" font-family="${FONT}" font-size="10" fill="white" text-anchor="middle">✓</text>` : ''}
    <text x="68" y="${y+29}" font-family="${MONO}" font-size="12" fill="${DIM}">go.acme.dev/<tspan fill="${BLUE_BRIGHT}">${slug}</tspan></text>
    <text x="340" y="${y+29}" font-family="${MONO}" font-size="11" fill="${MUTED}">${dest}</text>
    <text x="840" y="${y+29}" font-family="${MONO}" font-size="12" fill="${MUTED}" text-anchor="end">${clicks}</text>
    <text x="900" y="${y+29}" font-family="${MONO}" font-size="11" fill="${expiringColor}">${expiry || "—"}</text>
    `;
  }).join("")}

  <!-- Table bottom rounded -->
  <rect x="28" y="450" width="1224" height="8" rx="0" fill="${SURFACE}"/>
  <rect x="28" y="450" width="1224" height="14" rx="8" fill="${SURFACE}"/>
</svg>`;

// ── Screenshot 3: Setup page (1280x800) ───────────────────────────────────────
const s3 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">
  <defs>
    <radialGradient id="glow3" cx="72%" cy="50%" r="40%">
      <stop offset="0%" stop-color="${BLUE}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${BLUE}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="800" fill="${BG}"/>
  <rect width="1280" height="800" fill="url(#glow3)"/>
  ${Array.from({length: 18}, (_, i) => `<line x1="${i*72}" y1="0" x2="${i*72}" y2="800" stroke="white" stroke-opacity="0.022"/>`).join("")}
  ${Array.from({length: 12}, (_, i) => `<line x1="0" y1="${i*72}" x2="1280" y2="${i*72}" stroke="white" stroke-opacity="0.022"/>`).join("")}

  <!-- Left panel: headline -->
  <text x="100" y="200" font-family="${FONT}" font-size="13" font-weight="500" letter-spacing="3" fill="${BLUE_BRIGHT}">ONE-CLICK SETUP</text>
  <text x="100" y="272" font-family="${FONT}" font-size="58" font-weight="700" fill="${TEXT}" letter-spacing="-2">Deploy to your</text>
  <text x="100" y="342" font-family="${FONT}" font-size="58" font-weight="700" fill="${TEXT}" letter-spacing="-2">Cloudflare</text>
  <text x="100" y="412" font-family="${FONT}" font-size="58" font-weight="700" fill="${BLUE_BRIGHT}" letter-spacing="-2">in seconds.</text>

  <!-- Steps -->
  ${[
    ["1", "Sign in with Cloudflare", "OAuth PKCE — no password stored"],
    ["2", "Pick a domain (or use workers.dev)", "Free subdomain needs no custom domain"],
    ["3", "Click Deploy", "Worker + DNS configured automatically"],
  ].map(([n, title, sub], i) => `
    <circle cx="116" cy="${498 + i * 60}" r="16" fill="${BLUE}" fill-opacity="0.2" stroke="${BLUE}" stroke-width="1"/>
    <text x="116" y="${504 + i * 60}" font-family="${FONT}" font-size="13" font-weight="700" fill="${BLUE_BRIGHT}" text-anchor="middle">${n}</text>
    <text x="144" y="${499 + i * 60}" font-family="${FONT}" font-size="15" font-weight="600" fill="${TEXT}">${title}</text>
    <text x="144" y="${517 + i * 60}" font-family="${FONT}" font-size="13" fill="${MUTED}">${sub}</text>
  `).join("")}

  <!-- Right panel: settings card -->
  <!-- Card shadow -->
  <rect x="758" y="100" width="440" height="600" rx="12" fill="black" fill-opacity="0.4"/>
  <!-- Card bg -->
  <rect x="756" y="98" width="440" height="600" rx="12" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>

  <!-- Card header -->
  ${LOGO(776, 118, 24)}
  <text x="812" y="136" font-family="${FONT}" font-size="14" font-weight="700" fill="${TEXT}">hop<tspan fill="${BLUE_BRIGHT}">go</tspan></text>
  <text x="862" y="134" font-family="${MONO}" font-size="10" letter-spacing="1.5" fill="${FAINT}">SETTINGS</text>

  <!-- Callout -->
  <rect x="776" y="152" width="400" height="88" rx="8" fill="rgba(37,99,235,0.08)" stroke="rgba(59,130,246,0.25)" stroke-width="1"/>
  <text x="796" y="173" font-family="${FONT}" font-size="13" font-weight="600" fill="${TEXT}">Before you start</text>
  <text x="796" y="192" font-family="${FONT}" font-size="12" fill="${MUTED}">• Free Cloudflare account required (no card needed)</text>
  <text x="796" y="210" font-family="${FONT}" font-size="12" fill="${MUTED}">• No domain? Use the free workers.dev path below</text>
  <text x="796" y="228" font-family="${FONT}" font-size="12" fill="${MUTED}">• Have a domain? One-click deploy handles everything</text>

  <!-- Workers.dev card -->
  <rect x="776" y="252" width="400" height="100" rx="8" fill="rgba(37,99,235,0.05)" stroke="rgba(59,130,246,0.2)" stroke-width="1"/>
  <text x="796" y="277" font-family="${FONT}" font-size="14" font-weight="600" fill="${TEXT}">Free setup — no domain required</text>
  <text x="796" y="297" font-family="${FONT}" font-size="12" fill="${MUTED}">Deploy to workers.dev. No DNS setup needed.</text>
  <rect x="796" y="310" width="180" height="30" rx="6" fill="${BLUE}"/>
  <text x="886" y="329" font-family="${FONT}" font-size="13" font-weight="600" fill="white" text-anchor="middle">Deploy to workers.dev</text>

  <!-- Custom domain card -->
  <rect x="776" y="364" width="400" height="120" rx="8" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>
  <rect x="776" y="364" width="400" height="40" rx="8" fill="rgba(255,255,255,0.02)"/>
  <rect x="776" y="388" width="400" height="16" fill="rgba(255,255,255,0.02)"/>
  <text x="796" y="390" font-family="${FONT}" font-size="14" font-weight="600" fill="${TEXT}">Custom domain setup</text>
  <text x="796" y="414" font-family="${FONT}" font-size="12" fill="${MUTED}">Subdomain</text>
  <rect x="796" y="422" width="68" height="28" rx="5" fill="${SURFACE2}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="830" y="440" font-family="${MONO}" font-size="11" fill="${TEXT}" text-anchor="middle">go</text>
  <text x="874" y="440" font-family="${MONO}" font-size="12" fill="${FAINT}">.</text>
  <rect x="882" y="422" width="168" height="28" rx="5" fill="${SURFACE2}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="966" y="440" font-family="${MONO}" font-size="11" fill="${TEXT}" text-anchor="middle">acme.dev</text>
  <rect x="1060" y="422" width="50" height="28" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
  <text x="1085" y="440" font-family="${FONT}" font-size="12" font-weight="600" fill="${MUTED}" text-anchor="middle">Load</text>
  <rect x="1120" y="422" width="56" height="28" rx="5" fill="${BLUE}"/>
  <text x="1148" y="440" font-family="${FONT}" font-size="12" font-weight="600" fill="white" text-anchor="middle">Deploy</text>

  <!-- Saved domains card -->
  <rect x="776" y="496" width="400" height="90" rx="8" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1"/>
  <text x="796" y="520" font-family="${FONT}" font-size="14" font-weight="600" fill="${TEXT}">Your domains</text>
  <rect x="796" y="530" width="360" height="28" rx="5" fill="rgba(37,99,235,0.08)" stroke="rgba(59,130,246,0.4)" stroke-width="1"/>
  <circle cx="810" cy="544" r="3" fill="${BLUE_BRIGHT}"/>
  <text x="822" y="548" font-family="${MONO}" font-size="11" fill="${BLUE_BRIGHT}">go.acme.dev</text>
  <text x="1146" y="548" font-family="${MONO}" font-size="10" fill="${FAINT}" text-anchor="end">Remove</text>
</svg>`;

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
  ${Array.from({length: 10}, (_, i) => `<line x1="${i*48}" y1="0" x2="${i*48}" y2="280" stroke="white" stroke-opacity="0.025"/>`).join("")}
  ${Array.from({length: 7}, (_, i) => `<line x1="0" y1="${i*48}" x2="440" y2="${i*48}" stroke="white" stroke-opacity="0.025"/>`).join("")}

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
  ${Array.from({length: 20}, (_, i) => `<line x1="${i*80}" y1="0" x2="${i*80}" y2="560" stroke="white" stroke-opacity="0.022"/>`).join("")}
  ${Array.from({length: 8}, (_, i) => `<line x1="0" y1="${i*80}" x2="1400" y2="${i*80}" stroke="white" stroke-opacity="0.022"/>`).join("")}

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
  ].map((line, i) => `
    <circle cx="100" cy="${366 + i * 34}" r="4" fill="${BLUE_BRIGHT}"/>
    <text x="118" y="${371 + i * 34}" font-family="${FONT}" font-size="16" fill="${TEXT}">${line}</text>
  `).join("")}

  <!-- Bottom bar -->
  <line x1="0" y1="504" x2="1400" y2="504" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="88" y="536" font-family="${MONO}" font-size="13" fill="${FAINT}">hopgo.co</text>
  <text x="1312" y="536" font-family="${MONO}" font-size="12" fill="${FAINT}" text-anchor="end">Cloudflare Edge · Chrome Extension · MIT</text>
</svg>`;

// ── Render all ─────────────────────────────────────────────────────────────────
const images = [
  ["screenshot-1-popup.png",     s1],
  ["screenshot-2-dashboard.png", s2],
  ["screenshot-3-setup.png",     s3],
  ["promo-440x280.png",          promo],
  ["promo-marquee-1400x560.png", marquee],
];

for (const [name, svg] of images) {
  const path = join(OUT, name);
  writeFileSync(path, svgToPng(svg));
  console.log(`✓  ${name}`);
}

console.log("\nDone. Upload from apps/extension/store-assets/");
