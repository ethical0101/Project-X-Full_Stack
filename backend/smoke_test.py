import json
import traceback

print("Starting backend smoke tests using Flask test client")

try:
    # Load backend/app.py as a module without requiring package import
    import importlib.util
    from pathlib import Path

    backend_path = Path(__file__).resolve().parent / 'app.py'
    spec = importlib.util.spec_from_file_location('backend_app', str(backend_path))
    backend_app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(backend_app)
    flask_app = backend_app.app
except Exception as e:
    print("Failed to load backend/app.py as module:", str(e))
    traceback.print_exc()
    raise SystemExit(1)

client = flask_app.test_client()

endpoints = [
    ("GET", "/test-mining"),
    ("POST", "/test-upload-and-mine"),
    ("GET", "/test-lattice"),
]

for method, path in endpoints:
    print(f"\n--- Calling {method} {path} ---")
    try:
        if method == "GET":
            resp = client.get(path)
        else:
            resp = client.post(path)

        print("Status:", resp.status_code)
        try:
            j = resp.get_json()
            print("JSON response:")
            print(json.dumps(j, indent=2, ensure_ascii=False))
        except Exception:
            print("Non-JSON response or failed to decode. Raw bytes:")
            print(resp.data.decode('utf-8', errors='replace'))

    except Exception as e:
        print(f"Request to {path} failed: {e}")
        traceback.print_exc()

print("\nSmoke tests completed")
