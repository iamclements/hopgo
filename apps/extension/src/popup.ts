import {
  DEFAULT_TENANT_ID,
  deleteLink,
  generateUniqueSlug,
  getClicks,
  isValidSlug,
  type Link,
  linkExists,
  listLinks,
  putLink,
} from "@hopgo/shared";
import { clientFor, currentConnection, disconnect } from "./session.js";
import {
  getCachedLinks,
  getActiveDomain,
  getDomainNamespaces,
  getDomains,
  setActiveDomain,
  setCachedLinks,
} from "./storage.js";
import { buildShortUrl } from "./util.js";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// Screens
const screenSignedOut = $("screenSignedOut");
const screenNoDomain = $("screenNoDomain");
const screenReady = $("screenReady");

// Header
const domainPillEl = $("domainPill");
const domainSelectEl = $<HTMLSelectElement>("domainSelect");

// Sign-out screen
const connectBtn = $<HTMLButtonElement>("connect");

// No-domain screen
const openSettingsBtn = $<HTMLButtonElement>("openSettings");
const signoutNoDomainBtn = $<HTMLButtonElement>("signoutNoDomain");

// Ready screen
const currentTabEl = $("currentTab");
const slugPrefixEl = $("slugPrefix");
const slugEl = $<HTMLInputElement>("slug");
const shortenBtn = $<HTMLButtonElement>("shorten");
const msgEl = $("msg");
const linksEl = $("links");
const signoutBtn = $<HTMLButtonElement>("signout");

let shortDomain = "";
let currentTabUrl = "";

// ── Helpers ──────────────────────────────────────────────────────────────

function showScreen(name: "signedOut" | "noDomain" | "ready"): void {
  screenSignedOut.classList.toggle("active", name === "signedOut");
  screenNoDomain.classList.toggle("active", name === "noDomain");
  screenReady.classList.toggle("active", name === "ready");
}

function setMsg(text: string, kind: "info" | "error" | "success" = "info"): void {
  msgEl.textContent = text;
  msgEl.className = `msg visible ${kind === "info" ? "" : kind}`;
}

function clearMsg(): void {
  msgEl.className = "msg";
  msgEl.textContent = "";
}

/** Best-effort hostname of the short domain for the pill, e.g. "go.acme.dev". */
function domainHost(d: string): string {
  try {
    return new URL(d).hostname;
  } catch {
    return d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

/** Derive a slug suggestion from a URL: last non-empty path segment, slugified. */
function slugFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] ?? "";
    return last
      .replace(/\.[^.]+$/, "") // strip file extension
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  } catch {
    return "";
  }
}

async function getTabUrl(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? "";
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

// ── Links rendering ───────────────────────────────────────────────────────

interface LinkWithClicks extends Link {
  clicks: number;
}

const COPY_ICON = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;

function renderLinks(links: LinkWithClicks[]): void {
  linksEl.innerHTML = "";
  if (links.length === 0) {
    const el = document.createElement("div");
    el.className = "no-links";
    el.textContent = "No links yet.";
    linksEl.appendChild(el);
    return;
  }
  for (const link of links) {
    const host = domainHost(shortDomain);
    const shortUrl = buildShortUrl(shortDomain, link.slug);

    const row = document.createElement("div");
    row.className = "link-row";

    const dot = document.createElement("span");
    dot.className = "link-dot";

    // Inner content column: short URL row + destination row
    const content = document.createElement("div");
    content.className = "link-content";

    const top = document.createElement("div");
    top.className = "link-top";

    const shortSpan = document.createElement("span");
    shortSpan.className = "link-short";
    shortSpan.innerHTML = `${escHtml(host)}/<span class="slug-part">${escHtml(link.slug)}</span>`;

    const copyIcon = document.createElement("span");
    copyIcon.className = "link-copy";
    copyIcon.innerHTML = COPY_ICON;
    copyIcon.title = "Click to copy";

    const clicks = document.createElement("span");
    clicks.className = "link-clicks";
    clicks.textContent = String(link.clicks);

    top.append(shortSpan, copyIcon, clicks);

    // Destination URL — strip protocol for display
    const dest = document.createElement("div");
    dest.className = "link-dest";
    dest.textContent = link.url.replace(/^https?:\/\//, "");
    dest.title = link.url;

    content.append(top, dest);

    const del = document.createElement("button");
    del.className = "link-del";
    del.textContent = "×";
    del.title = `Delete ${link.slug}`;
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm(`Delete ${host}/${link.slug}?`)) void removeLink(link.slug);
    });

    row.addEventListener("click", () => {
      void copyText(shortUrl).then(() => {
        setMsg(`Copied ${host}/${link.slug}`, "success");
        setTimeout(clearMsg, 2000);
      });
    });

    row.append(dot, content, del);
    linksEl.appendChild(row);
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function loadLinks(): Promise<void> {
  const connection = await currentConnection();
  if (!connection) return;

  // Use the namespace for the active domain; fall back to the connection default for
  // domains provisioned before per-domain namespaces were introduced.
  const namespaces = await getDomainNamespaces();
  const namespaceId = namespaces[shortDomain] ?? connection.namespaceId;
  const client = clientFor(connection, namespaceId);

  // Show cache immediately for instant feel.
  const cached = await getCachedLinks();
  if (cached.length) {
    renderLinks(cached.map((l) => ({ ...l, clicks: 0 })));
  }

  try {
    const { links } = await listLinks(client);
    links.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    // Fetch click counts in parallel.
    const clicks = await Promise.all(links.map((l) => getClicks(client, l.slug)));
    const withClicks: LinkWithClicks[] = links.map((l, i) => ({ ...l, clicks: clicks[i] ?? 0 }));

    renderLinks(withClicks);
    await setCachedLinks(links);
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Failed to load links", "error");
  }
}

async function removeLink(slug: string): Promise<void> {
  const connection = await currentConnection();
  if (!connection) return;
  try {
    const namespaces = await getDomainNamespaces();
    const namespaceId = namespaces[shortDomain] ?? connection.namespaceId;
    await deleteLink(clientFor(connection, namespaceId), slug);
    setMsg(`Deleted ${slug}`, "info");
    setTimeout(clearMsg, 2000);
    await loadLinks();
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Failed to delete", "error");
  }
}

// ── Shorten ───────────────────────────────────────────────────────────────

async function shorten(): Promise<void> {
  const connection = await currentConnection();
  if (!connection) return;

  const customSlug = slugEl.value.trim();
  if (customSlug && !isValidSlug(customSlug)) {
    setMsg("Slug: letters, numbers, - or _ only", "error");
    return;
  }

  shortenBtn.disabled = true;
  shortenBtn.innerHTML = '<span class="spinner"></span>Shortening…';
  clearMsg();

  try {
    const namespaces = await getDomainNamespaces();
    const namespaceId = namespaces[shortDomain] ?? connection.namespaceId;
    const client = clientFor(connection, namespaceId);
    let slug: string;

    if (customSlug) {
      if (await linkExists(client, customSlug)) {
        setMsg(`"${customSlug}" is already taken`, "error");
        return;
      }
      slug = customSlug;
    } else {
      slug = await generateUniqueSlug((c) => linkExists(client, c));
    }

    const link: Link = {
      slug,
      url: currentTabUrl,
      tenantId: DEFAULT_TENANT_ID,
      createdAt: new Date().toISOString(),
    };
    await putLink(client, link);

    const shortUrl = buildShortUrl(shortDomain, slug);
    await copyText(shortUrl);
    slugEl.value = "";

    setMsg(`Copied ${domainHost(shortDomain)}/${slug}`, "success");
    setTimeout(clearMsg, 3000);
    await loadLinks();
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Failed to shorten", "error");
  } finally {
    shortenBtn.disabled = false;
    shortenBtn.textContent = "Shorten";
  }
}

// ── Render / state machine ────────────────────────────────────────────────

async function render(): Promise<void> {
  const connection = await currentConnection();
  currentTabUrl = await getTabUrl();

  if (!connection) {
    showScreen("signedOut");
    return;
  }

  const [domains, activeDomain] = await Promise.all([getDomains(), getActiveDomain()]);
  shortDomain = activeDomain;
  if (!shortDomain) {
    showScreen("noDomain");
    return;
  }

  // Populate domain selector.
  domainSelectEl.innerHTML = "";
  for (const d of domains) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = domainHost(d);
    opt.selected = d === shortDomain;
    domainSelectEl.appendChild(opt);
  }
  const addOpt = document.createElement("option");
  addOpt.value = "__add__";
  addOpt.textContent = "+ Add domain";
  domainSelectEl.appendChild(addOpt);
  domainSelectEl.style.display = "";
  domainPillEl.style.display = "none";

  // Show the ready screen.
  const host = domainHost(shortDomain);
  slugPrefixEl.textContent = `${host} / `;
  currentTabEl.textContent = currentTabUrl || "No active tab";
  slugEl.value = currentTabUrl ? (slugFromUrl(currentTabUrl) ?? "") : "";
  slugEl.focus();

  showScreen("ready");
  void loadLinks();
}

// ── Event listeners ───────────────────────────────────────────────────────

connectBtn.addEventListener("click", () => {
  connectBtn.disabled = true;
  connectBtn.innerHTML = '<span class="spinner"></span>Opening Cloudflare…';
  chrome.runtime.sendMessage({ type: "connect" }, (res?: { ok: boolean; error?: string }) => {
    connectBtn.disabled = false;
    connectBtn.textContent = "Sign in with Cloudflare";
    if (chrome.runtime.lastError || !res) return;
    if (res.ok) {
      void render();
    } else {
      const s = screenSignedOut.querySelector(".signout-body");
      if (s) s.textContent = res.error ?? "Sign-in failed. Please try again.";
    }
  });
});

openSettingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

signoutNoDomainBtn.addEventListener("click", async () => {
  await disconnect();
  domainPillEl.style.display = "none";
  await render();
});

signoutBtn.addEventListener("click", async () => {
  await disconnect();
  domainPillEl.style.display = "none";
  await render();
});

$<HTMLButtonElement>("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

domainSelectEl.addEventListener("change", async () => {
  const selected = domainSelectEl.value;
  if (selected === "__add__") {
    chrome.runtime.openOptionsPage();
    // Reset select back to the current active domain.
    domainSelectEl.value = shortDomain;
    return;
  }
  await setActiveDomain(selected);
  shortDomain = selected;
  const host = domainHost(selected);
  slugPrefixEl.textContent = `${host} / `;
  void loadLinks();
});

shortenBtn.addEventListener("click", () => {
  if (currentTabUrl) void shorten();
});

slugEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void shorten();
});

void render();
