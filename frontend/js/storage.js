// localStorage for per-device conveniences only (language, recent groups).
// It can be missing or throw (private mode, blocked storage), so every
// access is guarded and the app works without it. Real data lives on
// the server.

const PREFIX = "expense-splitter:";
const MAX_RECENT_GROUPS = 20;

function backend() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // some browsers throw just for touching localStorage
  }
}

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = backend()?.getItem(PREFIX + key);
      return raw === null || raw === undefined ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      backend()?.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: losing a convenience is acceptable.
    }
  },
};

/** Groups opened on this device, most recent first: [{token, name}]. */
export function recentGroups() {
  const list = storage.get("recentGroups", []);
  return Array.isArray(list) ? list.filter((g) => g && typeof g.token === "string") : [];
}

export function rememberGroup(token, name) {
  const others = recentGroups().filter((g) => g.token !== token);
  storage.set("recentGroups", [{ token, name }, ...others].slice(0, MAX_RECENT_GROUPS));
}

export function forgetGroup(token) {
  storage.set("recentGroups", recentGroups().filter((g) => g.token !== token));
}
