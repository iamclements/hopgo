import type { CloudflareZone } from "@hopgo/shared";
import { redirectUrl } from "./cf-oauth.js";
import { loadZones, provisionZone } from "./setup.js";
import { getShortDomain, setShortDomain } from "./storage.js";
import { normalizeBaseUrl } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const shortDomainEl = $<HTMLInputElement>("shortDomain");
const redirectEl = $<HTMLInputElement>("redirect");
const zoneEl = $<HTMLSelectElement>("zone");
const deployBtn = $<HTMLButtonElement>("deploy");
const msgEl = $<HTMLDivElement>("msg");

function setMsg(text: string, isError = false): void {
  msgEl.textContent = text;
  msgEl.className = isError ? "msg error" : "msg";
}

let zones: CloudflareZone[] = [];

async function refreshZones(): Promise<void> {
  setMsg("Loading your Cloudflare domains...");
  try {
    zones = await loadZones();
    zoneEl.innerHTML = "";
    if (zones.length === 0) {
      setMsg("No domains found on this Cloudflare account.", true);
      deployBtn.disabled = true;
      return;
    }
    for (const zone of zones) {
      const option = document.createElement("option");
      option.value = zone.id;
      option.textContent = zone.name;
      zoneEl.appendChild(option);
    }
    deployBtn.disabled = false;
    setMsg("Pick a domain and deploy the redirect Worker.");
  } catch (err) {
    setMsg(err instanceof Error ? err.message : "Failed to load domains", true);
  }
}

async function init(): Promise<void> {
  shortDomainEl.value = await getShortDomain();
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

  $<HTMLButtonElement>("loadZones").addEventListener("click", () => void refreshZones());

  deployBtn.addEventListener("click", async () => {
    const zone = zones.find((z) => z.id === zoneEl.value);
    if (!zone) return;
    deployBtn.disabled = true;
    setMsg(`Deploying Hopgo to ${zone.name}...`);
    try {
      const shortDomain = await provisionZone(zone);
      await setShortDomain(shortDomain);
      shortDomainEl.value = shortDomain;
      setMsg(`Done. Short links will be served at ${shortDomain}.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Setup failed", true);
    } finally {
      deployBtn.disabled = false;
    }
  });
}

void init();
