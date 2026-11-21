"""Serve ASGI requests over stdin for offline browser integration tests."""
import base64
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from services.compressor import api


def main():
    with tempfile.TemporaryDirectory(dir=sys.argv[1] if len(sys.argv) > 1 else None) as folder:
        api.DATA = Path(folder)
        with TestClient(api.app) as client:
            for line in sys.stdin:
                request = json.loads(line)
                try:
                    response = client.request(request['method'], request['url'], headers=request['headers'], content=base64.b64decode(request['body']))
                    reply = {'id': request['id'], 'status': response.status_code, 'headers': dict(response.headers), 'body': base64.b64encode(response.content).decode()}
                except Exception as exc:
                    reply = {'id': request['id'], 'error': str(exc)}
                print(json.dumps(reply), flush=True)


if __name__ == '__main__':
    main()
