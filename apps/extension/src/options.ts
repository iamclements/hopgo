import type { CloudflareZone } from "@hopgo/shared";
import { loadZones, provisionZone } from "./setup.js";
import {
  getActiveDomain,
  getDomains,
  setActiveDomain,
  setDomains,
  setShortDomain,
} from "./storage.js";
import { normalizeBaseUrl } from "./util.js";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const shortDomainEl = $<HTMLInputElement>("shortDomain");
const zoneEl = $<HTMLSelectElement>("zone");
const subdomainEl = $<HTMLInputElement>("subdomain");
const deployBtn = $<HTMLButtonElement>("deploy");
const msgEl = $<HTMLDivElement>("msg");
const savedListEl = $<HTMLDivElement>("savedDomains");

function setMsg(text: string, isError = false): void {
  msgEl.textContent = text;
  msgEl.className = `msg visible${isError ? " error" : ""}`;
}

let zones: CloudflareZone[] = [];

async function renderSavedDomains(): Promise<void> {
  const [domains, active] = await Promise.all([getDomains(), getActiveDomain()]);
  savedListEl.innerHTML = "";
  if (domains.length === 0) return;
  for (const d of domains) {
    const row = document.createElement("div");
    row.className = "saved-row" + (d === active ? " saved-active" : "");

    const label = document.createElement("button");
    label.className = "saved-label";
    label.textContent = d.replace(/^https?:\/\//, "");
    label.title = "Set as active";
    label.addEventListener("click", async () => {
      await setActiveDomain(d);
      await renderSavedDomains();
      setMsg(`Active domain set to ${d.replace(/^https?:\/\//, "")}.`);
    });

    const del = document.createElement("button");
    del.className = "saved-del";
    del.textContent = "Remove";
    del.addEventListener("click", async () => {
      const updated = domains.filter((x) => x !== d);
      await setDomains(updated);
      if (d === active && updated.length > 0) await setActiveDomain(updated[0]!);
      await renderSavedDomains();
    });

    row.append(label, del);
    savedListEl.appendChild(row);
  }
}

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
  await renderSavedDomains();

  $<HTMLButtonElement>("save").addEventListener("click", async () => {
    const domain = normalizeBaseUrl(shortDomainEl.value);
    if (!domain) return;
    if (!/^https?:\/\//.test(domain)) {
      setMsg("Short domain must start with http:// or https://", true);
      return;
    }
    await setShortDomain(domain);
    shortDomainEl.value = "";
    await renderSavedDomains();
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
      await renderSavedDomains();
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
