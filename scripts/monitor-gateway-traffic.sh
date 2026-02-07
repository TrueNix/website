#!/usr/bin/env bash
# Monitor OpenClaw gateway traffic and send test requests.
# Usage:
#   ./scripts/monitor-gateway-traffic.sh [duration_sec]   # send requests + optional pcap
#   ./scripts/monitor-gateway-traffic.sh live              # print live tcpdump (then run requests in another terminal)
# Requires: curl, tcpdump (sudo for capture). Gateway should be running on 127.0.0.1:18789.

set -e
MODE="${1:-}"
DURATION="${1:-15}"
PORT="${GATEWAY_PORT:-18789}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CAPTURE_FILE="${CAPTURE_FILE:-$REPO_ROOT/openclaw-traffic-$(date +%Y%m%d-%H%M%S).pcap}"

if [ "$MODE" = "live" ]; then
  echo "Live capture on port $PORT (Ctrl+C to stop). Send requests from another terminal:"
  echo "  curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/"
  echo ""
  exec sudo tcpdump -i lo -n "tcp port $PORT" -A 2>/dev/null
fi

echo "Gateway port: $PORT | Capture ${DURATION}s -> $CAPTURE_FILE"
echo "Sending requests in 2s (start tcpdump in another terminal if you want live view)..."
sleep 2

# Send actual HTTP requests to the gateway
echo "--- GET / (root) ---"
curl -s -w "\nHTTP %{http_code} time=%{time_total}s\n" --connect-timeout 3 "http://127.0.0.1:${PORT}/" || true

echo "--- GET /__openclaw__/canvas/ (canvas) ---"
curl -s -w "\nHTTP %{http_code} time=%{time_total}s\n" --connect-timeout 3 "http://127.0.0.1:${PORT}/__openclaw__/canvas/" || true

echo "--- GET /health (if exists) ---"
curl -s -w "\nHTTP %{http_code} time=%{time_total}s\n" --connect-timeout 3 "http://127.0.0.1:${PORT}/health" 2>/dev/null || true

# Optional: capture with tcpdump (requires sudo)
if command -v tcpdump >/dev/null 2>&1; then
  echo "--- Starting tcpdump for ${DURATION}s on port $PORT (sudo) ---"
  if sudo tcpdump -i lo -n "tcp port ${PORT}" -w "$CAPTURE_FILE" -c 200 2>/dev/null &
  then
    TCPDUMP_PID=$!
    sleep "$DURATION"
    sudo kill "$TCPDUMP_PID" 2>/dev/null || true
    wait "$TCPDUMP_PID" 2>/dev/null || true
    echo "Capture saved: $CAPTURE_FILE"
    echo "View with: tcpdump -r $CAPTURE_FILE -A -n"
  fi
else
  echo "tcpdump not found; skip packet capture. Install with: sudo dnf install tcpdump"
fi

echo "Done."
