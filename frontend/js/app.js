import { api } from "./api.js";

async function showHealth() {
  const statusEl = document.getElementById("health-status");
  try {
    const health = await api.health();
    statusEl.textContent = `${health.status} (schema v${health.schema_version})`;
  } catch (err) {
    statusEl.textContent = `error: ${err.code}`;
  }
}

showHealth();
