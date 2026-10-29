#!/usr/bin/env bash
# Serves one talk folder over HTTP so the reveal.js deck can load its chapter files.
#
#   ./serve.sh                     # list the talks
#   ./serve.sh iceberg-pinot       # serve it on http://127.0.0.1:8000/
#   ./serve.sh iceberg-pinot 9000  # custom port
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

list_talks() {
  echo "Usage: $0 <talk> [port]"
  echo "Talks:"
  find "$ROOT" -mindepth 2 -maxdepth 2 -name index.html -not -path '*/.*' \
    | xargs -n1 dirname | xargs -n1 basename | sort | sed 's/^/  /'
}

if [[ $# -lt 1 ]]; then
  list_talks
  exit 1
fi

TALK="$1"
PORT="${2:-8000}"
if [[ ! -f "$ROOT/$TALK/index.html" ]]; then
  echo "No talk named '$TALK' (missing $ROOT/$TALK/index.html)." >&2
  list_talks >&2
  exit 1
fi

echo "Serving $TALK on http://127.0.0.1:$PORT/  (Ctrl+C to stop)"
cd "$ROOT/$TALK"
# Like `python3 -m http.server`, but with Cache-Control: no-store, so a browser never shows a stale
# deck or chapter after an edit (the speaker view loads the deck again in its own iframes).
exec python3 -c '
import http.server, sys
class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), NoCache).serve_forever()
' "$PORT"
