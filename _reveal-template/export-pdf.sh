#!/usr/bin/env bash
# Exports the talk in the current folder to PDF with DeckTape, using the local Chrome.
#
#   template/export-pdf.sh                 # one page per slide, every fragment shown -> <folder>.pdf
#   template/export-pdf.sh out.pdf         # same, custom output name
#   template/export-pdf.sh out.pdf --steps # one page per fragment step (for build-up animations)
#
# Needs Node (npx) and Google Chrome. DeckTape is fetched by npx on first use.
set -euo pipefail

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="${1:-$(basename "$PWD").pdf}"
MODE="${2:-}"

# Pick a free port and serve this folder for the duration of the export.
start_server() {
  PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
  SERVER_PID=$!
  trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
  sleep 1
}

# Final-state export uses ?all-fragments; --steps keeps fragments so DeckTape prints each step.
deck_url() {
  if [[ "$MODE" == "--steps" ]]; then
    echo "http://127.0.0.1:$PORT/index.html"
  else
    echo "http://127.0.0.1:$PORT/index.html?all-fragments"
  fi
}

start_server
PUPPETEER_SKIP_DOWNLOAD=1 npx -y decktape@3 reveal \
  --chrome-path "$CHROME" --size 1280x720 --pause 400 \
  "$(deck_url)" "$OUT"
echo "Wrote $OUT"
