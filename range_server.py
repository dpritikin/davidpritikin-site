import os
import re
from http.server import HTTPServer, SimpleHTTPRequestHandler

RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")

class RangeRequestHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()
        ctype = self.guess_type(path)
        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        fs = os.fstat(f.fileno())
        size = fs.st_size
        start = 0
        end = size - 1
        status = 200

        range_header = self.headers.get("Range")
        if range_header:
            m = RANGE_RE.match(range_header)
            if m:
                g1, g2 = m.groups()
                if g1:
                    start = int(g1)
                if g2:
                    end = int(g2)
                if not g1 and g2:
                    suffix = int(g2)
                    start = max(0, size - suffix)
                    end = size - 1
                start = max(0, min(start, size - 1))
                end = max(start, min(end, size - 1))
                status = 206

        self.send_response(status)
        self.send_header("Content-type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
        else:
            self.send_header("Content-Length", str(size))
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()

        self.range = (start, end)
        f.seek(start)
        return f

    def copyfile(self, source, outputfile):
        start, end = getattr(self, "range", (0, None))
        if end is None:
            super().copyfile(source, outputfile)
            return
        remaining = end - start + 1
        bufsize = 64 * 1024
        while remaining > 0:
            chunk = source.read(min(bufsize, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

if __name__ == "__main__":
    host = "127.0.0.1"
    port = 9044
    server = HTTPServer((host, port), RangeRequestHandler)
    print(f"Serving with byte-range support on http://{host}:{port}")
    server.serve_forever()
