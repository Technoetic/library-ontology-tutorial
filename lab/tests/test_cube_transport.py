"""Real HTTP transport regression: preserve Cube diagnostics and poll only pending work."""
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest
import urllib.parse

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from lab.run_all import cube_counts, cube_request


class CubeTransportContract(unittest.TestCase):
    def test_pinned_query_format_retries_pending_work_then_returns_counts(self):
        requests = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                query = json.loads(urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)['query'][0])
                requests.append(query)
                # The pinned Cube 1.8.4 API rejects the removed renewQuery field.
                if 'renewQuery' in query:
                    status, payload = 400, {'error': 'Invalid query format: "renewQuery" is not allowed'}
                elif query.get('cacheMode') != 'no-cache':
                    status, payload = 400, {'error': 'This mutation check needs no-cache mode'}
                elif len(requests) == 1:
                    status, payload = 200, {'error': 'Continue wait'}
                else:
                    status, payload = 200, {'data': [{'Library.titles': '1', 'Library.copies': '2', 'Library.activeLoans': '1'}]}
                self.send_response(status)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())

            def log_message(self, *_):
                pass

        with HTTPServer(('127.0.0.1', 4038), Handler) as server:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                try:
                    counts, _ = cube_counts()
                except RuntimeError as error:
                    self.fail(str(error))
                self.assertEqual(counts, {'titles': 1, 'copies': 2, 'activeLoans': 1})
                self.assertEqual(len(requests), 2)
            finally:
                server.shutdown()
                worker.join()

    def test_http_400_preserves_the_actual_server_error_body(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                body = json.dumps({'error': 'Invalid query: renewQuery is not allowed'}).encode()
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_):
                pass

        with HTTPServer(('127.0.0.1', 4038), Handler) as server:
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                with self.assertRaises(Exception) as raised:
                    cube_request('load', {'measures': ['Library.titles']})
                self.assertIn('renewQuery is not allowed', str(raised.exception))
            finally:
                server.shutdown()
                worker.join()


if __name__ == '__main__':
    unittest.main()
