// Thin wrapper around fetch. All network access goes through here so
// error handling stays consistent across the app.

export class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server");
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error ?? {};
    throw new ApiError(response.status, err.code ?? "UNKNOWN_ERROR",
      err.message ?? response.statusText, err.details);
  }
  return data;
}

const group = (token) => `/groups/${encodeURIComponent(token)}`;

export const api = {
  health: () => request("GET", "/health"),

  createGroup: (name) => request("POST", "/groups", { name }),
  getGroup: (token) => request("GET", group(token)),
  renameGroup: (token, name) => request("PATCH", group(token), { name }),
  deleteGroup: (token) => request("DELETE", group(token)),

  addMember: (token, name) => request("POST", `${group(token)}/members`, { name }),
  updateMember: (token, id, changes) =>
    request("PATCH", `${group(token)}/members/${id}`, changes),
  deleteMember: (token, id) => request("DELETE", `${group(token)}/members/${id}`),

  listExpenses: (token) => request("GET", `${group(token)}/expenses`),
  getExpense: (token, id) => request("GET", `${group(token)}/expenses/${id}`),
  createExpense: (token, expense) => request("POST", `${group(token)}/expenses`, expense),
  updateExpense: (token, id, expense) =>
    request("PUT", `${group(token)}/expenses/${id}`, expense),
  deleteExpense: (token, id) => request("DELETE", `${group(token)}/expenses/${id}`),

  getSummary: (token) => request("GET", `${group(token)}/summary`),
  getSuggestions: (token) => request("GET", `${group(token)}/settlement`),
  listSettlements: (token) => request("GET", `${group(token)}/settlements`),
  recordSettlement: (token, payment) =>
    request("POST", `${group(token)}/settlements`, payment),
  deleteSettlement: (token, id) => request("DELETE", `${group(token)}/settlements/${id}`),
};
