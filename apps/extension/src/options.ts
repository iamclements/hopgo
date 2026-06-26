import type { CloudflareZone } from "@hopgo/shared";
import { loadZones, provisionZone } from "./setup.js";
import { getShortDomain, setShortDomain } from "./storage.js";
import { normalizeBaseUrl } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const shortDomainEl = $<HTMLInputElement>("shortDomain");
const zoneEl = $<HTMLSelectElement>("zone");
const subdomainEl = $<HTMLInputElement>("subdomain");
const deployBtn = $<HTMLButtonElement>("deploy");
const msgEl = $<HTMLDivElement>("msg");

function setMsg(text: string, isError = false): void {
  msgEl.textContent = text;
  msgEl.className = `msg visible${isError ? " error" : ""}`;
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

  $<HTMLButtonElement>("save").addEventListener("click", async () => {
    const shortDomain = normalizeBaseUrl(shortDomainEl.value);
    if (shortDomain && !/^https?:\/\//.test(shortDomain)) {
      setMsg("Short domain must start with http:// or https://", true);
      return;
    }
    await setShortDomain(shortDomain);
    setMsg("Saved.");
  });

  $<HTMLButtonElement>("loadZones").addEventListener("click", () => void refreshZones());

  deployBtn.addEventListener("click", async () => {
    const zone = zones.find((z) => z.id === zoneEl.value);
    if (!zone) return;
    const subdomain = subdomainEl.value.trim().replace(/[^A-Za-z0-9-]/g, "");
    deployBtn.disabled = true;
    const host = subdomain ? `${subdomain}.${zone.name}` : zone.name;
    setMsg(`Deploying Hopgo to ${host}...`);
    try {
      const result = await provisionZone(zone, subdomain);
      await setShortDomain(result.shortDomain);
      shortDomainEl.value = result.shortDomain;
      if (result.dns === "created") {
        setMsg(`Done. Short links will be served at ${result.shortDomain}.`);
      } else {
        setMsg(
          `Worker deployed at ${result.host}, but I could not create the DNS record ` +
            `(grant DNS edit, or add it manually: proxied AAAA record, name ${result.host}, content 100::).`,
          true,
        );
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Setup failed", true);
    } finally {
      deployBtn.disabled = false;
    }
  });
}

void init();
