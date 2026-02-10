"""Flask server for sim artifact viewer: list artifacts, prepare NDJSON index, serve slices."""

from __future__ import annotations

import threading
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from .ndjson_index import (
    build_ndjson_and_index,
    count_entries,
    read_slice,
)
from .states_index import (
    build_states_ndjson,
    read_state_at_step,
    states_count,
)

# Artifacts dir relative to package (python-sdk/sim-artifacts)
VIEWER_DIR = Path(__file__).resolve().parent
PKG_ROOT = VIEWER_DIR.parent.parent.parent
ARTIFACTS_DIR = PKG_ROOT / "sim-artifacts"

# In-progress build state: artifact name -> "building" | total_count
_build_status: dict[str, str | int] = {}
_build_lock = threading.Lock()


def create_app(artifacts_dir: Path | None = None) -> Flask:
    root = artifacts_dir or ARTIFACTS_DIR
    app = Flask(__name__, static_folder=VIEWER_DIR / "static", static_url_path="")

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/api/artifacts")
    def list_artifacts():
        if not root.exists():
            return jsonify({"artifacts": []})
        files = sorted(
            p for p in root.iterdir() if p.suffix == ".json" and p.name != "fuzz-analysis-details.json"
        )
        artifacts = []
        for p in files:
            ndjson_path = p.with_suffix(p.suffix + ".ndjson")
            index_path = p.with_suffix(p.suffix + ".ndjson.idx")
            states_path = p.with_suffix(p.suffix + ".states.ndjson")
            total = count_entries(index_path) if index_path.exists() else None
            artifacts.append({
                "name": p.name,
                "size": p.stat().st_size,
                "total": total,
                "ready": ndjson_path.exists() and index_path.exists(),
                "hasStates": states_path.exists(),
            })
        return jsonify({"artifacts": artifacts})

    @app.route("/api/artifacts/<path:name>/prepare", methods=["POST"])
    def prepare(name: str):
        # Restrict to basename to avoid path traversal
        name = name.split("/")[-1].split("\\")[-1]
        json_path = root / name
        if not json_path.is_file() or json_path.suffix != ".json":
            return jsonify({"error": "not found"}), 404
        ndjson_path = json_path.with_suffix(json_path.suffix + ".ndjson")
        index_path = json_path.with_suffix(json_path.suffix + ".ndjson.idx")
        states_path = json_path.with_suffix(json_path.suffix + ".states.ndjson")
        states_index_path = json_path.with_suffix(json_path.suffix + ".states.ndjson.idx")

        with _build_lock:
            if ndjson_path.exists() and index_path.exists():
                total = count_entries(index_path)
                return jsonify({"total": total, "status": "ready"})
            if _build_status.get(name) == "building":
                return jsonify({"status": "building"})

        def do_build():
            try:
                with _build_lock:
                    _build_status[name] = "building"
                total = build_ndjson_and_index(json_path, ndjson_path, index_path)
                build_states_ndjson(
                    json_path, states_path, states_index_path,
                    action_trace_total=total,
                )
                with _build_lock:
                    _build_status[name] = total
            except Exception:
                with _build_lock:
                    _build_status[name] = "error"

        with _build_lock:
            if _build_status.get(name) == "building":
                return jsonify({"status": "building"})
            if ndjson_path.exists() and index_path.exists():
                total = count_entries(index_path)
                if not states_path.exists():
                    total_for_states = count_entries(index_path)

                    def do_build_states_only():
                        try:
                            build_states_ndjson(
                                json_path, states_path, states_index_path,
                                action_trace_total=total_for_states,
                            )
                        except Exception:
                            pass
                    threading.Thread(target=do_build_states_only, daemon=True).start()
                return jsonify({
                    "total": total,
                    "status": "ready",
                    "hasStates": states_path.exists(),
                })
            threading.Thread(target=do_build, daemon=True).start()
            return jsonify({"status": "building"})

    @app.route("/api/artifacts/<path:name>/status")
    def status(name: str):
        name = name.split("/")[-1].split("\\")[-1]
        json_path = root / name
        ndjson_path = json_path.with_suffix(json_path.suffix + ".ndjson")
        index_path = json_path.with_suffix(json_path.suffix + ".ndjson.idx")
        with _build_lock:
            st = _build_status.get(name)
        if st == "building":
            return jsonify({"status": "building"})
        if st == "error":
            return jsonify({"status": "error"})
        if ndjson_path.exists() and index_path.exists():
            total = count_entries(index_path)
            states_path = json_path.with_suffix(json_path.suffix + ".states.ndjson")
            return jsonify({
                "total": total,
                "status": "ready",
                "hasStates": states_path.exists(),
            })
        return jsonify({"status": "none"})

    @app.route("/api/artifacts/<path:name>/entries")
    def entries(name: str):
        name = name.split("/")[-1].split("\\")[-1]
        json_path = root / name
        ndjson_path = json_path.with_suffix(json_path.suffix + ".ndjson")
        index_path = json_path.with_suffix(json_path.suffix + ".ndjson.idx")
        if not ndjson_path.exists() or not index_path.exists():
            return jsonify({"error": "not prepared"}), 400
        try:
            offset = int(request.args.get("offset", 0))
            limit = min(int(request.args.get("limit", 100)), 500)
        except ValueError:
            return jsonify({"error": "invalid offset/limit"}), 400
        if offset < 0 or limit < 1:
            return jsonify({"error": "invalid offset/limit"}), 400
        items = read_slice(ndjson_path, index_path, offset, limit)
        return jsonify({"entries": items, "offset": offset})

    @app.route("/api/artifacts/<path:name>/state")
    def state_at_step(name: str):
        name = name.split("/")[-1].split("\\")[-1]
        json_path = root / name
        states_path = json_path.with_suffix(json_path.suffix + ".states.ndjson")
        states_index_path = json_path.with_suffix(json_path.suffix + ".states.ndjson.idx")
        if not states_path.exists():
            return jsonify({"error": "states not prepared"}), 400
        try:
            step = int(request.args.get("step", 0))
        except ValueError:
            return jsonify({"error": "invalid step"}), 400
        if step < 0:
            return jsonify({"error": "invalid step"}), 400
        updates = read_state_at_step(states_path, states_index_path, step)
        if updates is None:
            return jsonify({"error": "step out of range"}), 404
        return jsonify({"step": step, "updates": updates})

    return app


def run(host: str = "127.0.0.1", port: int = 8765, artifacts_dir: Path | None = None):
    root = artifacts_dir or ARTIFACTS_DIR
    app = create_app(root)
    print(f"Sim artifact viewer: http://{host}:{port}")
    print(f"Artifacts from: {root}")
    app.run(host=host, port=port, threaded=True)
