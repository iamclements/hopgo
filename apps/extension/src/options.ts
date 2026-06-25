import { redirectUrl } from "./cf-oauth.js";
import { getShortDomain, setShortDomain } from "./storage.js";
import { normalizeBaseUrl } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const shortDomainEl = $<HTMLInputElement>("shortDomain");
const redirectEl = $<HTMLInputElement>("redirect");
const msgEl = $<HTMLDivElement>("msg");

function setMsg(text: string, isError = false): void {
  msgEl.textContent = text;
  msgEl.className = isError ? "msg error" : "msg";
}

async function init(): Promise<void> {
  shortDomainEl.value = await getShortDomain();
  // Show the redirect URL so the user can register it on their OAuth client.
  redirectEl.value = redirectUrl();

  $<HTMLButtonElement>("save").addEventListener("click", async () => {
    const shortDomain = normalizeBaseUrl(shortDomainEl.value);
    if (shortDomain && !/^https?:\/\//.test(shortDomain)) {
      setMsg("Short domain must start with http:// or https://", true);
      return;
    }
    await setShortDomain(shortDomain);
    setMsg("Saved.");
  });

  $<HTMLButtonElement>("copyRedirect").addEventListener("click", async () => {
    await navigator.clipboard.writeText(redirectEl.value);
    setMsg("Redirect URL copied.");
  });
}

void init();
