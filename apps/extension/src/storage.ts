/** Settings and recent-link persistence via chrome.storage.local. */
import { dedupeRecent, type RecentLink } from "./util.js";

export interface Settings {
  /** Control-plane API origin, e.g. http://localhost:8787. */
  apiBaseUrl: string;
  /** Optional bearer token forwarded to the control plane. */
  token?: string;
}

const DEFAULT_SETTINGS: Settings = { apiBaseUrl: "" };

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return (settings as Settings) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

export async function getRecent(): Promise<RecentLink[]> {
  const { recent } = await chrome.storage.local.get("recent");
  return (recent as RecentLink[]) ?? [];
}

export async function addRecent(link: RecentLink): Promise<RecentLink[]> {
  const next = dedupeRecent(await getRecent(), link);
  await chrome.storage.local.set({ recent: next });
  return next;
}
