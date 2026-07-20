import { deleteLink, getClicks, listLinks, putLink, type Link } from "@hopgo/shared";
import { clientFor, currentConnection } from "./session.js";
import { getActiveDomain, getDomainNamespaces, getDomains, setActiveDomain } from "./storage.js";
import { buildShortUrl } from "./util.js";
import type { CloudflareKvClient } from "@hopgo/shared";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// Elements
const domainSelectEl = $<HTMLSelectElement>("domainSelect");
const searchEl = $<HTMLInputElement>("search");
const sortEl = $<HTMLSelectElement>("sort");
const countLabelEl = $("countLabel");
const bulkBarEl = $("bulkBar");
const bulkLabelEl = $("bulkLabel");
const bulkDeleteBtn = $<HTMLButtonElement>("bulkDelete");
const bulkClearBtn = $<HTMLButtonElement>("bulkClear");
const statusBarEl = $("statusBar");
const tbodyEl = $("tbody");
const loadMoreWrapEl = $("loadMoreWrap");
const loadMoreBtn = $<HTMLButtonElement>("loadMore");
const selectAllEl = $<HTMLInputElement>("selectAll");
const redirect404El = $<HTMLInputElement>("redirect404Input");
const save404Btn = $<HTMLButtonElement>("save404");

// State
interface LinkWithClicks extends Link {
  clicks: number;
}

let allLinks: LinkWithClicks[] = [];
let cursor: string | undefined;
let shortDomain = "";
let client: CloudflareKvClient | null = null;
const selected = new Set<string>();
let loading = false;

// ── Helpers ────────────────────────────────────────────────────────────────

function domainHost(d: string): string {
  try {
    return new URL(d).hostname;
  } catch {
    return d.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

function setStatus(text: string, kind: "info" | "error" | "success" = "info"): void {
  statusBarEl.textContent = text;
  statusBarEl.className = `status-bar visible${kind !== "info" ? ` ${kind}` : ""}`;
  if (kind !== "error") setTimeout(() => (statusBarEl.className = "status-bar"), 3000);
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function isExpiringSoon(ts: number): boolean {
  return ts - Math.floor(Date.now() / 1000) < 60 * 60 * 24 * 3;
}

const COPY_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const DEL_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

// ── Filtering / sorting ────────────────────────────────────────────────────

function filtered(): LinkWithClicks[] {
  const q = searchEl.value.trim().toLowerCase();
  const list = q
    ? allLinks.filter((l) => l.slug.includes(q) || l.url.toLowerCase().includes(q))
    : allLinks.slice();

  const sort = sortEl.value;
  if (sort === "newest") list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  else if (sort === "oldest") list.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
  else if (sort === "clicks-desc") list.sort((a, b) => b.clicks - a.clicks);
  else if (sort === "clicks-asc") list.sort((a, b) => a.clicks - b.clicks);

  return list;
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderTable(): void {
  const rows = filtered();
  const host = domainHost(shortDomain);

  countLabelEl.textContent = `${rows.length} link${rows.length !== 1 ? "s" : ""}`;

  if (rows.length === 0) {
    tbodyEl.innerHTML = `<tr class="empty-row"><td colspan="6">${allLinks.length === 0 ? "No links yet." : "No links match your search."}</td></tr>`;
    updateBulkBar();
    return;
  }

  tbodyEl.innerHTML = "";
  for (const link of rows) {
    const tr = document.createElement("tr");
    tr.dataset.slug = link.slug;
    if (selected.has(link.slug)) tr.classList.add("selected");

    const shortUrl = buildShortUrl(shortDomain, link.slug);
    const expiryVal = link.expiresAt ? formatDate(link.expiresAt) : "";
    const expirySoon = link.expiresAt ? isExpiringSoon(link.expiresAt) : false;

    tr.innerHTML = `
      <td class="td-check"><input type="checkbox" aria-label="Select ${escHtml(link.slug)}" ${selected.has(link.slug) ? "checked" : ""}></td>
      <td class="td-slug">${escHtml(host)}/<strong>${escHtml(link.slug)}</strong></td>
      <td class="td-dest"><span class="dest-text" title="${escHtml(link.url)}">${escHtml(link.url.replace(/^https?:\/\//, ""))}</span></td>
      <td class="td-clicks">${link.clicks}</td>
      <td class="td-expiry"><input type="date" class="expiry-input${expirySoon ? " expiring-soon" : ""}" value="${escHtml(expiryVal)}" title="Set expiry date (leave blank for no expiry)"></td>
      <td class="td-actions">
        <button class="icon-btn copy-btn" title="Copy short URL">${COPY_ICON}</button>
        <button class="icon-btn del-btn" title="Delete ${escHtml(link.slug)}">${DEL_ICON}</button>
      </td>
    `;

    const checkbox = tr.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(link.slug);
      else selected.delete(link.slug);
      tr.classList.toggle("selected", checkbox.checked);
      updateBulkBar();
      updateSelectAll();
    });

    const copyBtn = tr.querySelector<HTMLButtonElement>(".copy-btn")!;
    copyBtn.addEventListener("click", () => {
      void navigator.clipboard.writeText(shortUrl).then(() => {
        setStatus(`Copied ${host}/${link.slug}`, "success");
      });
    });

    const delBtn = tr.querySelector<HTMLButtonElement>(".del-btn")!;
    delBtn.addEventListener("click", () => {
      if (confirm(`Delete ${host}/${link.slug}?`)) void removeLink(link.slug);
    });

    const expiryInput = tr.querySelector<HTMLInputElement>(".expiry-input")!;
    expiryInput.addEventListener("change", () => void updateExpiry(link, expiryInput.value));

    tbodyEl.appendChild(tr);
  }

  updateSelectAll();
  updateBulkBar();
}

function updateBulkBar(): void {
  if (selected.size === 0) {
    bulkBarEl.className = "bulk-bar";
  } else {
    bulkBarEl.className = "bulk-bar visible";
    bulkLabelEl.textContent = `${selected.size} selected`;
  }
}

function updateSelectAll(): void {
  const rows = filtered();
  const allChecked = rows.length > 0 && rows.every((l) => selected.has(l.slug));
  const someChecked = rows.some((l) => selected.has(l.slug));
  selectAllEl.checked = allChecked;
  selectAllEl.indeterminate = someChecked && !allChecked;
}

// ── Data loading ───────────────────────────────────────────────────────────

async function loadPage(cur?: string): Promise<void> {
  if (!client) return;
  loading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.innerHTML = '<span class="spinner"></span>Loading...';

  try {
    const result = await listLinks(client, { limit: 100, cursor: cur });
    const clicks = await Promise.all(result.links.map((l) => getClicks(client!, l.slug)));
    const withClicks: LinkWithClicks[] = result.links.map((l, i) => ({
      ...l,
      clicks: clicks[i] ?? 0,
    }));

    if (cur) {
      allLinks = [...allLinks, ...withClicks];
    } else {
      allLinks = withClicks;
    }

    cursor = result.cursor;
    loadMoreWrapEl.style.display = cursor ? "" : "none";
    renderTable();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Failed to load links", "error");
  } finally {
    loading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Load more";
  }
}

async function removeLink(slug: string): Promise<void> {
  if (!client) return;
  try {
    await deleteLink(client, slug);
    allLinks = allLinks.filter((l) => l.slug !== slug);
    selected.delete(slug);
    renderTable();
    setStatus(`Deleted ${slug}`, "success");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Delete failed", "error");
  }
}

async function updateExpiry(link: LinkWithClicks, dateStr: string): Promise<void> {
  if (!client) return;
  const expiresAt = dateStr
    ? Math.floor(new Date(dateStr + "T23:59:59Z").getTime() / 1000)
    : undefined;
  try {
    await putLink(client, { ...link, expiresAt });
    const idx = allLinks.findIndex((l) => l.slug === link.slug);
    if (idx !== -1) allLinks[idx] = { ...allLinks[idx]!, expiresAt };
    setStatus(
      expiresAt ? `Expiry set for ${link.slug}` : `Expiry cleared for ${link.slug}`,
      "success",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Failed to update expiry", "error");
  }
}

// ── 404 redirect ───────────────────────────────────────────────────────────

async function load404Redirect(): Promise<void> {
  if (!client) return;
  try {
    const val = await client.readValue("__404_redirect__");
    if (val) redirect404El.value = val;
  } catch {
    // non-critical
  }
}

async function save404Redirect(): Promise<void> {
  if (!client) return;
  const url = redirect404El.value.trim();
  save404Btn.disabled = true;
  try {
    if (url) {
      await client.writeValue("__404_redirect__", url);
      setStatus("404 redirect saved.", "success");
    } else {
      await client.deleteValue("__404_redirect__");
      setStatus("404 redirect cleared.", "success");
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Save failed", "error");
  } finally {
    save404Btn.disabled = false;
  }
}

// ── Domain switching ───────────────────────────────────────────────────────

async function switchDomain(domain: string): Promise<void> {
  shortDomain = domain;
  await setActiveDomain(domain);
  allLinks = [];
  cursor = undefined;
  selected.clear();
  redirect404El.value = "";

  const connection = await currentConnection();
  if (!connection) return;
  const namespaces = await getDomainNamespaces();
  const namespaceId = namespaces[domain] ?? connection.namespaceId;
  client = clientFor(connection, namespaceId);

  await Promise.all([loadPage(), load404Redirect()]);
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const connection = await currentConnection();
  if (!connection) {
    setStatus("Not signed in. Open the popup to sign in.", "error");
    return;
  }

  const [domains, activeDomain] = await Promise.all([getDomains(), getActiveDomain()]);

  if (domains.length === 0) {
    setStatus("No domains configured. Open the popup settings to set one up.", "error");
    return;
  }

  shortDomain = activeDomain || domains[0]!;

  domainSelectEl.innerHTML = "";
  for (const d of domains) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = domainHost(d);
    opt.selected = d === shortDomain;
    domainSelectEl.appendChild(opt);
  }

  domainSelectEl.addEventListener("change", () => void switchDomain(domainSelectEl.value));

  const namespaces = await getDomainNamespaces();
  const namespaceId = namespaces[shortDomain] ?? connection.namespaceId;
  client = clientFor(connection, namespaceId);

  searchEl.addEventListener("input", () => renderTable());
  sortEl.addEventListener("change", () => renderTable());

  selectAllEl.addEventListener("change", () => {
    const rows = filtered();
    if (selectAllEl.checked) rows.forEach((l) => selected.add(l.slug));
    else rows.forEach((l) => selected.delete(l.slug));
    renderTable();
  });

  bulkDeleteBtn.addEventListener("click", async () => {
    const slugs = [...selected];
    if (slugs.length === 0) return;
    if (!confirm(`Delete ${slugs.length} link${slugs.length !== 1 ? "s" : ""}?`)) return;
    bulkDeleteBtn.disabled = true;
    for (const slug of slugs) await removeLink(slug);
    selected.clear();
    updateBulkBar();
    bulkDeleteBtn.disabled = false;
  });

  bulkClearBtn.addEventListener("click", () => {
    selected.clear();
    renderTable();
  });

  loadMoreBtn.addEventListener("click", () => {
    if (!loading && cursor) void loadPage(cursor);
  });

  save404Btn.addEventListener("click", () => void save404Redirect());

  await Promise.all([loadPage(), load404Redirect()]);
}

void init();
