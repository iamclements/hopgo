import { getSettings, saveSettings } from "./storage.js";
import { normalizeBaseUrl } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const apiBaseUrlEl = $<HTMLInputElement>("apiBaseUrl");
const tokenEl = $<HTMLInputElement>("token");
const msgEl = $<HTMLDivElement>("msg");

function setMsg(text: string, isError = false): void {
  msgEl.textContent = text;
  msgEl.className = isError ? "msg error" : "msg";
}

/** Ask for host access to the API origin so the popup's fetch is allowed. */
async function requestHostAccess(baseUrl: string): Promise<boolean> {
  try {
    const origin = `${new URL(baseUrl).origin}/*`;
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

async function init(): Promise<void> {
  const settings = await getSettings();
  apiBaseUrlEl.value = settings.apiBaseUrl;
  tokenEl.value = settings.token ?? "";

  $<HTMLButtonElement>("save").addEventListener("click", async () => {
    const apiBaseUrl = normalizeBaseUrl(apiBaseUrlEl.value);
    if (!apiBaseUrl) {
      setMsg("Enter the control-plane API URL.", true);
      return;
    }
    if (!(await requestHostAccess(apiBaseUrl))) {
      setMsg("Host permission denied; the extension cannot reach that URL.", true);
      return;
    }
    await saveSettings({ apiBaseUrl, token: tokenEl.value.trim() || undefined });
    setMsg("Saved.");
  });
}

void init();
