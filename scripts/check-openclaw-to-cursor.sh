#!/usr/bin/env bash
# Check and monitor OpenClaw → Cursor traffic (outbound API calls from gateway to Cursor).
# Usage:
#   ./scripts/check-openclaw-to-cursor.sh          # show gateway process and its connections
#   ./scripts/check-openclaw-to-cursor.sh watch    # watch connections (refresh every 2s)
#   ./scripts/check-openclaw-to-cursor.sh capture  # capture outbound HTTPS 30s (sudo tcpdump)
#
# Cursor is the *model provider* (cursor/auto, cursor/*). OpenClaw uses pi-coding-agent
# to send requests to Cursor's API; config: ~/.openclaw/openclaw.json (models.providers.cursor)
# and agent dir models.json/auth.

set -e
MODE="${1:-}"

# Find OpenClaw gateway process (prefer the actual node gateway, not the shell wrapper)
find_gateway_pid() {
  # openclaw-gatewa is the usual process name when run via npm/node
  local p
  p=$(pgrep -f "openclaw-gatewa" 2>/dev/null | head -1)
  [ -n "$p" ] && echo "$p" && return
  p=$(pgrep -f "node.*gateway" 2>/dev/null | head -1)
  [ -n "$p" ] && echo "$p" && return
  echo ""
}

echo "=== OpenClaw → Cursor check ==="
echo ""

# 1. Gateway process
PID=$(find_gateway_pid)
if [ -z "$PID" ]; then
  echo "No OpenClaw gateway process found. Start it with: openclaw gateway start (or node gateway)."
  exit 1
fi
echo "Gateway PID: $PID"
ps -p "$PID" -o pid,comm,args 2>/dev/null | tail -1 || true
echo ""

# 2. TCP connections from gateway (outbound = to Cursor/Anthropic/etc.)
echo "--- TCP connections from gateway (PID $PID) ---"
if command -v ss >/dev/null 2>&1; then
  ss -tnp 2>/dev/null | grep "pid=$PID" || true
  echo ""
  echo "Outbound 443 (HTTPS to Cursor/APIs):"
  ss -tnp 2>/dev/null | grep "pid=$PID" | grep ":443 " || echo "(none right now; trigger an agent request with cursor/auto to see traffic)"
else
  lsof -p "$PID" -i TCP 2>/dev/null | grep -v "^COMMAND" || true
fi
echo ""

# 3. Config hint
OC_CONFIG="${OPENCLAW_CONFIG_PATH:-$HOME/.openclaw/openclaw.json}"
if [ -f "$OC_CONFIG" ]; then
  echo "--- Cursor in config ($OC_CONFIG) ---"
  grep -E "cursor|primary|model" "$OC_CONFIG" 2>/dev/null | head -10 || echo "(no cursor/model snippet found)"
else
  echo "Config not found at $OC_CONFIG"
fi
echo ""

case "$MODE" in
  watch)
    echo "Watching connections (Ctrl+C to stop)..."
    while true; do
      clear
      echo "=== OpenClaw gateway PID $PID — $(date) ==="
      ss -tnp 2>/dev/null | grep "pid=$PID" || true
      sleep 2
    done
    ;;
  capture)
    echo "Capturing outbound HTTPS (port 443) for 30s (requires sudo)..."
    CAP="/tmp/openclaw-outbound-$(date +%Y%m%d-%H%M%S).pcap"
    sudo timeout 30 tcpdump -i any -n "tcp port 443 and host not 127.0.0.1" -w "$CAP" -c 500 2>/dev/null || true
    echo "Saved: $CAP"
    echo "View: sudo tcpdump -r $CAP -A -n | head -100"
    ;;
  *)
    echo "Commands: watch (live connections) | capture (30s pcap of outbound 443)"
    ;;
esac
