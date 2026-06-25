import {
  DEFAULT_TENANT_ID,
  deleteLink,
  generateUniqueSlug,
  isValidSlug,
  type Link,
  linkExists,
  listLinks,
  putLink,
} from "@hopgo/shared";
import { clientFor, currentConnection, disconnect } from "./session.js";
import { getCachedLinks, getShortDomain, setCachedLinks } from "./storage.js";
import { buildShortUrl } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const currentEl = $<HTMLDivElement>("current");
const connectBtn = $<HTMLButtonElement>("connect");
const signoutBtn = $<HTMLButtonElement>("signout");
const slugEl = $<HTMLInputElement>("slug");
const shortenBtn = $<HTMLButtonElement>("shorten");
const msgEl = $<HTMLDivElement>("msg");
const resultEl = $<HTMLDivElement>("result");
const shortEl = $<HTMLElement>("short");
const copyBtn = $<HTMLButtonElement>("copy");
const linksEl = $<HTMLUListElement>("links");

let shortDomain = "";

function setMsg(text: string, isError = false): void {
  msgEl.textContent = text;
  msgEl.className = isError ? "msg error" : "msg";
}

function show(el: HTMLElement, visible: boolean): void {
  el.classList.toggle("hidden", !visible);
}

async function currentTabUrl(): Promise<string | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url;
}

async function copy(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  setMsg(`Copied ${text}`);
}

function renderLinks(links: Link[]): void {
  linksEl.innerHTML = "";
  if (links.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No links yet.";
    li.style.opacity = "0.6";
    linksEl.appendChild(li);
    return;
  }
  for (const link of links) {
    const shortUrl = buildShortUrl(shortDomain, link.slug);
    const li = document.createElement("li");

    const top = document.createElement("div");
    top.className = "recent-top";
    const a = document.createElement("a");
    a.href = shortUrl;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = shortUrl;
    const del = document.createElement("button");
    del.className = "secondary";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (confirm(`Delete ${shortUrl}?`)) void removeLink(link.slug);
    });
    top.append(a, del);

    // Target URL, truncated by default with a Show more / Show less toggle.
    const target = document.createElement("div");
    target.className = "recent-target";
    target.textContent = link.url;
    target.title = link.url;

    const toggle = document.createElement("button");
    toggle.className = "link recent-toggle";
    toggle.textContent = "Show more";
    toggle.addEventListener("click", () => {
      const expanded = target.classList.toggle("expanded");
      toggle.textContent = expanded ? "Show less" : "Show more";
    });

    li.append(top, target, toggle);
    linksEl.appendChild(li);

    // Only offer the toggle when the URL is actually clipped.
    if (target.scrollWidth <= target.clientWidth) {
      toggle.classList.add("hidden");
    }
  }
}

/**
 * Render the cached list instantly, then refresh from KV in the background and
 * update the cache. KV list returns keys only, so the fresh fetch reads each link
 * (slower); the cache makes opening the popup feel instant.
 */
async function loadLinks(): Promise<void> {
  const connection = await currentConnection();
  if (!connection) return;

  const cached = await getCachedLinks();
  if (cached.length) renderLinks(cached);

  try {
    const { links } = await listLinks(clientFor(connection));
    links.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    renderLinks(links);
    await setCachedLinks(links);
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Failed to load links", true);
  }
}

async function removeLink(slug: string): Promise<void> {
  const connection = await currentConnection();
  if (!connection) {
    setMsg("Sign in with Cloudflare first.", true);
    return;
  }
  try {
    await deleteLink(clientFor(connection), slug);
    setMsg(`Deleted ${slug}`);
    await loadLinks();
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Failed to delete", true);
  }
}

async function shorten(url: string): Promise<void> {
  const connection = await currentConnection();
  if (!connection) {
    setMsg("Sign in with Cloudflare first.", true);
    return;
  }
  if (!shortDomain) {
    setMsg("Set your short-link domain in Settings first.", true);
    return;
  }

  const customSlug = slugEl.value.trim();
  if (customSlug && !isValidSlug(customSlug)) {
    setMsg("Slug must be 1-128 chars of letters, numbers, - or _", true);
    return;
  }

  shortenBtn.disabled = true;
  setMsg("Shortening...");
  try {
    const client = clientFor(connection);
    let slug: string;
    if (customSlug) {
      if (await linkExists(client, customSlug)) {
        setMsg(`"${customSlug}" is already taken.`, true);
        return;
      }
      slug = customSlug;
    } else {
      slug = await generateUniqueSlug((candidate) => linkExists(client, candidate));
    }
    const link: Link = {
      slug,
      url,
      tenantId: DEFAULT_TENANT_ID,
      createdAt: new Date().toISOString(),
    };
    await putLink(client, link);

    const shortUrl = buildShortUrl(shortDomain, slug);
    shortEl.textContent = shortUrl;
    show(resultEl, true);
    slugEl.value = "";
    await copy(shortUrl);
    await loadLinks();
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Failed to shorten", true);
  } finally {
    shortenBtn.disabled = false;
  }
}

async function render(): Promise<void> {
  const connection = await currentConnection();
  const connected = connection !== null;
  show(connectBtn, !connected);
  show(signoutBtn, connected);
  show(shortenBtn, connected);
  show(slugEl, connected);

  const url = await currentTabUrl();
  currentEl.textContent = url ?? "No active tab";

  if (connected) {
    shortDomain = await getShortDomain();
    if (!shortDomain) setMsg("Set your short-link domain in Settings.", true);
    await loadLinks();
  } else {
    linksEl.innerHTML = "";
    setMsg("Sign in with Cloudflare to start shortening.");
  }

  shortenBtn.onclick = () => {
    if (url) void shorten(url);
  };
}

connectBtn.addEventListener("click", () => {
  setMsg("Opening Cloudflare sign-in...");
  // The flow runs in the background worker because this popup closes when the
  // Cloudflare window takes focus. If the popup survives, this callback updates it;
  // if not, reopening the popup shows the connected state.
  chrome.runtime.sendMessage({ type: "connect" }, (res?: { ok: boolean; error?: string }) => {
    if (chrome.runtime.lastError || !res) return;
    if (res.ok) {
      setMsg("Connected.");
      void render();
    } else {
      setMsg(res.error || "Sign-in failed", true);
    }
  });
});

copyBtn.addEventListener("click", () => {
  if (shortEl.textContent) void copy(shortEl.textContent);
});

signoutBtn.addEventListener("click", async () => {
  await disconnect();
  setMsg("Signed out.");
  await render();
});

$<HTMLButtonElement>("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

void render();
