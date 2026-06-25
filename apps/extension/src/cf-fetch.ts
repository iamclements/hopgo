/**
 * Native fetch bound to the global, so it can be passed to the shared helpers
 * without triggering "Illegal invocation" when they call it as a parameter.
 */
export const cfFetch: typeof fetch = globalThis.fetch.bind(globalThis);
