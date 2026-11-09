#!/usr/bin/env bash
# Give friends an https:// link to the Expense Splitter running on this
# computer, using an SSH reverse tunnel (ssh is already installed; nothing
# else is needed).
#
#   1. Start the app:      python3 -m backend.server
#   2. Start the tunnel:   scripts/tunnel.sh            (or: scripts/tunnel.sh 8080)
#   3. Open the https://... address it prints, then use "Share link" in the app.
#
# How it works: this computer opens an outgoing SSH connection to a public
# relay (localhost.run by default), which forwards https requests back to
# 127.0.0.1:<port>. No router setup, no open ports, works behind CGNAT.
#
# Trade-offs to know:
# - The free relay assigns a random domain that changes when the tunnel
#   reconnects. Group links keep the same /g/<token> path, but the domain
#   part must be re-shared after a change.
# - The relay terminates HTTPS, so it can see the traffic.
# - This computer must stay on and awake for friends to use the app.
# - Anyone with a group link can view and edit that group.

set -uo pipefail

PORT="${1:-8000}"
RELAY="${TUNNEL_RELAY:-nokey@localhost.run}"

if ! curl -fs "http://127.0.0.1:${PORT}/api/health" > /dev/null; then
  echo "The app is not running on port ${PORT}."
  echo "Start it first:  python3 -m backend.server --port ${PORT}"
  exit 1
fi

echo "Forwarding a public https:// address to http://127.0.0.1:${PORT}"
echo "Look for the https:// line below. Press Ctrl+C to stop sharing."
echo

while true; do
  # ServerAlive*: notice a dead connection within ~90s and reconnect.
  # ExitOnForwardFailure: fail fast instead of a tunnel that forwards nothing.
  # accept-new: trust the relay's host key on first use, refuse if it changes.
  ssh -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new \
      -R "80:127.0.0.1:${PORT}" "${RELAY}"
  echo
  echo "Tunnel closed. Reconnecting in 5 seconds (Ctrl+C to stop)..."
  echo "Note: the https:// address may change; share the new one."
  sleep 5
done
