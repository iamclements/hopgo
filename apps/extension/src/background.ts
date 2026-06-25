/**
 * Background service worker. The OAuth flow must run here, not in the popup: a
 * popup closes the instant the Cloudflare sign-in window takes focus, which would
 * abort launchWebAuthFlow before the token is stored. The service worker persists
 * for the duration of the flow.
 */
import { connect } from "./session.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "connect") {
    connect()
      .then((connection) => {
        console.log("Hopgo connected", { accountId: connection.accountId });
        sendResponse({ ok: true });
      })
      .catch((err) => {
        console.error("Hopgo connect failed", err);
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
      });
    return true; // keep the message channel open for the async response
  }
  return undefined;
});
