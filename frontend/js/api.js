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

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = data?.error ?? {};
    throw new ApiError(response.status, err.code ?? "UNKNOWN_ERROR",
      err.message ?? response.statusText, err.details);
  }
  return data;
}

export const api = {
  health: () => request("GET", "/health"),
};
