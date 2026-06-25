import { shorten } from "./api.js";
import { addRecent, getRecent, getSettings } from "./storage.js";
import type { RecentLink } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const currentEl = $<HTMLDivElement>("current");
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

async function run(): Promise<void> {
  const url = await currentTabUrl();
  currentEl.textContent = url ?? "No active tab";
  renderRecent(await getRecent());

  shortenBtn.addEventListener("click", async () => {
    if (!url) return;
    shortenBtn.disabled = true;
    setMsg("Shortening...");
    try {
      const settings = await getSettings();
      const { link, shortUrl } = await shorten(settings, url);
      shortEl.textContent = shortUrl;
      resultEl.style.display = "flex";
      await copy(shortUrl);
      renderRecent(await addRecent({ slug: link.slug, url, shortUrl, createdAt: link.createdAt }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to shorten", true);
    } finally {
      shortenBtn.disabled = false;
    }
  });

  copyBtn.addEventListener("click", () => {
    if (shortEl.textContent) void copy(shortEl.textContent);
  });

  $<HTMLButtonElement>("settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

void run();
