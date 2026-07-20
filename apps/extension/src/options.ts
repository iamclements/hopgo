import { deployWorker, WORKER_SCRIPT_VERSION, type CloudflareZone } from "@hopgo/shared";
import { cfFetch } from "./cf-fetch.js";
import { loadZones, provisionZone } from "./setup.js";
import { currentConnection } from "./session.js";
import {
  getActiveDomain,
  getDomainNamespaces,
  getDomainScriptNames,
  getDomains,
  getWorkerVersions,
  setActiveDomain,
  setDomains,
  setShortDomain,
  setWorkerVersion,
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
  const [domains, active, versions, scriptNames, namespaces] = await Promise.all([
    getDomains(),
    getActiveDomain(),
    getWorkerVersions(),
    getDomainScriptNames(),
    getDomainNamespaces(),
  ]);
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

    const storedVersion = versions[d];
    const needsUpdate = storedVersion !== undefined && storedVersion !== WORKER_SCRIPT_VERSION;

    if (needsUpdate) {
      const badge = document.createElement("span");
      badge.className = "update-badge";
      badge.textContent = "Update available";

      const updateBtn = document.createElement("button");
      updateBtn.className = "saved-update";
      updateBtn.textContent = "Update";
      updateBtn.addEventListener("click", async () => {
        const connection = await currentConnection();
        if (!connection) {
          setMsg("Sign in first.", true);
          return;
        }
        const scriptName = scriptNames[d];
        const namespaceId = namespaces[d] ?? connection.namespaceId;
        if (!scriptName) {
          setMsg("Cannot update: script name unknown. Re-deploy from the setup form.", true);
          return;
        }
        updateBtn.disabled = true;
        setMsg(`Updating Worker for ${d.replace(/^https?:\/\//, "")}...`);
        try {
          await deployWorker(cfFetch, connection.accessToken, {
            accountId: connection.accountId,
            namespaceId,
            scriptName,
          });
          await setWorkerVersion(d, WORKER_SCRIPT_VERSION);
          await renderSavedDomains();
          setMsg(`Worker updated for ${d.replace(/^https?:\/\//, "")}.`);
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Update failed", true);
          updateBtn.disabled = false;
        }
      });

      row.append(label, badge, updateBtn);
    } else {
      row.append(label);
    }

    const del = document.createElement("button");
    del.className = "saved-del";
    del.textContent = "Remove";
    del.addEventListener("click", async () => {
      const updated = domains.filter((x) => x !== d);
      await setDomains(updated);
      if (d === active && updated.length > 0) await setActiveDomain(updated[0]!);
      await renderSavedDomains();
    });

    row.append(del);
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
