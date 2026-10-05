import http.server, os, time, urllib.parse
# Reçoit les PDF envoyés par 06-export.js (POST /upload?name=…)
OUT = os.environ.get("KIBO_EXPORT_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "exports", "pages"))
os.makedirs(OUT, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/sleep":
            # Attente côté serveur : Chrome bride setTimeout dans un onglet masqué (voir README)
            ms = float(urllib.parse.parse_qs(url.query).get("ms", ["0"])[0])
            time.sleep(min(max(ms, 0), 60000) / 1000)
            self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b"ok"); return
        # Sert les scripts 0N-*.js au plugin (chargement : voir README)
        name = os.path.basename(url.path)
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
        if not name.endswith(".js") or not os.path.isfile(path):
            self.send_response(404); self._cors(); self.end_headers(); return
        self.send_response(200); self._cors(); self.send_header("Content-Type", "text/javascript; charset=utf-8"); self.end_headers()
        self.wfile.write(open(path, "rb").read())
    def do_POST(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        name = os.path.basename(q.get("name", ["out.pdf"])[0])
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        open(os.path.join(OUT, name), "wb").write(data)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b"ok")
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", 8787), H).serve_forever()
