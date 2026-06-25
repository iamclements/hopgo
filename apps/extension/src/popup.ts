import {
  DEFAULT_TENANT_ID,
  generateUniqueSlug,
  linkExists,
  putLink,
  type Link,
} from "@hopgo/shared";
import { clientFor, connect, currentConnection } from "./session.js";
import { addRecent, getRecent, getShortDomain } from "./storage.js";
import { buildShortUrl, type RecentLink } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const currentEl = $<HTMLDivElement>("current");
const connectBtn = $<HTMLButtonElement>("connect");
const shortenBtn = $<HTMLButtonElement>("shorten");
const msgEl = $<HTMLDivElement>("msg");
const resultEl = $<HTMLDivElement>("result");
const shortEl = $<HTMLElement>("short");
const copyBtn = $<HTMLButtonElement>("copy");
const recentEl = $<HTMLUListElement>("recent");

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

function renderRecent(links: RecentLink[]): void {
  recentEl.innerHTML = "";
  for (const link of links) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = link.shortUrl;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = link.shortUrl;
    li.appendChild(a);
    recentEl.appendChild(li);
  }
}

async function copy(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
  setMsg(`Copied ${text}`);
}

async function shorten(url: string): Promise<void> {
  const connection = await currentConnection();
  if (!connection) {
    setMsg("Sign in with Cloudflare first.", true);
    return;
  }
  const shortDomain = await getShortDomain();
  if (!shortDomain) {
    setMsg("Set your short-link domain in Settings first.", true);
    return;
  }

  shortenBtn.disabled = true;
  setMsg("Shortening...");
  try {
    const client = clientFor(connection);
    const slug = await generateUniqueSlug((candidate) => linkExists(client, candidate));
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
    await copy(shortUrl);
    renderRecent(await addRecent({ slug, url, shortUrl, createdAt: link.createdAt }));
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
  show(shortenBtn, connected);

  const url = await currentTabUrl();
  currentEl.textContent = url ?? "No active tab";

  if (connected) {
    renderRecent(await getRecent());
    if (!(await getShortDomain())) {
      setMsg("Set your short-link domain in Settings.", true);
    }
  } else {
    setMsg("Sign in with Cloudflare to start shortening.");
  }

  shortenBtn.onclick = () => {
    if (url) void shorten(url);
  };
}

connectBtn.addEventListener("click", async () => {
  connectBtn.disabled = true;
  setMsg("Opening Cloudflare sign-in...");
  try {
    await connect();
    setMsg("Connected.");
    await render();
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Sign-in failed", true);
  } finally {
    connectBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", () => {
  if (shortEl.textContent) void copy(shortEl.textContent);
});

$<HTMLButtonElement>("settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

void render();
