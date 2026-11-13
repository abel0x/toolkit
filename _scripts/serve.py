"""Serve _site like GitHub Pages: under /toolkit/, with 404.html for missing paths."""
import http.server
import os
import sys

SITE = os.path.abspath(sys.argv[1])
PREFIX = '/toolkit'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE, **kwargs)

    def translate_path(self, path):
        path = path.split('?', 1)[0].split('#', 1)[0]
        if path.startswith(PREFIX):
            path = path[len(PREFIX):] or '/'
        return super().translate_path(path)

    def do_GET(self):
        if self.path in ('/', ''):
            self.send_response(302)
            self.send_header('Location', PREFIX + '/')
            self.end_headers()
            return
        if not os.path.exists(self.translate_path(self.path)) or not self.path.startswith(PREFIX):
            body = open(os.path.join(SITE, '404.html'), 'rb').read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


http.server.ThreadingHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
