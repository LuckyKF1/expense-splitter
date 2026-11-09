#!/usr/bin/env bash
# Give friends an https:// link to the Expense Splitter running on this
# computer, using an SSH reverse tunnel (ssh is already installed; nothing
# else is needed).
#
#   1. Start the app:      python3 -m backend.server
#   2. Start the tunnel:   scripts/tunnel.sh            (or: scripts/tunnel.sh 8080)
#   3. Open the https://... address it prints, then use "Share link" in the app.
#
# Providers (TUNNEL_PROVIDER):
#   pinggy        (default) Pinggy relay nearest to you, Singapore from Laos
#                 (~40-90 ms measured from Laos). Free tunnels get a random
#                 address and are cut after a time limit (60 min at the time
#                 of writing). With a Pinggy Pro token the address is
#                 permanent, so a link pasted in a group chat keeps working:
#                     PINGGY_TOKEN=<token from the Pinggy dashboard> scripts/tunnel.sh
#   localhost.run Free, no time limit, but the relay is in the USA (~300 ms
#                 from Laos, so every tap is noticeably slower) and the
#                 address changes when the tunnel reconnects.
#
# Either way: the relay terminates HTTPS and can see traffic, this computer
# must stay on, and anyone with a group link can view and edit that group.

set -uo pipefail

PORT="${1:-8000}"
PROVIDER="${TUNNEL_PROVIDER:-pinggy}"

if ! curl -fs "http://127.0.0.1:${PORT}/api/health" > /dev/null; then
  echo "The app is not running on port ${PORT}."
  echo "Start it first:  python3 -m backend.server --port ${PORT}"
  exit 1
fi

# ServerAlive*: notice a dead connection within ~90 s and reconnect.
# ExitOnForwardFailure: fail fast instead of a tunnel that forwards nothing.
# accept-new: trust the relay's host key on first use, refuse if it changes.
SSH_OPTS=(-o ServerAliveInterval=30 -o ServerAliveCountMax=3
          -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new)

case "${PROVIDER}" in
  pinggy)
    if [[ -n "${PINGGY_TOKEN:-}" ]]; then
      TARGET="${PINGGY_TOKEN}@pro.pinggy.io"
      echo "Pinggy Pro: your permanent address is shown in the Pinggy dashboard."
    else
      TARGET="free.pinggy.io"
      echo "Pinggy free: random address, cut after the free time limit."
      echo "Set PINGGY_TOKEN for a permanent address."
    fi
    TUNNEL=(ssh -p 443 "${SSH_OPTS[@]}" -R "0:127.0.0.1:${PORT}" "${TARGET}")
    ;;
  localhost.run)
    TUNNEL=(ssh "${SSH_OPTS[@]}" -R "80:127.0.0.1:${PORT}" "nokey@localhost.run")
    ;;
  *)
    echo "Unknown TUNNEL_PROVIDER '${PROVIDER}' (use pinggy or localhost.run)."
    exit 1
    ;;
esac

echo "Forwarding a public https:// address to http://127.0.0.1:${PORT}"
echo "Look for the https:// line below. Press Ctrl+C to stop sharing."
echo

while true; do
  "${TUNNEL[@]}"
  echo
  echo "Tunnel closed. Reconnecting in 5 seconds (Ctrl+C to stop)..."
  [[ -z "${PINGGY_TOKEN:-}" ]] && echo "Note: without a permanent address, share the new https:// link."
  sleep 5
done
