from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args: object) -> None:
        pass


workspace = Path(__file__).resolve().parent.parent
server = ThreadingHTTPServer(("127.0.0.1", 8092), lambda *args, **kwargs: QuietHandler(*args, directory=str(workspace), **kwargs))
server.serve_forever()
